// Teclas apretadas (a pie y en la camioneta). Aparte de Player.tsx para que el HUD no arrastre Rapier al chunk inicial.
export const keys = new Set<string>()

// Al perder el foco (Alt-Tab, otra pestaña) el navegador no manda keyup: sin esto W quedaba apretada y el jugador o la
// camioneta seguían andando. Vale para caminar, trepar (W/S) y conducir: todos leen este Set.
const listeners = new Set<() => void>()
export const onKeysCleared = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export function clearKeys() {
  keys.clear()
  listeners.forEach((f) => f())
}
if (typeof window !== 'undefined') {
  window.addEventListener('blur', clearKeys)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && clearKeys())
}
