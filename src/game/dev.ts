// Ganchos de prueba (window.__game): solo en dev/test; import.meta.env.DEV es false en producción y se elimina del bundle.
export function exposeGame(patch: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  const w = window as unknown as { __game?: Record<string, unknown> }
  w.__game = Object.assign(w.__game ?? {}, patch)
}
