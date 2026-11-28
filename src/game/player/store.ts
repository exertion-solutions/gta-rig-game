import { create } from 'zustand'
import { getSectors } from '../data/sectors'
import { BASE } from '../world/route'
import { RESPAWN, type Vec3 } from './movement'

// Primer cuadro (QA B P0-2): desde el Acceso, mirando al centro de los sectores con equipo (antes yaw 0 = -Z, hacia el
// borde del mundo con el equipo a la espalda). yaw: avance = (-sen, -cos). Pitch bajo para que entre más del mástil.
const RIG = getSectors().filter((s) => s.position && s.objectIds.length)
const RIG_CENTER = [0, 2].map((i) => RIG.reduce((a, s) => a + s.position![i], 0) / RIG.length)
export const INITIAL_YAW = Math.atan2(-(RIG_CENTER[0] - RESPAWN[0]), -(RIG_CENTER[1] - RESPAWN[2]))
export const INITIAL_PITCH = 0.12

// La camioneta aparece en el Acceso, 3,5 m a la derecha del jugador (al costado: no tapa el equipo en el primer cuadro)
// y mirando al equipo.
export const TRUCK_SPAWN: Vec3 = [RESPAWN[0] + 3.5 * Math.cos(INITIAL_YAW), RESPAWN[1], RESPAWN[2] - 3.5 * Math.sin(INITIAL_YAW)]
export const TRUCK_SPAWN_HEADING = INITIAL_YAW

// Cada sesión arranca en la base operativa, a 20 km de camino del equipo. En automatización (e2e) arranca en la locación,
// salvo `?inicio=base`; `?inicio=locacion` también lo fuerza a mano.
const hasPage = typeof window !== 'undefined' && !!window.location && typeof navigator !== 'undefined'
const inicio = hasPage ? new URLSearchParams(window.location.search).get('inicio') : null
export const START_AT_BASE = hasPage && (inicio === 'base' || (inicio !== 'locacion' && !navigator.webdriver))
export const START: { position: Vec3; yaw: number; truck: Vec3; truckHeading: number } = START_AT_BASE
  ? { position: BASE.player, yaw: BASE.yaw, truck: BASE.truck, truckHeading: BASE.yaw }
  : { position: RESPAWN, yaw: INITIAL_YAW, truck: TRUCK_SPAWN, truckHeading: TRUCK_SPAWN_HEADING }

export type PlayerState = {
  position: Vec3
  yaw: number
  pitch: number // elevación de la cámara de seguimiento
  mode: 'foot' | 'truck'
  teleportSeq: number // sube en cada teletransporte/reaparición: la cámara reinicia su pivote
  climbing: boolean // colgado de una escalera vertical: E no es de la camioneta
  climbAtEnd: boolean // colgado en un extremo de la escalera: E la suelta (aviso)
  crouching: boolean // agachado (C o Ctrl izq.): solo baja velocidad y cámara; la cápsula no cambia (ver Player.tsx)
  atLimit: boolean // empujando contra el vallado del borde de la locación (aviso "Límite de la locación")
  truck: { position: Vec3; heading: number } // posición a nivel de suelo y rumbo (yaw) de la camioneta
}

export const usePlayerStore = create<PlayerState>(() => ({
  position: START.position,
  yaw: START.yaw,
  pitch: INITIAL_PITCH,
  mode: 'foot',
  teleportSeq: 0,
  climbing: false,
  climbAtEnd: false,
  atLimit: false,
  crouching: false,
  truck: { position: START.truck, heading: START.truckHeading },
}))

export const teleportTo = (p: Vec3) => usePlayerStore.setState((s) => ({ position: p, teleportSeq: s.teleportSeq + 1 }))
