import { addAfterEffect } from '@react-three/fiber'
import { clipDone, clipSecondsLeft, drawWatermark, pickClipMime } from './share'

/** ¿Este navegador puede grabar el canvas? Devuelve el mimeType o null. */
export function clipSupport(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return pickClipMime((t) => MediaRecorder.isTypeSupported(t))
}

/**
 * Graba hasta CLIP_MS del canvas del juego. Dibuja juego + marca de agua en un canvas 2D auxiliar y graba ese: la marca
 * queda dentro del video. El dibujo va en el afterEffect de r3f (igual que PhotoCapture): el canvas WebGL sin
 * preserveDrawingBuffer solo se puede leer en la tarea en que se dibujó, un rAF suelto lo leería en blanco.
 */
export function recordClip(src: HTMLCanvasElement, mime: string, onTick: (left: number) => void): { done: Promise<Blob>; stop: () => void } {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const t0 = performance.now()
  let last = -1
  const stop = () => rec.state !== 'inactive' && rec.stop()
  const off = addAfterEffect(() => {
    const el = performance.now() - t0
    ctx.drawImage(src, 0, 0, c.width, c.height)
    drawWatermark(ctx, c.width, c.height)
    const left = clipSecondsLeft(el)
    if (left !== last) onTick((last = left))
    if (clipDone(el)) stop()
  })
  const done = new Promise<Blob>((ok, fail) => {
    rec.onstop = () => (off(), chunks.length ? ok(new Blob(chunks, { type: mime })) : fail(new Error('sin datos')))
    rec.onerror = () => (off(), fail(new Error('error de grabación')))
  })
  rec.start(1000)
  return { done, stop }
}
