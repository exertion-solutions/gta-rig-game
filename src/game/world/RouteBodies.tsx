import { BallCollider, CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { LIGHTS_S } from './route'
import { ANIMALS, ANIMAL_SIZE, BUILDINGS, OBSTACLES, VEHICLES, animalAt, lightPost, routeClock, vehicleAt } from './routeWorld'

// Colisión de lo que puebla la ruta (routeWorld.ts). Va en el chunk de la física. Edificios, postes y obstáculos son
// fijos; el tránsito y los animales son cuerpos cinemáticos que siguen la misma función de tiempo que su dibujo.
// Todo declarativo: crear y borrar cuerpos a mano rompía el motor con el doble montaje de React en desarrollo.
const STEP = 1 / 60
const yawQ = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
type Pose = { x: number; y: number; z: number; yaw: number }
type Mover = { half: [number, number, number]; at: (t: number) => Pose }

export function RouteBodies() {
  const movers = useMemo<Mover[]>(
    () => [
      ...VEHICLES.map((v) => ({ half: [v.wid / 2, v.hgt / 2, v.len / 2] as [number, number, number], at: (t: number) => vehicleAt(v, t) })),
      ...ANIMALS.map((a) => {
        const [w, h, l] = ANIMAL_SIZE[a.kind]
        return { half: [(w * a.scale) / 2, (h * a.scale) / 2, (l * a.scale) / 2] as [number, number, number], at: (t: number) => animalAt(a, t) }
      }),
    ],
    [],
  )
  const bodies = useRef<(RapierRigidBody | null)[]>([])

  useBeforePhysicsStep(() => {
    routeClock.t += STEP
    movers.forEach((m, i) => {
      const rb = bodies.current[i]
      if (!rb) return
      const p = m.at(routeClock.t)
      rb.setNextKinematicTranslation({ x: p.x, y: p.y + m.half[1], z: p.z })
      rb.setNextKinematicRotation(yawQ(p.yaw))
    })
  })

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {BUILDINGS.map((b, i) => (
          <CuboidCollider key={`e${i}`} args={[b.d / 2, b.h / 2 + 1, b.w / 2]} position={[b.x, b.y + b.h / 2 - 1, b.z]} rotation={[0, b.yaw, 0]} />
        ))}
        {LIGHTS_S.map((s, i) => {
          const p = lightPost(i)
          return <CuboidCollider key={`s${s}`} args={[0.1, 2.6, 0.1]} position={[p.x, p.y + 2.6, p.z]} />
        })}
        {OBSTACLES.map((o, i) =>
          o.kind === 'roca' ? (
            <BallCollider key={`o${i}`} args={[o.r]} position={[o.x, o.y + o.r * 0.5, o.z]} />
          ) : o.kind === 'cono' ? (
            <CuboidCollider key={`o${i}`} args={[0.2, 0.35, 0.2]} position={[o.x, o.y + 0.35, o.z]} />
          ) : o.kind === 'valla' ? (
            <CuboidCollider key={`o${i}`} args={[0.9, 0.5, 0.08]} position={[o.x, o.y + 0.6, o.z]} rotation={[0, o.yaw, 0]} />
          ) : null, // el guardaganado no frena: es una franja a nivel de la calzada
        )}
      </RigidBody>
      {movers.map((m, i) => {
        const p = m.at(0)
        return (
          <RigidBody key={i} ref={(rb) => void (bodies.current[i] = rb)} type="kinematicPosition" colliders={false} position={[p.x, p.y + m.half[1], p.z]} rotation={[0, p.yaw, 0]}>
            <CuboidCollider args={m.half} />
          </RigidBody>
        )
      })}
    </>
  )
}
