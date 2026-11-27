import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { exposeGame } from '../dev'
import { QUALITY_PROFILE, useQualityStore } from '../quality'

// Mejora de materiales por recorrido de la escena (sin tocar geometría ni el color base de forma notable; los GLB del
// visor traen solo factores PBR planos). Por material estándar:
//  - suciedad/desgaste en el shader (onBeforeCompile) con ruido de gran escala en coordenadas de MUNDO: moteado, polvo
//    que sube desde el suelo y se asienta en las caras que miran arriba, chorreaduras verticales; sube la rugosidad donde
//    hay polvo y la modula en el metal para romper los reflejos uniformes. Sin texturas ni geometría.
//  - IBL por material: pintura y metal reflejan el cielo con intensidad calibrada por familia (acero/vidrio/pintura/goma).
//  - personajes (SkinnedMesh): luz de borde (rim) suave que despega la silueta del fondo.
// El nombre del material de los GLB es `sk575_<pieza>_<familia>`.

type Family = 'steel' | 'paint' | 'glass' | 'rubber' | 'other'
const FAMILY: Array<[RegExp, Family]> = [
  [/(acero|aluminio|galvanizado|grating|cable)$/, 'steel'],
  [/vidrio$/, 'glass'],
  [/goma$/, 'rubber'],
  [/(rojo|azul|azul_bomba|amarillo|blanco|hormigon)$/, 'paint'],
]
const familyOf = (name: string): Family => FAMILY.find(([re]) => re.test(name))?.[1] ?? 'other'

// intensidad del environment (× la del cielo del momento) y suciedad por familia
const TUNE: Record<Family, { env: number; grime: number; rough: number }> = {
  steel: { env: 1.5, grime: 0.55, rough: 0.3 },
  glass: { env: 2.2, grime: 0.15, rough: 0 },
  paint: { env: 1.0, grime: 1.0, rough: 0.12 },
  rubber: { env: 0.7, grime: 0.5, rough: 0.1 },
  other: { env: 1.0, grime: 0.6, rough: 0.1 },
}

const GLSL_NOISE = /* glsl */ `
float gmH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gmN(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gmH(i), gmH(i + vec3(1, 0, 0)), f.x), mix(gmH(i + vec3(0, 1, 0)), gmH(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gmH(i + vec3(0, 0, 1)), gmH(i + vec3(1, 0, 1)), f.x), mix(gmH(i + vec3(0, 1, 1)), gmH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`

const shared = { rimDay: { value: 1 }, grime: { value: 1 } } // se actualizan por cuadro (hora del día)

/** Parcha un MeshStandardMaterial (idempotente por `done`). Devuelve false si no aplica. */
export function patchMaterial(m: THREE.MeshStandardMaterial, family: Family, skinned: boolean) {
  const t = TUNE[family]
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (shader, r) => {
    prev?.call(m, shader, r)
    shader.uniforms.uGrime = { value: skinned ? 0 : t.grime }
    shader.uniforms.uGrimeRough = { value: t.rough }
    shader.uniforms.uRimDay = shared.rimDay
    shader.uniforms.uRim = { value: skinned ? 1 : 0 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nvarying float vGNY;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        { vec4 gw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          gw = instanceMatrix * gw;
          #endif
          vGW = (modelMatrix * gw).xyz;
          vGNY = normalize(mat3(modelMatrix) * objectNormal).y; }`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vGW;\nvarying float vGNY;\nuniform float uGrime;\nuniform float uGrimeRough;\nuniform float uRimDay;\nuniform float uRim;\n${GLSL_NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gNoise = 0.5;
        float gDust = 0.0;
        if (uGrime > 0.0) {
          float n1 = gmN(vGW * 0.55);
          float n2 = gmN(vGW * 2.3 + 7.0);
          float n3 = gmN(vGW * 11.0 + 3.0);
          gNoise = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;
          float low = 1.0 - smoothstep(0.0, 1.8, vGW.y);
          gDust = clamp(low * (0.25 + 0.9 * n1) + smoothstep(0.6, 1.0, vGNY) * 0.35 * n2, 0.0, 1.0);
          float streak = gmN(vec3((vGW.x + vGW.z) * 2.6, vGW.y * 0.22, 0.0));
          float drip = smoothstep(0.58, 0.9, streak) * (1.0 - smoothstep(0.2, 0.7, vGNY));
          vec3 col = diffuseColor.rgb * (0.78 + 0.34 * gNoise);
          col *= 1.0 - 0.28 * drip;
          col = mix(col, vec3(0.52, 0.44, 0.33) * (0.7 + 0.5 * n2), clamp(gDust * 0.55, 0.0, 0.5));
          diffuseColor.rgb = mix(diffuseColor.rgb, col, uGrime);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + uGrime * (gDust * 0.45 + (gNoise - 0.5) * uGrimeRough * 2.0), 0.04, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uRim > 0.5) {
          float rim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += vec3(0.75, 0.85, 1.0) * rim * 0.22 * uRimDay;
        }`,
      )
  }
  m.customProgramCacheKey = () => `mu1-${family}-${skinned ? 's' : 'n'}`
  m.needsUpdate = true
}

type Entry = { m: THREE.MeshStandardMaterial; env: number }

export function MaterialUpgrade() {
  const scene = useThree((s) => s.scene)
  const done = useRef(new WeakSet<THREE.Material>())
  const list = useRef<Entry[]>([])
  const acc = useRef(0)

  const scan = () => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh || mesh.name === 'cielo' || mesh.userData.noUpgrade) return
      const skinned = !!(mesh as THREE.SkinnedMesh).isSkinnedMesh
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]
      for (const m of mats) {
        if (!m || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial || done.current.has(m)) continue
        done.current.add(m)
        if (m.userData.noUpgrade || m.onBeforeCompile.toString().length > 60 /* ya parchado (suelo) */) continue
        const family = familyOf(m.name)
        // pintura: no es metal (el 0,3 de los GLB la oscurece y le quita color); acero: más metal pulido sin tocar su color
        if (family === 'paint') m.metalness = Math.min(m.metalness, 0.08)
        patchMaterial(m, family, skinned)
        list.current.push({ m, env: TUNE[family].env })
      }
    })
  }

  useEffect(() => {
    scan()
    exposeGame({ upgradedMaterials: () => list.current.length })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current > 1.5) {
      acc.current = 0
      scan() // piezas que cargan después (camioneta, personaje)
    }
    const env = scene.environment
    const k = scene.environmentIntensity
    const day = THREE.MathUtils.clamp((k - 0.06) / 0.5, 0, 1)
    shared.rimDay.value = day
    for (const e of list.current) {
      // envMap propio: con scene.environment el renderer ignora envMapIntensity del material
      if (e.m.envMap !== env) {
        e.m.envMap = env
        e.m.needsUpdate = true
      }
      e.m.envMapIntensity = k * e.env
    }
  })
  void QUALITY_PROFILE
  void useQualityStore
  return null
}
