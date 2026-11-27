import { useEffect, useState } from 'react'
import { capturePhoto } from './PhotoCapture'
import { useHudStore } from './hudStore'
import { downloadBlob } from './share'

/** Modo foto: sin HUD, solo esta barra (fuera del canvas: no sale en la imagen). Intro o el botón descargan el PNG. */
export function PhotoBar() {
  const setPhoto = useHudStore((s) => s.setPhoto)
  const [msg, setMsg] = useState('')
  const shoot = () =>
    capturePhoto().then(
      (b) => (downloadBlob(b, 'foto-locacion.png'), setMsg('Foto descargada')),
      () => setMsg('No se pudo sacar la foto'),
    )
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' || e.repeat) return
      e.preventDefault()
      void shoot()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-10 flex justify-center px-3 font-sans text-slate-100" data-testid="photo-bar">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded border border-white/10 bg-[#12161a]/90 px-3 py-2 text-sm backdrop-blur-sm">
        <button className="rounded bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => void shoot()} data-testid="photo-download">
          Descargar PNG (Intro)
        </button>
        <button className="rounded border border-white/20 bg-white/5 px-3 py-1.5 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" onClick={() => setPhoto(false)}>
          Salir (P)
        </button>
        <span role="status" data-testid="photo-status" className="text-slate-200">
          {msg}
        </span>
      </div>
    </div>
  )
}
