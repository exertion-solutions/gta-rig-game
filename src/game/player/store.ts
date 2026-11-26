import { create } from 'zustand'
import { RESPAWN, type Vec3 } from './movement'

// PROVISIONAL (igual que RESPAWN): la camioneta aparece junto al acceso, desplazada para no pisar al jugador.
// Task 7 lo reemplaza por el Acceso real.
export const TRUCK_SPAWN: Vec3 = [-35, 0, 3.5]
export const TRUCK_SPAWN_HEADING = -Math.PI / 2 // mira a +X (hacia el mástil)

export type PlayerState = {
  position: Vec3
  yaw: number
  pitch: number // elevación de la cámara de seguimiento
  mode: 'foot' | 'truck'
  teleportSeq: number // sube en cada teletransporte/reaparición: la cámara reinicia su pivote
  truck: { position: Vec3; heading: number } // posición a nivel de suelo y rumbo (yaw) de la camioneta
}

export const usePlayerStore = create<PlayerState>(() => ({
  position: RESPAWN,
  yaw: 0,
  pitch: 0.3,
  mode: 'foot',
  teleportSeq: 0,
  truck: { position: TRUCK_SPAWN, heading: TRUCK_SPAWN_HEADING },
}))

export const teleportTo = (p: Vec3) => usePlayerStore.setState((s) => ({ position: p, teleportSeq: s.teleportSeq + 1 }))
