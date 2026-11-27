import { useProgress } from '@react-three/drei'

// Indicador de carga mínimo (los GLB pasan por el LoadingManager de three). La pantalla de carga completa es la Task 17.
export function Loading({ physicsReady }: { physicsReady: boolean }) {
  const { active, progress } = useProgress()
  if (physicsReady && !active && progress === 100) return null
  return (
    <div
      data-testid="loading"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-1/2 text-center text-lg font-semibold text-white drop-shadow"
    >
      Cargando… {Math.round(progress)} %
    </div>
  )
}
