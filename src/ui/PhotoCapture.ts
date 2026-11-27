import { addAfterEffect } from '@react-three/fiber'
import { photoBlob } from './share'

// Pedido pendiente: se atiende al terminar el próximo cuadro (afterEffect de r3f), cuando el canvas ya tiene la imagen:
// sin preserveDrawingBuffer solo se puede leer en la misma tarea en que se dibujó. No se usa un useFrame con prioridad:
// cualquier suscriptor con prioridad positiva cambia el orden de render y dejó la escena en blanco (QA).
let pending: { ok: (b: Blob) => void; fail: (e: unknown) => void } | null = null

export const capturePhoto = () => new Promise<Blob>((ok, fail) => (pending = { ok, fail }))

addAfterEffect(() => {
  const p = pending
  const canvas = document.querySelector('canvas')
  if (!p || !canvas) return
  pending = null
  photoBlob(canvas).then(p.ok, p.fail)
})
