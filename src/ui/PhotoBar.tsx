import { useEffect, useRef, useState } from 'react'
import { capturePhoto } from './PhotoCapture'
import { clipSupport, recordClip } from './Recorder'
import { useHudStore } from './hudStore'
import { clipFileName, downloadBlob } from './share'

/** Modo foto: sin HUD, solo esta barra (fuera del canvas: no sale en la imagen). Intro descarga el PNG; R graba un clip de 10 s. */
export function PhotoBar() {
  const setPhoto = useHudStore((s) => s.setPhoto)
  const [msg, setMsg] = useState('')
  const [left, setLeft] = useState<number | null>(null) // segundos que faltan del clip; null = no graba
  const [mime] = useState(clipSupport)
  const rec = useRef<ReturnType<typeof recordClip> | null>(null)
  const shoot = () =>
    capturePhoto().then(
      (b) => (downloadBlob(b, 'foto-locacion.png'), setMsg('Foto descargada')),
      () => setMsg('No se pudo sacar la foto'),
    )
  const clip = () => {
    if (rec.current) return rec.current.stop()
    const canvas = document.querySelector('canvas')
    if (!mime || !canvas) return setMsg('Clip no disponible en este navegador')
    try {
      const r = (rec.current = recordClip(canvas, mime, setLeft))
      r.done
        .then(
          (b) => (downloadBlob(b, clipFileName()), setMsg('Clip descargado')),
          (e) => (console.warn('[clip]', e), setMsg('No se pudo grabar el clip')),
        )
        .finally(() => ((rec.current = null), setLeft(null)))
    } catch {
      rec.current = null
      setMsg('No se pudo grabar el clip')
    }
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.code !== 'Enter' && e.code !== 'KeyR') || e.repeat) return
      e.preventDefault()
      if (e.code === 'KeyR') clip()
      else void shoot()
    }
    window.addEventListener('keydown', down)
    return () => {
      window.removeEventListener('keydown', down)
      rec.current?.stop()
    }
  }, [])
  const btn = 'rounded border border-white/20 bg-white/5 px-3 py-1.5 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400'
  return (
    <>
      {left !== null && (
        <div role="status" data-testid="rec-indicator" className="pointer-events-none fixed left-3 top-3 z-10 flex items-center gap-2 rounded bg-black/70 px-3 py-1.5 font-sans text-sm font-semibold text-white">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          Grabando {left} s
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-10 flex justify-center px-3 font-sans text-slate-100" data-testid="photo-bar">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded border border-white/10 bg-[#12161a]/90 px-3 py-2 text-sm backdrop-blur-sm">
          <button className="rounded bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => void shoot()} data-testid="photo-download">
            Descargar PNG (Intro)
          </button>
          <button className={`${btn} disabled:opacity-50`} onClick={clip} disabled={!mime} data-testid="photo-clip">
            {left !== null ? 'Detener clip (R)' : mime ? 'Grabar clip 10 s (R)' : 'Clip no disponible'}
          </button>
          <button className={btn} onClick={() => setPhoto(false)}>
            Salir (P)
          </button>
          <span role="status" data-testid="photo-status" className="text-slate-200">
            {msg}
          </span>
        </div>
      </div>
    </>
  )
}
