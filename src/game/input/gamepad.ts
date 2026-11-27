type PadLike = { axes: readonly number[]; buttons: readonly { pressed: boolean }[] }
export type PadInput = { move: { x: number; z: number }; look: { x: number; y: number }; run: boolean; jump: boolean; interact: boolean }

export const DEADZONE = 0.15
// Mapeo "standard" de la Gamepad API: ejes 0/1 stick izquierdo, 2/3 derecho; botón 0 = A, 2 = X, 7 = gatillo derecho, 10 = clic del stick izq.
const B = { jump: 0, interact: 2, runTrigger: 7, runStick: 10 } as const

// Zona muerta con reescalado: el valor arranca en 0 en el borde de la zona (sin salto brusco) y llega a ±1.
const dz = (v: number | undefined, d: number) => {
  const a = Math.abs(v ?? 0)
  return !Number.isFinite(a) || a <= d ? 0 : (Math.sign(v!) * (Math.min(a, 1) - d)) / (1 - d)
}
const on = (p: PadLike, i: number) => !!p.buttons[i]?.pressed

/** Pura: estado de un mando -> intención de juego. move.z > 0 = adelante (el eje y del stick es negativo hacia arriba). */
export function mapGamepad(pad: PadLike, deadzone = DEADZONE): PadInput {
  return {
    move: { x: dz(pad.axes[0], deadzone), z: -dz(pad.axes[1], deadzone) || 0 },
    look: { x: dz(pad.axes[2], deadzone), y: dz(pad.axes[3], deadzone) },
    run: on(pad, B.runTrigger) || on(pad, B.runStick),
    jump: on(pad, B.jump),
    interact: on(pad, B.interact),
  }
}

/** Primer mando conectado (navigator.getGamepads puede no existir o lanzar), o null. */
export function readPad(): PadInput | null {
  try {
    const p = Array.from(navigator.getGamepads?.() ?? []).find((g) => g?.connected)
    return p ? mapGamepad(p) : null
  } catch {
    return null
  }
}
