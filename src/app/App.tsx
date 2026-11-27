import { lazy, Suspense } from 'react'
import { Loading } from '../ui/Loading'
import { ErrorBoundary } from './ErrorBoundary'

// La escena (three, r3f, drei, misiones) viaja en un chunk aparte: el título pinta con solo React y el resto baja detrás.
const Scene = lazy(() => import('./Scene'))

export function App() {
  return (
    <>
      <ErrorBoundary
        name="Scene"
        fallback={
          <div role="alert" className="fixed inset-0 z-50 grid place-content-center gap-3 bg-[#0e1216] p-6 text-center text-white">
            <p>No se pudo iniciar el 3D en este equipo.</p>
            <button className="rounded border border-white/30 px-3 py-1" onClick={() => window.location.assign('?quality=low')}>
              Reintentar en calidad baja
            </button>
          </div>
        }
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </ErrorBoundary>
      <Loading />
    </>
  )
}
