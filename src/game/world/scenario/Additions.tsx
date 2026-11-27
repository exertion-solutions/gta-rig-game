import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../../dev'
import { assetUrl } from '../assetUrl'

// Escenario ilustrativo añadido por el juego, no as-built (docs/scenario-additions.md): escalera de la pasarela,
// baranda de la rampa de la V y escalera vertical al piso de enganche. 3 mallas (una por material).
const URL = assetUrl('models/scenario/additions.glb')
useGLTF.preload(URL)

export function ScenarioAdditions() {
  const { scene } = useGLTF(URL)
  return <primitive object={scene} name="escenario_adiciones" />
}

// Oráculos DEV para e2e: miden lo que se dibuja (vértices de mundo), sin pasar por los colliders.
export function SceneProbes() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const meshesOf = (id: string) => {
      const out: THREE.Mesh[] = []
      scene.getObjectByName(id)?.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh))
      return out
    }
    exposeGame({
      // bbox de los vértices de la pieza `id` dentro de la caja [min, max] (mundo)
      renderedBoundsIn: (id: string, min: number[], max: number[]) => {
        const region = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))
        const b = new THREE.Box3()
        const v = new THREE.Vector3()
        for (const m of meshesOf(id)) {
          m.updateWorldMatrix(true, false)
          const pos = m.geometry.attributes.position
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
            if (region.containsPoint(v)) b.expandByPoint(v)
          }
        }
        return b.isEmpty() ? null : { min: b.min.toArray(), max: b.max.toArray() }
      },
      // altura de la superficie visible más alta bajo (x, z) entre las piezas `ids`, por debajo de `below`
      surfaceY: (x: number, z: number, ids: string[], below = 60) => {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, below, z), new THREE.Vector3(0, -1, 0))
        const hit = ray.intersectObjects(ids.flatMap(meshesOf), false)[0]
        return hit ? hit.point.y : null
      },
      // primer punto visible de las piezas `ids` sobre el rayo o + t·d
      rayHit: (o: number[], d: number[], ids: string[]) => {
        const ray = new THREE.Raycaster(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize())
        const hit = ray.intersectObjects(ids.flatMap(meshesOf), false)[0]
        return hit ? hit.point.toArray() : null
      },
      renderInfo:() => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }),
    })
  }, [scene, gl])
  return null
}
