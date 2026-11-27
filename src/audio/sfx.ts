import { assetUrl } from '../game/world/assetUrl'
import { busGain, useAudioStore } from './mix'
import { engineParams } from './params'

// Efectos 100 % procedurales (WebAudio, sin archivos). El AudioContext se crea recién con un gesto del usuario
// (política de autoplay); antes de eso, y si el navegador no tiene WebAudio, todo es no-op.
let ctx: AudioContext | null = null
let sfxBus: GainNode | null = null
let ambBus: GainNode | null = null
let noise: AudioBuffer | null = null
let engine: { osc: OscillatorNode; gain: GainNode; speed: number } | null = null
const ENGINE_EPS = 0.05 // m/s: por debajo de este cambio no se reprograma el AudioParam (una vez por cuadro como máximo)

const applyMix = () => {
  if (!ctx || !sfxBus || !ambBus) return
  const m = useAudioStore.getState().mix
  sfxBus.gain.setTargetAtTime(busGain(m, 'sfx'), ctx.currentTime, 0.03)
  ambBus.gain.setTargetAtTime(busGain(m, 'ambient'), ctx.currentTime, 0.03)
}

/** Crea (o reanuda) el AudioContext. Llamar desde un gesto del usuario. */
export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {})
    return
  }
  const AC = globalThis.AudioContext
  if (!AC) return
  try {
    ctx = new AC()
  } catch {
    return
  }
  sfxBus = ctx.createGain()
  ambBus = ctx.createGain()
  sfxBus.connect(ctx.destination)
  ambBus.connect(ctx.destination)
  sfxBus.gain.value = ambBus.gain.value = 0
  applyMix()
  useAudioStore.subscribe(applyMix)
  // 2 s de ruido blanco: base de pasos, golpes y el viento del ambiente
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  startAmbient()
  // pestaña oculta: el contexto se suspende (sin CPU de audio)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ctx?.suspend().catch(() => {})
    else ctx?.resume().catch(() => {})
  })
}

export const audioRunning = () => ctx?.state === 'running'

/** Ráfaga de ruido filtrado con caída exponencial. */
function burst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass', delay = 0) {
  if (!ctx || !noise || !sfxBus) return
  const t = ctx.currentTime + delay
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f).connect(g).connect(sfxBus)
  src.start(t, Math.random() * 1.5, dur)
}

/** Tono con barrido de frecuencia y caída exponencial. */
function tone(f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'triangle', delay = 0) {
  if (!ctx || !sfxBus) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(sfxBus)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Ambiente leve de locación: viento (ruido en bucle por un pasabajos). */
function startAmbient() {
  if (!ctx || !noise || !ambBus) return
  const c = ctx
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 350
  const g = ctx.createGain()
  g.gain.value = 0.25
  src.connect(f).connect(g).connect(ambBus)
  src.start()
  loadAmbientLoop(c, src)
}

/** Viento y rig lejano generados con ffmpeg (public/audio/ambient): reemplaza al viento procedural cuando se decodifica; si falla, sigue el procedural. */
async function loadAmbientLoop(c: AudioContext, wind: AudioBufferSourceNode) {
  try {
    const r = await fetch(assetUrl('audio/ambient/rig-lejano.mp3'))
    if (!r.ok) return
    const buffer = await c.decodeAudioData(await r.arrayBuffer())
    if (c !== ctx || !ambBus) return
    const src = c.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const g = c.createGain()
    g.gain.value = 0.7 // el volumen real lo fija el bus ambiente (maestro x ambiente, mute)
    src.connect(g).connect(ambBus)
    src.start()
    wind.stop()
  } catch {
    /* sin archivo o sin códec: queda el viento procedural */
  }
}

export const sfx = {
  step: () => burst(0.07, 900 + Math.random() * 400, 0.35),
  jump: () => (burst(0.06, 600, 0.3), tone(180, 260, 0.12, 0.08)),
  land: () => burst(0.16, 380, 0.7),
  door: () => (burst(0.1, 700, 0.5), tone(95, 55, 0.18, 0.3, 'sine')),
  valve: () => (tone(520, 360, 0.35, 0.07, 'sawtooth'), burst(0.05, 2200, 0.2, 'bandpass', 0.3)),
  rung: () => (tone(1250, 1150, 0.07, 0.08), burst(0.04, 3000, 0.12, 'highpass')),
  notify(kind: 'mission' | 'objective' | 'completed') {
    const notes = kind === 'mission' ? [660, 880] : kind === 'objective' ? [880] : [523, 659, 784]
    notes.forEach((n, i) => tone(n, n * 1.001, 0.22, 0.12, 'sine', i * 0.13))
  },
  /** Motor según la rapidez (m/s); null lo apaga (a pie no queda ningún oscilador corriendo). */
  engine(speed: number | null) {
    if (!ctx || !sfxBus) return
    if (speed === null) {
      if (!engine) return
      const e = engine
      engine = null
      e.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
      e.osc.stop(ctx.currentTime + 0.5)
      return
    }
    if (!engine) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 380
      const gain = ctx.createGain()
      gain.gain.value = 0
      osc.connect(f).connect(gain).connect(sfxBus)
      osc.start()
      engine = { osc, gain, speed: Number.NaN }
    }
    if (Math.abs(speed - engine.speed) < ENGINE_EPS) return
    engine.speed = speed
    const p = engineParams(speed)
    engine.osc.frequency.setTargetAtTime(p.freq, ctx.currentTime, 0.1)
    engine.gain.gain.setTargetAtTime(p.gain * 0.35, ctx.currentTime, 0.1)
  },
}
