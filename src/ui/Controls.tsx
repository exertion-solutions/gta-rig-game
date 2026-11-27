const K = ({ k }: { k: string }) => <kbd className="rounded bg-white/15 px-1 font-mono text-xs">{k}</kbd>

// Ayuda de controles siempre visible (solo en pantallas anchas: en angosto no hay lugar sin tapar el juego).
export function Controls() {
  return (
    <div
      className="mb-2 hidden rounded border border-white/10 bg-[#12161a]/90 px-2.5 py-1.5 text-xs leading-relaxed text-slate-200 sm:block"
      data-testid="controls"
    >
      <p><K k="W A S D" /> mover · <K k="Shift" /> correr · <K k="V" /> fijar</p>
      <p><K k="Espacio" /> saltar · <K k="E" /> usar · <K k="C" /> agacharse</p>
      <p>Clic en el juego: mirar con el mouse</p>
      <p><K k="M" /> misiones · <K k="Tab" /> mapa · <K k="F" /> ficha</p>
      <p><K k="N" /> sonido · <K k="P" /> foto · <K k="Esc" /> pausa</p>
    </div>
  )
}
