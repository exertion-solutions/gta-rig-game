import * as THREE from 'three'

// Clips de salto y trepar generados en código sobre el esqueleto Rocketbox (sin archivo nuevo ni licencia aparte):
// parten del primer cuadro de 'idle' y giran huesos alrededor del eje lateral X del modelo (mira a +Z).
// rx en grados: + inclina la parte de arriba hacia adelante (tronco adelante, pierna/brazo colgante hacia atrás);
// flexionar cadera / alzar brazo = rx negativo; flexionar rodilla = rx positivo.
export type PoseKey = { t: number; drop?: number; rx: Record<string, number> } // drop: m que baja la pelvis
const X = new THREE.Vector3(1, 0, 0)
const PELVIS = 'Bip01_Pelvis'

// Agacharse con los pies quietos: cadera -a, rodilla +2a, tobillo -a y la pelvis baja (muslo + pierna)·(1 - cos a).
const LEG = 0.8 // m, muslo 0,40 + pierna 0,40 del avatar
function crouch(a: number, rx: Record<string, number> = {}): Omit<PoseKey, 't'> {
  const legs: Record<string, number> = {}
  for (const s of ['L', 'R']) Object.assign(legs, { [`Bip01_${s}_Thigh`]: -a, [`Bip01_${s}_Calf`]: 2 * a, [`Bip01_${s}_Foot`]: -a })
  return { drop: LEG * (1 - Math.cos((a * Math.PI) / 180)), rx: { ...legs, ...rx } }
}
const arms = (up: number, fore: number) => ({
  Bip01_L_UpperArm: up, Bip01_R_UpperArm: up, Bip01_L_Forearm: fore, Bip01_R_Forearm: fore,
})

// Salto ≈ 0,63 s de vuelo (v 3,1 m/s, ápice 0,49 m): impulso agachado con brazos atrás, extensión con brazos arriba,
// piernas recogidas en el ápice (0,32 s), preparación y aterrizaje amortiguado (agachado) justo al tocar el suelo.
export const JUMP_KEYS: PoseKey[] = [
  { t: 0, ...crouch(10, { Bip01_Spine1: 8, ...arms(20, -10) }) },
  { t: 0.07, ...crouch(28, { Bip01_Spine1: 18, ...arms(40, -15) }) },
  { t: 0.17, rx: { Bip01_L_Foot: 25, Bip01_R_Foot: 25, Bip01_Spine1: -3, ...arms(-110, -20) } },
  {
    t: 0.34,
    rx: {
      Bip01_L_Thigh: -65, Bip01_L_Calf: 95, Bip01_L_Foot: 10, Bip01_R_Thigh: -50, Bip01_R_Calf: 85, Bip01_R_Foot: 10,
      Bip01_Spine1: 12, ...arms(-70, -45),
    },
  },
  { t: 0.52, rx: { Bip01_L_Thigh: -30, Bip01_L_Calf: 40, Bip01_R_Thigh: -25, Bip01_R_Calf: 35, Bip01_Spine1: 8, ...arms(-45, -25) } },
  { t: 0.64, ...crouch(25, { Bip01_Spine1: 15, ...arms(-30, -30) }) },
]

// Trepar mano sobre mano: brazo alto y pierna opuesta alta, alternando. Ciclo 0,6 s ≈ 0,7 m a CLIMB_SPEED 1,2 m/s.
const reach = (h: 'L' | 'R') => {
  const o = h === 'L' ? 'R' : 'L'
  return {
    Bip01_Spine1: 5,
    [`Bip01_${h}_UpperArm`]: -165, [`Bip01_${h}_Forearm`]: -15, [`Bip01_${o}_UpperArm`]: -110, [`Bip01_${o}_Forearm`]: -60,
    [`Bip01_${o}_Thigh`]: -75, [`Bip01_${o}_Calf`]: 100, [`Bip01_${o}_Foot`]: -10, [`Bip01_${h}_Thigh`]: -20, [`Bip01_${h}_Calf`]: 35,
  }
}
export const CLIMB_KEYS: PoseKey[] = [{ t: 0, rx: reach('R') }, { t: 0.3, rx: reach('L') }, { t: 0.6, rx: reach('R') }]

/** Clip con TODAS las pistas de `base` (sin huesos sueltos que caigan a la pose de reposo / T-pose) tomadas de su primer
 * cuadro y modificadas por `keys`. Deja `root` en la pose base. */
export function poseClip(name: string, root: THREE.Object3D, base: THREE.AnimationClip, keys: PoseKey[]): THREE.AnimationClip {
  const bound = base.tracks.map((tr) => {
    const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(tr.name)
    const node = root.getObjectByName(nodeName!)
    const prop = node && (node as unknown as Record<string, THREE.Vector3 | THREE.Quaternion>)[propertyName]
    if (prop) prop.fromArray(tr.values, 0)
    return { tr, node, nodeName: nodeName!, propertyName }
  })
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const times = keys.map((k) => k.t)
  const tracks = bound.map(({ tr, node, nodeName, propertyName }) => {
    const n = tr.getValueSize()
    const v0 = Array.from(tr.values.slice(0, n))
    const parent = node?.parent
    const vals = keys.flatMap((k) => {
      if (!parent) return v0
      const rel = inv.clone().multiply(parent.matrixWorld) // padre en el espacio del modelo
      if (propertyName === 'quaternion' && k.rx[nodeName]) {
        const P = new THREE.Quaternion()
        rel.decompose(new THREE.Vector3(), P, new THREE.Vector3()) // con escala (armadura en cm): no setFromRotationMatrix
        const R = new THREE.Quaternion().setFromAxisAngle(X, (k.rx[nodeName] * Math.PI) / 180)
        return P.clone().invert().multiply(R).multiply(P).multiply(new THREE.Quaternion().fromArray(v0)).toArray()
      }
      if (propertyName === 'position' && nodeName === PELVIS && k.drop) {
        const p = new THREE.Vector3().fromArray(v0).applyMatrix4(rel)
        p.y -= k.drop
        return p.applyMatrix4(rel.clone().invert()).toArray()
      }
      return v0
    })
    const T = propertyName === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack
    return new T(tr.name, times, vals)
  })
  return new THREE.AnimationClip(name, keys[keys.length - 1].t, tracks)
}
