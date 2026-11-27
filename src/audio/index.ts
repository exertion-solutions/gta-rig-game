import { useMissionStore } from '../game/missions/store'
import { usePlayerStore } from '../game/player/store'
import { playerAction, playerSpeed, truckSpeed } from '../game/player/telemetry'
import { useValveStore } from '../game/world/interactables'
import { stepInterval } from './params'
import { startRadio } from './radioPlayer'
import { audioRunning, sfx, unlock } from './sfx'

const RUNG_S = 0.38 // s entre golpes de peldaño trepando (juego)

let started = false
/** Sonido y radio: la radio (subtítulos) arranca ya; los efectos recién con el primer gesto del usuario. */
export function startAudio() {
  if (started) return
  started = true
  startRadio()
  // Cada gesto reanuda el contexto si el navegador lo suspendió; el primero lo crea.
  for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlock, { capture: true, passive: true })

  usePlayerStore.subscribe((s, p) => {
    if (s.mode !== p.mode) sfx.door()
  })
  useValveStore.subscribe((s, p) => {
    if (s.turns !== p.turns) sfx.valve()
  })
  useMissionStore.subscribe(({ mission: m }, { mission: pm }) => {
    if (m.status === 'completed' && pm.status !== 'completed') sfx.notify('completed')
    else if (m.status === 'active' && (m.missionId !== pm.missionId || pm.status !== 'active')) sfx.notify('mission')
    else if (m.status === 'active' && m.objectiveIndex > pm.objectiveIndex) sfx.notify('objective')
  })

  // Pasos, salto/aterrizaje, escalera y motor: se leen del estado de movimiento una vez por cuadro.
  let last = performance.now()
  let stepPhase = 0.6 // arranca cerca de 1: el primer paso suena enseguida
  let rungPhase = 0
  let air = false
  const tick = (now: number) => {
    requestAnimationFrame(tick)
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    if (!audioRunning()) return
    const foot = usePlayerStore.getState().mode === 'foot'
    sfx.engine(foot ? null : truckSpeed.current)
    if (!foot) return
    if (playerAction.airborne !== air) {
      air = playerAction.airborne
      if (air) sfx.jump()
      else sfx.land()
    }
    if (playerAction.climbing) {
      rungPhase = playerAction.climbMoving ? rungPhase + dt / RUNG_S : 0.9
      if (rungPhase >= 1) (rungPhase -= 1, sfx.rung())
      return
    }
    const iv = air ? null : stepInterval(playerSpeed.current)
    stepPhase = iv ? stepPhase + dt / iv : 0.6
    if (stepPhase >= 1) (stepPhase -= 1, sfx.step())
  }
  requestAnimationFrame(tick)
}
