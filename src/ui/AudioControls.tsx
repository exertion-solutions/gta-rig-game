import { useAudioStore, type Mix } from '../audio/mix'
import { useRadioStore } from '../audio/radioPlayer'

const card = 'rounded border border-white/10 bg-[#12161a]/90 backdrop-blur-sm'

/** Botón del HUD: silencia todo (tecla N; M ya abre las misiones). */
export function MuteButton() {
  const muted = useAudioStore((s) => s.mix.muted)
  const toggle = useAudioStore((s) => s.toggleMute)
  return (
    <button
      className={`${card} pointer-events-auto shrink-0 px-3 py-1.5 text-sm hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400`}
      aria-pressed={muted}
      aria-label={`${muted ? 'Sin sonido' : 'Sonido'} (N)`}
      onClick={toggle}
      data-testid="audio-mute"
    >
      {muted ? 'Sin sonido' : 'Sonido'} <kbd className="ml-1 rounded bg-white/15 px-1 font-mono text-xs">N</kbd>
    </button>
  )
}

/** Subtítulo de la radio del instructor: visible mientras suena una línea (con o sin voz grabada). */
export function RadioSubtitle() {
  const subtitle = useRadioStore((s) => s.subtitle)
  if (!subtitle) return null
  return (
    <div className={`${card} shrink-0 px-3 py-2`} data-testid="hud-radio">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-sky-300">Radio · instructor</p>
      <p className="mt-1 text-sm leading-snug text-slate-100" aria-live="polite" data-testid="hud-radio-text">
        {subtitle}
      </p>
    </div>
  )
}

const SLIDERS: [keyof Omit<Mix, 'muted'>, string][] = [
  ['master', 'Maestro'],
  ['sfx', 'Efectos'],
  ['ambient', 'Ambiente'],
  ['voice', 'Voz'],
]

/** Volúmenes en el panel de misiones (se guardan en este navegador). */
export function AudioSettings() {
  const { mix, setMix } = useAudioStore()
  return (
    <fieldset className="space-y-2 rounded border border-white/10 bg-white/5 p-3" data-testid="audio-settings">
      <legend className="px-1 font-mono text-xs uppercase tracking-[0.14em] text-slate-300">Sonido</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={mix.muted} onChange={(e) => setMix({ muted: e.target.checked })} data-testid="audio-muted" />
        Silenciar todo (N)
      </label>
      {SLIDERS.map(([k, name]) => (
        <label key={k} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-sm">
          {name}
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(mix[k] * 100)}
            onChange={(e) => setMix({ [k]: Number(e.target.value) / 100 })}
            data-testid={`audio-${k}`}
          />
          <span className="text-right tabular-nums text-slate-300">{Math.round(mix[k] * 100)} %</span>
        </label>
      ))}
    </fieldset>
  )
}
