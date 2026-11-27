import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MissionDef } from '../../src/game/missions/types'

// Runtime de audio en node con fakes: AudioContext, Audio, fetch, window/document. Cada test importa los módulos de
// nuevo (vi.resetModules): sfx.ts y radioPlayer.ts son singletons.

class FakeParam {
  value = 0
  calls: string[] = []
  setTargetAtTime = (v: number) => void (this.calls.push('target'), (this.value = v))
  setValueAtTime = (v: number) => void (this.value = v)
  exponentialRampToValueAtTime = (v: number) => void (this.value = v)
}
const node = () => ({ connect: (n: unknown) => n, gain: new FakeParam(), frequency: new FakeParam(), type: '' })
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state = 'running'
  currentTime = 0
  sampleRate = 8000
  destination = {}
  oscillators: { stopped: boolean; frequency: FakeParam }[] = []
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createGain = () => node()
  createBiquadFilter = () => node()
  createOscillator = () => {
    const o = { ...node(), stopped: false, start: () => {}, stop: () => void (o.stopped = true) }
    this.oscillators.push(o)
    return o
  }
  createBufferSource = () => ({ ...node(), buffer: null, loop: false, start: () => {} })
  createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
  resume = () => Promise.resolve()
  suspend = () => Promise.resolve()
}

let audios: string[]
class FakeAudio {
  volume = 1
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(public src: string) {
    audios.push(src)
  }
  play = () => Promise.resolve()
  pause = () => {}
}

const win = new EventTarget()
beforeEach(() => {
  vi.resetModules()
  FakeAudioContext.instances = []
  audios = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', { hidden: false, addEventListener: () => {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve({ lines: {} }) }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('AudioContext solo tras un gesto', () => {
  it('startAudio no crea el contexto; el primer keydown sí, y uno solo', async () => {
    const { startAudio } = await import('../../src/audio')
    startAudio()
    expect(FakeAudioContext.instances).toHaveLength(0)
    win.dispatchEvent(new Event('keydown'))
    expect(FakeAudioContext.instances).toHaveLength(1)
    win.dispatchEvent(new Event('pointerdown'))
    expect(FakeAudioContext.instances).toHaveLength(1)
  })
  it('sin WebAudio, unlock y los efectos no lanzan', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { sfx, unlock } = await import('../../src/audio/sfx')
    expect(() => (unlock(), sfx.step(), sfx.engine(3), sfx.notify('mission'))).not.toThrow()
  })
})

describe('efectos con contexto fake', () => {
  it('todos los efectos suenan sin lanzar; el motor se crea al conducir y se detiene al bajar', async () => {
    const { sfx, unlock } = await import('../../src/audio/sfx')
    unlock()
    const ctx = FakeAudioContext.instances[0]
    for (const f of [sfx.step, sfx.jump, sfx.land, sfx.door, sfx.valve, sfx.rung]) expect(() => f()).not.toThrow()
    sfx.notify('completed')
    const before = ctx.oscillators.length
    sfx.engine(6)
    expect(ctx.oscillators).toHaveLength(before + 1)
    const osc = ctx.oscillators.at(-1)!
    sfx.engine(6.01) // casi igual: no reprograma
    sfx.engine(6.01)
    expect(osc.frequency.calls).toHaveLength(1)
    sfx.engine(9)
    expect(osc.frequency.calls).toHaveLength(2)
    sfx.engine(null)
    expect(osc.stopped).toBe(true)
    sfx.engine(null) // ya apagado: no lanza
  })
})

// Misión mínima de prueba: un objetivo de autorregistro (se completa sin moverse).
const MINI: MissionDef = {
  id: 'mini',
  title: 'Prueba',
  briefing: 'Primera oración de prueba. Segunda oración de prueba.',
  objectives: [{ id: 'o1', kind: 'mark', text: 'Marcá algo' }],
  requires: () => [],
}

async function radio(lines: Record<string, { file: string; hash: string }> = {}) {
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve({ lines }) }))
  vi.useFakeTimers()
  const { startRadio, useRadioStore } = await import('../../src/audio/radioPlayer')
  const { useMissionStore } = await import('../../src/game/missions/store')
  const r = await import('../../src/audio/radio')
  await startRadio()
  useMissionStore.getState().init([MINI], { sectors: [] })
  return { useRadioStore, mission: useMissionStore.getState(), ...r }
}

describe('reproductor de radio', () => {
  it('al iniciar: enlace, después el briefing; al completar, el cierre (que no se corta al cerrar la misión)', async () => {
    const { useRadioStore, mission, LINK_LINES, readMs } = await radio()
    mission.start('mini')
    expect(useRadioStore.getState().subtitle).toBe(LINK_LINES.inicio.text)
    vi.advanceTimersByTime(readMs(LINK_LINES.inicio.text))
    expect(useRadioStore.getState().line?.id).toBe('mini/briefing')
    expect(useRadioStore.getState().subtitle).toBe(MINI.briefing)
    vi.advanceTimersByTime(readMs(MINI.briefing))
    expect(useRadioStore.getState().subtitle).toBeNull() // cola vacía
    mission.report({ type: 'mark', objectiveId: 'o1', value: 'OK' })
    expect(useRadioStore.getState().line).toEqual(LINK_LINES.completada)
    mission.exit() // cerrar la misión completada
    expect(useRadioStore.getState().line).toEqual(LINK_LINES.completada)
    expect(audios).toEqual([]) // manifest vacío: sin pedidos de voz
  })
  it('salir a mitad de misión corta la radio', async () => {
    const { useRadioStore, mission } = await radio()
    mission.start('mini')
    mission.exit()
    expect(useRadioStore.getState().line).toBeNull()
  })
  it('voz con hash vigente suena; con hash de otro texto no se pide y quedan los subtítulos', async () => {
    const { lineHash, LINK_LINES } = await import('../../src/audio/radio')
    const ok = await radio({ [LINK_LINES.inicio.id]: { file: 'inicio.mp3', hash: lineHash(LINK_LINES.inicio.text) } })
    ok.mission.start('mini')
    expect(audios).toEqual([expect.stringMatching(/audio\/voice\/inicio\.mp3$/)])

    vi.resetModules()
    audios = []
    const stale = await radio({ [LINK_LINES.inicio.id]: { file: 'inicio.mp3', hash: lineHash('texto viejo') } })
    stale.mission.start('mini')
    expect(audios).toEqual([])
    expect(stale.useRadioStore.getState().subtitle).toBe(LINK_LINES.inicio.text)
  })
})

describe('localStorage bloqueado', () => {
  it('el getter que lanza SecurityError no rompe la carga del módulo ni guardar', async () => {
    vi.stubGlobal('localStorage', undefined)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError: denied')
      },
    })
    try {
      const { useAudioStore, DEFAULT_MIX, loadMix } = await import('../../src/audio/mix')
      expect(loadMix()).toEqual(DEFAULT_MIX)
      expect(() => useAudioStore.getState().toggleMute()).not.toThrow()
      expect(useAudioStore.getState().mix.muted).toBe(true)
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage
    }
  })
})
