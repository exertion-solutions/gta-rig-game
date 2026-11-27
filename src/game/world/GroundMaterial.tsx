import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { assetUrl } from './assetUrl'

// Suelo PBR de grava/tierra: Poly Haven "Gravel Ground 01" (CC0, Rob Tuytel), ver NOTICE.md. El suelo sigue plano y sin
// caminos (no hay fuente de terreno). Para que no se vea la repetición cada `TILE_M` se mezclan dos escalas de la misma
// textura con una máscara de ruido de baja frecuencia (un solo material, sin texturas extra).
export const TILE_M = 3 // metros por repetición de la textura base

const GROUND_FN = /* glsl */ `
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
}
vec4 groundSample(sampler2D t, vec2 uv) {
  vec4 a = texture2D(t, uv);
  vec4 b = texture2D(t, mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.37 + vec2(0.31, 0.77)); // otra escala y giro
  float m = smoothstep(0.3, 0.7, gNoise(uv * 0.09) * 0.65 + gNoise(uv * 0.31) * 0.35);
  return mix(a, b, m);
}
`

/** Reemplaza el muestreo de color, normal y rugosidad por `groundSample` (todos con el UV del color: comparten repetición).
 *  `count` = muestreos reemplazados; si una versión de three cambia los chunks, el test avisa. */
export function patchGroundShader(fragment: string) {
  let count = 0
  const sub = (chunk: string) =>
    chunk.replace(/texture2D\(\s*(map|normalMap|roughnessMap)\s*,\s*(vMapUv|vNormalMapUv|vRoughnessMapUv)\s*\)/g, (_m, tex: string) => {
      count++
      return `groundSample(${tex}, vMapUv)`
    })
  const out = fragment
    .replace('#include <common>', `#include <common>\n${GROUND_FN}`)
    .replace('#include <map_fragment>', sub(THREE.ShaderChunk.map_fragment))
    .replace('#include <roughnessmap_fragment>', sub(THREE.ShaderChunk.roughnessmap_fragment))
    .replace('#include <normal_fragment_maps>', sub(THREE.ShaderChunk.normal_fragment_maps).replace(/vNormalMapUv/g, 'vMapUv'))
  return { fragment: out, count }
}

const URLS = ['textures/ground_diff.webp', 'textures/ground_nor.webp', 'textures/ground_rough.webp'].map(assetUrl)

/** Material del suelo para un rectángulo de `sizeX × sizeZ` m (el plano usa UV 0..1). */
export function useGroundMaterial(sizeX: number, sizeZ: number, tint = '#ffffff') {
  const [diff, nor, rough] = useTexture(URLS)
  return useMemo(() => {
    const tex = [diff, nor, rough].map((t) => {
      const c = t.clone() // comparten imagen; cada plano tiene su repetición
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(sizeX / TILE_M, sizeZ / TILE_M)
      c.anisotropy = 8
      c.needsUpdate = true
      return c
    })
    tex[0].colorSpace = THREE.SRGBColorSpace
    const m = new THREE.MeshStandardMaterial({
      map: tex[0],
      normalMap: tex[1],
      roughnessMap: tex[2],
      color: tint,
      metalness: 0,
      roughness: 1,
    })
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = patchGroundShader(shader.fragmentShader).fragment
    }
    m.customProgramCacheKey = () => 'ground-var-v1'
    return m
  }, [diff, nor, rough, sizeX, sizeZ, tint])
}
