import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, ToneMapping, Vignette, wrapEffect } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { QUALITY_PROFILE, useQualityStore } from '../quality'
import { DepthAOEffect } from './DepthAO'

const DepthAO = wrapEffect(DepthAOEffect)

// Posproceso solo en calidad Alta, todo fusionado en un único pase de pantalla (sin pases de escena extra):
// - oclusión ambiental solo con profundidad (DepthAO): contacto y rincones del equipo y el suelo.
// - bloom suave (solo supera el umbral lo emisivo: las luminarias de la torre de noche).
// - mapeo de tonos ACES (el renderer deja de aplicarlo al dibujar a un framebuffer) + corrección de color + viñeta.
// SSAO clásico NO: necesita un pase de normales que vuelve a dibujar toda la escena (≈ 0,94 M de triángulos).
export function Post() {
  const on = useQualityStore((s) => QUALITY_PROFILE[s.quality].post)
  // Automatización (Playwright, SwiftShader): sin posproceso para que los e2e no se degraden; `?post=1` lo fuerza (realism.e2e).
  if (!on || (navigator.webdriver && !window.location.search.includes('post=1'))) return null
  return (
    <EffectComposer multisampling={4}>
      <DepthAO radius={0.9} strength={2.4} />
      <Bloom intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.15} mipmapBlur radius={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.12} />
      <BrightnessContrast contrast={0.08} />
      <Vignette offset={0.32} darkness={0.5} />
    </EffectComposer>
  )
}
