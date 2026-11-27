import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePlayerStore } from '../player/store'
import { TRUCK } from '../vehicle/truckModel'

// Sombra de contacto bajo el personaje y la camioneta: un óvalo difuso (una textura radial) que los sigue. Es barata
// (2 draw calls, sin re-dibujar la escena) y se suma a la sombra proyectada del sol; sin ella los pies "flotan".
function blob() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, 'rgba(0,0,0,0.9)')
  r.addColorStop(0.5, 'rgba(0,0,0,0.45)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export function ContactShadows() {
  const tex = useMemo(blob, [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        opacity: 0.55,
      }),
    [tex],
  )
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const foot = useRef<THREE.Mesh>(null)
  const truck = useRef<THREE.Mesh>(null)
  useEffect(
    () => () => {
      tex.dispose()
      mat.dispose()
      geo.dispose()
    },
    [tex, mat, geo],
  )
  useFrame(() => {
    const s = usePlayerStore.getState()
    if (foot.current) {
      foot.current.visible = s.mode === 'foot' && !s.climbing
      foot.current.position.set(s.position[0], s.position[1] + 0.03, s.position[2])
    }
    if (truck.current) {
      truck.current.position.set(s.truck.position[0], s.truck.position[1] + 0.03, s.truck.position[2])
      truck.current.rotation.y = s.truck.heading
    }
  })
  return (
    <>
      <mesh ref={foot} geometry={geo} material={mat} scale={[0.95, 1, 0.95]} renderOrder={2} name="sombra_contacto_jugador" />
      <mesh
        ref={truck}
        geometry={geo}
        material={mat}
        scale={[TRUCK.halfWidth * 2 + 0.7, 1, TRUCK.halfLength * 2 + 0.9]}
        renderOrder={2}
        name="sombra_contacto_camioneta"
      />
    </>
  )
}
