import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { QUALITY_PROFILE, useQualityStore } from '../quality'

// Posproceso solo en calidad Alta: bloom suave (solo supera el umbral lo emisivo: las luminarias de la torre de noche) y
// el mapeo de tonos ACES que el renderer deja de aplicar al dibujar a un framebuffer. SSAO NO: necesita un pase de
// normales que vuelve a dibujar toda la escena (≈ 0,94 M de triángulos) y duplicaría el presupuesto (docs/perf.md).
export function Post() {
  const on = useQualityStore((s) => QUALITY_PROFILE[s.quality].post)
  // Automatización (Playwright, SwiftShader): sin posproceso para que los e2e no se degraden; `?post=1` lo fuerza (realism.e2e).
  if (!on || (navigator.webdriver && !window.location.search.includes('post=1'))) return null
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.15} mipmapBlur radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
