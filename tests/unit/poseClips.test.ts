import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { GRAVITY, JUMP } from '../../src/game/player/jump'
import { LAND_MS } from '../../src/game/player/characterAnim'
import { CLIMB_KEYS, JUMP_KEYS, LAND_KEYS, poseClip } from '../../src/game/player/poseClips'

// Esqueleto mínimo como el del GLB: armadura en cm (escala 0,01) girada, pelvis > muslo colgando hacia abajo.
function rig() {
  const root = new THREE.Group()
  const arm = new THREE.Object3D()
  arm.name = 'Armature'
  arm.scale.setScalar(0.01)
  arm.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2) // ejes locales distintos a los del modelo
  const pelvis = new THREE.Bone()
  pelvis.name = 'Bip01_Pelvis'
  pelvis.position.set(0, -100, 0)
  const thigh = new THREE.Bone()
  thigh.name = 'Bip01_L_Thigh'
  const knee = new THREE.Object3D()
  knee.position.set(40, 0, 0) // en local del muslo; con el giro de la armadura cuelga hacia -Y del modelo
  root.add(arm)
  arm.add(pelvis)
  pelvis.add(thigh)
  thigh.add(knee)
  const q = [0, 0, 0, 1]
  const base = new THREE.AnimationClip('idle', 1, [
    new THREE.VectorKeyframeTrack('Bip01_Pelvis.position', [0, 1], [0, -100, 0, 0, -100, 0]),
    new THREE.QuaternionKeyframeTrack('Bip01_Pelvis.quaternion', [0, 1], [...q, ...q]),
    new THREE.QuaternionKeyframeTrack('Bip01_L_Thigh.quaternion', [0, 1], [...q, ...q]),
    new THREE.VectorKeyframeTrack('Bip01_L_Thigh.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
  ])
  return { root, knee, pelvis, base }
}

const at = (root: THREE.Object3D, clip: THREE.AnimationClip, t: number) => {
  const m = new THREE.AnimationMixer(root)
  const a = m.clipAction(clip).setLoop(THREE.LoopOnce, 1)
  a.clampWhenFinished = true
  a.play()
  m.setTime(t)
  root.updateMatrixWorld(true)
}

describe('poseClip', () => {
  it('flexionar la cadera (rx < 0) lleva la rodilla hacia adelante (+Z) en el espacio del modelo', () => {
    const { root, knee, base } = rig()
    const clip = poseClip('t', root, base, [{ t: 0, rx: {} }, { t: 1, rx: { Bip01_L_Thigh: -90 } }])
    at(root, clip, 1)
    const p = knee.getWorldPosition(new THREE.Vector3()).sub(knee.parent!.getWorldPosition(new THREE.Vector3()))
    expect(p.z).toBeGreaterThan(0.39)
    expect(Math.abs(p.y)).toBeLessThan(0.01)
  })

  it('drop baja la pelvis en metros del modelo aunque la armadura esté en cm y girada', () => {
    const { root, pelvis, base } = rig()
    const y0 = pelvis.getWorldPosition(new THREE.Vector3()).y
    const clip = poseClip('t', root, base, [{ t: 0, rx: {} }, { t: 1, drop: 0.1, rx: {} }])
    at(root, clip, 1)
    expect(pelvis.getWorldPosition(new THREE.Vector3()).y - y0).toBeCloseTo(-0.1, 5)
  })

  it('conserva todas las pistas de la base (ningún hueso vuelve a la T-pose)', () => {
    const { root, base } = rig()
    const clip = poseClip('jump', root, base, JUMP_KEYS)
    expect(clip.tracks.map((t) => t.name)).toEqual(base.tracks.map((t) => t.name))
    expect(clip.validate()).toBe(true)
  })

  it('salto: termina en pose de caída antes de tocar el suelo (sin agachado en el aire); el aterrizaje es otro clip', () => {
    const flight = (2 * JUMP.velocity) / GRAVITY
    const end = JUMP_KEYS.at(-1)!
    expect(end.t).toBeLessThan(flight) // queda clavado en `end` si el vuelo dura más (borde, plataforma baja)
    expect(end.drop ?? 0).toBe(0)
    expect(LAND_KEYS[0].rx).toEqual(end.rx) // el aterrizaje arranca desde la pose de caída
    expect(Math.max(...LAND_KEYS.map((k) => k.drop ?? 0))).toBeGreaterThan(0.05)
    expect(Math.round(LAND_KEYS.at(-1)!.t * 1000)).toBe(LAND_MS)
    expect(CLIMB_KEYS.at(-1)!.rx).toEqual(CLIMB_KEYS[0].rx)
  })

  it('cada hueso de las claves existe en worker.glb y tiene pista en idle (un nombre mal escrito falla)', () => {
    const b = readFileSync('public/models/character/worker.glb')
    const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'))
    const san = (n: string) => n.replace(/\s/g, '_')
    const idle = j.animations.find((a: { name: string }) => a.name === 'idle')
    const rotated = new Set(
      idle.channels.filter((c: { target: { path: string } }) => c.target.path === 'rotation').map((c: { target: { node: number } }) => san(j.nodes[c.target.node].name)),
    )
    const used = new Set([...JUMP_KEYS, ...LAND_KEYS, ...CLIMB_KEYS].flatMap((k) => Object.keys(k.rx)))
    expect(used.size).toBeGreaterThan(10)
    for (const n of used) expect(rotated, n).toContain(n)
  })
})
