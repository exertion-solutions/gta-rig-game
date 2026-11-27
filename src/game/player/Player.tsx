import { useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { clampPitch } from '../camera/followCamera'
import { exposeGame } from '../dev'
import { useMissionStore } from '../missions/store'
import { eBelongsToTruck } from '../vehicle/enterExit'
import { LOCACION_BOUNDS } from '../world/frame'
import { PLAYER_GROUPS } from '../world/groups'
import { nearestInteractable, useValveStore } from '../world/interactables'
import { INTERACTABLES, LADDERS, MAX_MEASURED_SLOPE_DEG, type LadderVolume } from '../world/walkable'
import { WALK_ON_REACH, climbStep, ladderEndNear, ladderFeet, ladderLength, ladderRelease } from './climb'
import { stepVertical, type VState } from './jump'
import { PLAYER_RADIUS, RESPAWN, STEP_MAX, atLimit, respawnPoint, stepMovement, trackSafe, type Vec3 } from './movement'
import { CharacterModel } from './CharacterModel'
import { keys, onKeysCleared } from './keys'
import { teleportTo, usePlayerStore } from './store'
import { playerAction, playerSpeed } from './telemetry'

const HALF = 0.55 // semi-largo del cilindro: 2*0.55 + 2*PLAYER_RADIUS = 1.8 m de alto
const FOOT = HALF + PLAYER_RADIUS // centro de la cápsula sobre los pies
const FIXED_DT = 1 / 60 // = timeStep por defecto de <Physics>
// Pendiente máxima: la mayor medida (escalera del trip tank, 43,4°) + 1° de tolerancia numérica; la casilla (54°) queda fuera.
const MAX_SLOPE_DEG = MAX_MEASURED_SLOPE_DEG + 1
const HAND_Y = 1.0 // altura de las manos sobre los pies (juego) para el alcance de una válvula
const OPERATE_MS = 1500 // duración del clip de operar tras pulsar E (juego)
const FACING_COS = 0.7 // W engancha la escalera solo mirando hacia ella
// Pulsaciones pendientes (se consumen en el paso de física). Con un panel abierto el Hud corta las teclas antes.
const pending = { jump: false, use: false }
let steps = 0 // pasos de física del jugador (DEV: los e2e esperan pasos reales, no tiempo)
// DEV: último salto medido en el paso de física (no por muestreo de cuadros): altura inicial, ápice y cortes de subida
const jumpLog = { y0: 0, apex: 0, cuts: [] as { vy: number; want: number; got: number }[] }
let override: { x: number; z: number; run: boolean } | null = null // solo lo usa window.__game (tests)
// cuerpo del jugador: la cámara de seguimiento lo excluye de su raycast
export const playerBody: { current: RapierRigidBody | null } = { current: null }

const readInput = () =>
  override ?? {
    x: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
    z: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  }

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const { world } = useRapier()
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const vs = useRef<VState>({ vy: 0, airMs: 0 })
  const grounded = useRef(true)
  const safe = useRef<Vec3>(RESPAWN)
  const climb = useRef<{ ladder: LadderVolume; p: number } | null>(null)
  const ctl = useRef<ReturnType<typeof world.createCharacterController> | null>(null)

  useEffect(() => {
    const c = world.createCharacterController(0.01) // en el efecto: StrictMode lo monta/desmonta dos veces
    ctl.current = c
    c.enableAutostep(STEP_MAX, 0.1, false)
    c.enableSnapToGround(0.3)
    c.setMaxSlopeClimbAngle((MAX_SLOPE_DEG * Math.PI) / 180)
    return () => {
      ctl.current = null
      world.removeCharacterController(c)
    }
  }, [world])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.add(e.code)
      if (e.repeat || usePlayerStore.getState().mode !== 'foot') return // en la camioneta Espacio es freno y E la maneja Truck
      if (e.code === 'Space') pending.jump = true
      if (e.code === 'KeyE') pending.use = true
    }
    const up = (e: KeyboardEvent) => keys.delete(e.code)
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return
      // mouse arriba (movementY < 0) baja la cámara => mira hacia arriba
      usePlayerStore.setState((s) => ({ yaw: s.yaw - e.movementX * 0.002, pitch: clampPitch(s.pitch + e.movementY * 0.002) }))
    }
    const lock = () => void gl.domElement.requestPointerLock?.()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    const offClear = onKeysCleared(() => void (pending.jump = pending.use = false))
    document.addEventListener('mousemove', move)
    gl.domElement.addEventListener('click', lock)
    exposeGame({
      getPosition: () => usePlayerStore.getState().position,
      setYaw: (yaw: number) => usePlayerStore.setState({ yaw }),
      setInput: (i: { x: number; z: number; run: boolean } | null) => (override = i),
      // límites de la pieza tal como se dibuja (sin colliders de por medio), para verificar alineación en el navegador
      renderedBounds: (id: string) => {
        const o = scene.getObjectByName(id)
        if (!o) return null
        const b = new THREE.Box3().setFromObject(o)
        return { min: b.min.toArray(), max: b.max.toArray() }
      },
      teleport: (p: Vec3) => {
        // también la próxima traslación cinemática: si no, el paso pendiente devolvía el cuerpo al punto anterior
        body.current?.setTranslation({ x: p[0], y: p[1] + FOOT, z: p[2] }, true)
        body.current?.setNextKinematicTranslation({ x: p[0], y: p[1] + FOOT, z: p[2] })
        vs.current = { vy: 0, airMs: 0 }
        climb.current = null
        playerAction.climbing = false
        usePlayerStore.setState({ climbing: false })
        teleportTo(p)
      },
      jump: () => void (pending.jump = true),
      interact: () => void (pending.use = true),
      climbState: () => (climb.current ? { ladderId: climb.current.ladder.id, progress: climb.current.p } : null),
      isGrounded: () => grounded.current,
      steps: () => steps,
      jumpStats: () => ({ rise: jumpLog.apex - jumpLog.y0, cuts: jumpLog.cuts }),
      lastSafe: () => safe.current,
      valveState: (id: string) => useValveStore.getState().states[id] ?? null,
      nearInteractable: () => useValveStore.getState().near,
      // inyección de falla (solo e2e): cambia el modo sin las reglas de toggleMode, para probar que bajar nunca re-cuelga
      forceMode: (mode: 'foot' | 'truck') =>
        usePlayerStore.setState((s) => ({ mode, position: mode === 'truck' ? s.truck.position : [s.truck.position[0] - 2.2, s.truck.position[1], s.truck.position[2]] })),
    })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      offClear()
      document.removeEventListener('mousemove', move)
      gl.domElement.removeEventListener('click', lock)
    }
  }, [gl, scene])

  // Al subir a la camioneta el cuerpo del jugador se desactiva (CharacterModel se oculta solo); al bajar reaparece donde indica el store.
  useEffect(
    () =>
      usePlayerStore.subscribe((s, prev) => {
        if (s.mode === prev.mode) return
        // Cualquier cambio de modo suelta la escalera: al bajar de la camioneta nunca vuelve a quedar colgado.
        climb.current = null
        playerAction.climbing = false
        if (s.climbing || s.atLimit) usePlayerStore.setState({ climbing: false, atLimit: false })
        const rb = body.current
        if (!rb) return
        if (s.mode === 'truck') return rb.setEnabled(false)
        rb.setTranslation({ x: s.position[0], y: s.position[1] + FOOT, z: s.position[2] }, true)
        rb.setNextKinematicTranslation({ x: s.position[0], y: s.position[1] + FOOT, z: s.position[2] })
        vs.current = { vy: 0, airMs: 0 }
        rb.setEnabled(true)
      }),
    [],
  )

  // Movimiento en el paso fijo de Rapier (timeStep 1/60): rb.translation() está al día en cada llamada,
  // así la velocidad no depende de los fps (antes, a >60 fps se movía desde una base vieja).
  useBeforePhysicsStep(() => {
    const rb = body.current
    const c = ctl.current
    if (!rb || !c || usePlayerStore.getState().mode === 'truck') {
      pending.jump = pending.use = false
      return void (playerSpeed.current = 0)
    }
    steps++
    const dt = FIXED_DT
    const input = readInput()
    const { yaw, position } = usePlayerStore.getState()
    const place = (p: Vec3) => {
      const t = { x: p[0], y: p[1] + FOOT, z: p[2] }
      rb.setTranslation(t, true)
      rb.setNextKinematicTranslation(t)
    }
    const use = pending.use
    const jump = pending.jump
    pending.use = pending.jump = false

    // Modo escalera: cinemático a lo largo del LadderVolume (sin colisión); se suelta en los extremos.
    const cl = climb.current
    if (cl) {
      const dir = Math.sign(input.z)
      const p = climbStep(cl.p, dir, dt, ladderLength(cl.ladder))
      const end = (p === 1 && dir > 0) || (use && cl.p === 1) ? 'top' : (p === 0 && dir < 0) || (use && cl.p === 0) ? 'bottom' : null
      playerSpeed.current = 0
      playerAction.climbMoving = p !== cl.p
      playerAction.climbDir = Math.sign(p - cl.p)
      if (end) {
        const q = ladderRelease(cl.ladder, end)
        climb.current = null
        playerAction.climbing = false
        usePlayerStore.setState({ climbing: false })
        vs.current = { vy: 0, airMs: 0 }
        grounded.current = true
        place(q)
        return void usePlayerStore.setState({ position: q })
      }
      cl.p = p
      const atEnd = p <= 1e-6 || p >= 1 - 1e-6 // solo en un extremo E suelta la escalera (a mitad no: caería)
      if (usePlayerStore.getState().climbAtEnd !== atEnd) usePlayerStore.setState({ climbAtEnd: atEnd })
      const q = ladderFeet(cl.ladder, p)
      rb.setNextKinematicTranslation({ x: q[0], y: q[1] + FOOT, z: q[2] })
      return void usePlayerStore.setState({ position: q })
    }

    // E (o W mirando hacia la escalera, desde abajo) engancha la escalera; E opera la válvula al alcance.
    // Si la camioneta está al alcance, E es de la camioneta (Truck.tsx).
    const near = ladderEndNear(position, LADDERS)
    const hand: Vec3 = [position[0], position[1] + HAND_Y, position[2]]
    const valve = near ? null : nearestInteractable(hand, INTERACTABLES)
    const vstore = useValveStore.getState()
    if (vstore.near !== (valve?.id ?? null) || vstore.ladder !== (near?.end ?? null))
      useValveStore.setState({ near: valve?.id ?? null, ladder: near?.end ?? null })
    const eFree = use && !eBelongsToTruck(usePlayerStore.getState())
    const facing = near ? Math.cos(yaw - near.ladder.facing) > FACING_COS : false
    const walkOn = near?.end === 'bottom' && input.z > 0 && facing && !!ladderEndNear(position, LADDERS, WALK_ON_REACH)
    if (near && (eFree || walkOn)) {
      const lc = { ladder: near.ladder, p: near.end === 'top' ? 1 : 0 }
      climb.current = lc
      playerAction.climbing = true
      usePlayerStore.setState({ yaw: near.ladder.facing, climbing: true, climbAtEnd: true })
      const q = ladderFeet(lc.ladder, lc.p)
      place(q)
      return void usePlayerStore.setState({ position: q })
    }
    if (eFree && valve) {
      const state = useValveStore.getState().operate(valve.id)
      playerAction.operatingUntil = performance.now() + OPERATE_MS
      useMissionStore.getState().report({ type: 'interact', targetId: valve.id, state })
    }

    const { vx, vz } = stepMovement(input, yaw, dt)
    const wasAir = vs.current.airMs === Infinity
    vs.current = stepVertical(vs.current, grounded.current, jump, dt)
    if (!wasAir && vs.current.airMs === Infinity) Object.assign(jumpLog, { y0: position[1], apex: position[1], cuts: [] })
    if (vs.current.airMs === Infinity && vs.current.vy > 0) playerAction.airborne = true
    // QA D-10: en el aire, el autostep del controlador "subía" por la esquina mástil/baranda (salto + escalón = 0,78 m) y
    // el jugador quedaba parado en el aire o flotando con el clip de salto. Autostep y pegado al suelo solo apoyado.
    if (grounded.current && vs.current.vy <= 0) {
      c.enableAutostep(STEP_MAX, 0.1, false)
      c.enableSnapToGround(0.3)
    } else {
      c.disableAutostep()
      c.disableSnapToGround()
    }
    const want = { x: vx * dt, y: vs.current.vy * dt, z: vz * dt }
    c.computeColliderMovement(rb.collider(0), want, undefined, PLAYER_GROUPS)
    let m = { ...c.computedMovement() }
    grounded.current = c.computedGrounded()
    // Contra una esquina el empuje lateral también trababa la caída: si no bajó, se reintenta solo en vertical.
    if (!grounded.current && want.y < 0 && m.y > want.y / 2 && (want.x || want.z)) {
      c.computeColliderMovement(rb.collider(0), { x: 0, y: want.y, z: 0 }, undefined, PLAYER_GROUPS)
      m = { ...c.computedMovement() }
      grounded.current = c.computedGrounded()
    }
    // Subiendo y frenado por algo encima: se corta la subida (sin quedar pegado al techo o a la arista).
    if (want.y > 0 && m.y < want.y / 2) {
      jumpLog.cuts.push({ vy: vs.current.vy, want: want.y, got: m.y })
      vs.current = { ...vs.current, vy: 0 }
    }
    if (grounded.current && vs.current.vy < 0) {
      vs.current = { ...vs.current, vy: 0 }
      playerAction.airborne = false
    }
    playerSpeed.current = Math.hypot(m.x, m.z) / dt
    const t = rb.translation()
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z }
    const pos: Vec3 = [next.x, next.y - FOOT, next.z]
    // Sin daño por caída: debajo del suelo o fuera del vallado -> al último punto firme.
    const back = respawnPoint(pos, safe.current, LOCACION_BOUNDS)
    if (back) {
      vs.current = { vy: 0, airMs: 0 }
      playerAction.airborne = false
      place(back)
      teleportTo(back)
      return
    }
    safe.current = trackSafe(safe.current, pos, grounded.current, LOCACION_BOUNDS)
    jumpLog.apex = Math.max(jumpLog.apex, pos[1])
    // QA D-11: el vallado no se ve; si se empuja contra él, el HUD lo dice (sin distancias)
    const limit = (input.x !== 0 || input.z !== 0) && atLimit(pos, PLAYER_RADIUS + 0.05, LOCACION_BOUNDS)
    if (usePlayerStore.getState().atLimit !== limit) usePlayerStore.setState({ atLimit: limit })
    rb.setNextKinematicTranslation(next)
    usePlayerStore.setState({ position: pos })
  })

  return (
    <RigidBody
      ref={(rb) => {
        body.current = rb
        playerBody.current = rb
      }}
      type="kinematicPosition"
      colliders={false}
      position={[RESPAWN[0], RESPAWN[1] + FOOT + 0.02, RESPAWN[2]]}
    >
      <CapsuleCollider args={[HALF, PLAYER_RADIUS]} collisionGroups={PLAYER_GROUPS} />
      <CharacterModel footY={FOOT} />
    </RigidBody>
  )
}
