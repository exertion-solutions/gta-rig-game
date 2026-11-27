import { create } from 'zustand'
import { useMissionStore } from '../game/missions/store'
import { assetUrl } from '../game/world/assetUrl'
import { busGain, useAudioStore } from './mix'
import { LINK_LINES, createRadioQueue, missionLines, readMs, splitSubtitles, voiceFile, type Line, type VoiceManifest } from './radio'

/** Subtítulo en pantalla (siempre visible mientras suena una línea). */
export const useRadioStore = create<{ line: Line | null; subtitle: string | null }>(() => ({ line: null, subtitle: null }))

// Voces opcionales: public/audio/voice/manifest.json lista { lines: { id: { file, hash } } }. Solo se pide un archivo
// listado y cuyo hash coincide con el texto actual: nunca se pide un archivo inexistente (sin 404 en consola).
let manifest: VoiceManifest = {}

const queue = createRadioQueue()
let timer: ReturnType<typeof setTimeout> | undefined
let audio: HTMLAudioElement | null = null
let chunks: string[] = []
let chunk = 0
let textDone = false
let hold = false // DEV: congela el subtítulo actual (los e2e lo miden sin depender del reloj)

function stop() {
  clearTimeout(timer)
  if (audio) {
    audio.onended = audio.onerror = null
    audio.pause()
    audio = null
  }
}

const advance = () => play(queue.next())
// La línea termina cuando se mostraron todos sus subtítulos y terminó su voz (si tenía).
const maybeDone = () => {
  if (textDone && !audio) advance()
}

function show() {
  useRadioStore.setState({ subtitle: chunks[chunk] })
  clearTimeout(timer)
  if (hold) return
  timer = setTimeout(() => {
    if (chunk + 1 < chunks.length) {
      chunk++
      show()
    } else {
      textDone = true
      maybeDone()
    }
  }, readMs(chunks[chunk]))
}

function play(line: Line | null) {
  stop()
  useRadioStore.setState({ line, subtitle: null })
  if (!line) return
  chunks = splitSubtitles(line.text)
  chunk = 0
  textDone = false
  const file = voiceFile(line, manifest)
  if (file) {
    const a = (audio = new Audio(assetUrl(`audio/voice/${file}`)))
    a.volume = busGain(useAudioStore.getState().mix, 'voice')
    const end = () => {
      if (audio !== a) return
      audio = null
      maybeDone()
    }
    a.onended = a.onerror = end
    a.play().catch(end) // sin gesto previo o sin códec: quedan los subtítulos
  }
  show()
}

function push(lines: Line[]) {
  const idle = !queue.current()
  queue.push(lines)
  if (idle) play(queue.current())
}

let started = false
/** Engancha la radio a las misiones: enlace + briefing al iniciar, cada objetivo nuevo, cierre al completar. */
export function startRadio(): Promise<void> {
  if (started) return Promise.resolve()
  started = true
  const loaded = fetch(assetUrl('audio/voice/manifest.json'))
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: { lines?: VoiceManifest }) => void (manifest = m.lines ?? {}))
    .catch(() => {})
  useAudioStore.subscribe((s) => {
    if (audio) audio.volume = busGain(s.mix, 'voice')
  })
  useMissionStore.subscribe((s, p) => {
    const m = s.mission
    const pm = p.mission
    if (m.status === 'idle') {
      // salir a mitad de misión corta la radio; cerrar la misión completada deja terminar la línea de cierre
      if (pm.status === 'active') (queue.clear(), play(null))
      return
    }
    const def = s.available.find((d) => d.id === m.missionId)
    if (!def) return
    const lines = missionLines(def)
    const fresh = m.status === 'active' && (m.missionId !== pm.missionId || pm.status !== 'active' || m.objectiveIndex < pm.objectiveIndex)
    if (fresh) {
      queue.clear()
      play(null)
      push(lines.slice(0, 2))
    } else if (m.status === 'active' && m.objectiveIndex > pm.objectiveIndex) push([lines[1 + m.objectiveIndex]])
    else if (m.status === 'completed' && pm.status !== 'completed') push([LINK_LINES.completada])
  })
  return loaded
}

/** DEV: congelar/soltar el subtítulo actual. */
export function holdRadio(on: boolean) {
  hold = on
  if (on) clearTimeout(timer)
  else if (queue.current()) show()
}
