import { create } from 'zustand'
import { exposeGame } from './dev'

// Calidad gráfica Alta/Media/Baja con degradación automática. pickQuality decide por el promedio de una ventana de
// cuadros (el "sostenido" lo da la ventana, ver createGovernor); la banda 10–20 ms no cambia nada (histéresis).
export type Quality = 'high' | 'medium' | 'low'
const ORDER: Quality[] = ['low', 'medium', 'high']
export const DOWN_MS = 20 // baja si el promedio supera esto
export const UP_MS = 10 // sube solo si el promedio queda por debajo de esto (margen amplio)

export function pickQuality(avgFrameMs: number, current: Quality): Quality {
  const i = ORDER.indexOf(current)
  if (avgFrameMs > DOWN_MS + 1e-6) return ORDER[Math.max(i - 1, 0)]
  if (avgFrameMs < UP_MS) return ORDER[Math.min(i + 1, ORDER.length - 1)]
  return current
}

// shadowMap: lado del mapa de sombra del sol; dpr: tope de la densidad de píxeles; post: bloom + mapeo de tonos por pase.
export const QUALITY_PROFILE: Record<Quality, { shadows: boolean; shadowMap: number; post: boolean; dpr: number }> = {
  high: { shadows: true, shadowMap: 2048, post: true, dpr: 2 },
  medium: { shadows: true, shadowMap: 1024, post: false, dpr: 1.25 },
  low: { shadows: false, shadowMap: 1024, post: false, dpr: 1 },
}

/** Promedia ventanas de cuadros y decide el nivel. Un nivel que se abandonó por lento no se vuelve a probar (no oscila). */
export function createGovernor(initial: Quality, opts: { window?: number; warmup?: number } = {}) {
  const WINDOW = opts.window ?? 90
  let warmup = opts.warmup ?? 30 // los primeros cuadros compilan shaders y cargan texturas: no cuentan
  let quality = initial
  let auto = true
  let sum = 0
  let n = 0
  const banned = new Set<Quality>()
  return {
    get quality() {
      return quality
    },
    get auto() {
      return auto
    },
    setAuto(v: boolean) {
      auto = v
      sum = n = 0
    },
    set(q: Quality) {
      quality = q
      auto = false
      sum = n = 0
    },
    /** Un cuadro de `ms` milisegundos. Devuelve el nivel nuevo si cambió, o null. */
    push(ms: number): Quality | null {
      if (!auto) return null
      if (warmup > 0) {
        warmup--
        return null
      }
      sum += Math.min(ms, 250) // una pausa de pestaña no cuenta como 10 s de lentitud
      if (++n < WINDOW) return null
      const next = pickQuality(sum / n, quality)
      sum = n = 0
      if (next === quality) return null
      if (ORDER.indexOf(next) < ORDER.indexOf(quality)) banned.add(quality)
      else if (banned.has(next)) return null
      quality = next
      return next
    },
  }
}

/** `?quality=high|medium|low` fija el nivel (sin degradación automática); `auto` o nada = automática desde Alta. */
export function parseQualityParam(search: string): {
  quality: Quality
  auto: boolean
} {
  const v = new URLSearchParams(search).get('quality')
  return v === 'high' || v === 'medium' || v === 'low' ? { quality: v, auto: false } : { quality: 'high', auto: true }
}

const init = parseQualityParam(typeof window === 'undefined' ? '' : window.location.search)
const governor = createGovernor(init.quality)
governor.setAuto(init.auto)

type QualityState = {
  quality: Quality
  auto: boolean
  set(q: Quality): void
  setAuto(v: boolean): void
}
export const useQualityStore = create<QualityState>((set) => ({
  quality: init.quality,
  auto: init.auto,
  set: (q) => {
    governor.set(q)
    set({ quality: q, auto: false })
  },
  setAuto: (v) => {
    governor.setAuto(v)
    set({ auto: v })
  },
}))

/** Un cuadro medido (lo llama QualityMonitor): actualiza el store si la degradación automática cambió de nivel. */
export function reportFrame(ms: number) {
  const next = governor.push(ms)
  if (next) useQualityStore.setState({ quality: next })
}

/** Calidad actual y cómo fijarla a mano (fijarla apaga la degradación automática). */
export function useQuality(): { quality: Quality; set(q: Quality): void } {
  const quality = useQualityStore((s) => s.quality)
  const set = useQualityStore((s) => s.set)
  return { quality, set }
}

if (typeof window !== 'undefined')
  exposeGame({
    getQuality: () => ({
      quality: useQualityStore.getState().quality,
      auto: useQualityStore.getState().auto,
    }),
    setQuality: (q: Quality) => useQualityStore.getState().set(q),
    setQualityAuto: () => useQualityStore.getState().setAuto(true),
    // FPS simulados bajos: `n` cuadros de `ms` ms por el mismo camino que los reales
    feedFrameMs: (ms: number, n: number) => {
      for (let i = 0; i < n; i++) reportFrame(ms)
    },
  })
