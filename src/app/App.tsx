import { lazy, Suspense } from 'react'
import { Loading } from '../ui/Loading'

// La escena (three, r3f, drei, misiones) viaja en un chunk aparte: el título pinta con solo React y el resto baja detrás.
const Scene = lazy(() => import('./Scene'))

export function App() {
  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <Loading />
    </>
  )
}
