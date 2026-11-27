import { useFrame } from '@react-three/fiber'
import { photoBlob } from './share'

// Pedido pendiente: se atiende en el cuadro siguiente, DESPUÉS del posproceso (prioridad 2): sin preserveDrawingBuffer
// el canvas solo se puede leer en la misma tarea en que se dibujó.
let pending: { ok: (b: Blob) => void; fail: (e: unknown) => void } | null = null

export const capturePhoto = () => new Promise<Blob>((ok, fail) => (pending = { ok, fail }))

export function PhotoCapture() {
  useFrame(({ gl }) => {
    const p = pending
    if (!p) return
    pending = null
    photoBlob(gl.domElement).then(p.ok, p.fail)
  }, 2)
  return null
}
