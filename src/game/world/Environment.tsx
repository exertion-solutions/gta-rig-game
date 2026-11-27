import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { exposeGame } from '../dev'
import { QUALITY_PROFILE, parseQualityParam, reportFrame, useQualityStore } from '../quality'
import { useSettings } from '../settings/store'
import { assetUrl } from './assetUrl'
import { exactHour, lightingAt, newLighting } from './DayNight'
import { MaterialUpgrade } from './MaterialUpgrade'

// Cielo, niebla y reflejos. Cielo: HDRI Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)" (CC0, Greg Zaal / Jarod Guest),
// ver NOTICE.md. De día se ve el HDRI; de noche, el gradiente del ciclo día/noche (DayNight.lightingAt). El mismo HDRI,
// convertido a PMREM, es el environment de la escena: los GLB del visor solo traen factores PBR (metal/rugosidad) y así
// los metales reflejan el cielo sin cambiar su geometría ni sus colores base. El disco del sol del HDRI se recorta
// (no coincidiría con el sol de juego, que se dibuja aparte siguiendo la hora).
const HDRI_URL = assetUrl('hdri/sky_1k.hdr')
const MAX_RADIANCE = 2.5
const FOG_NEAR = 90
const FOG_FAR = 420

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const SKY_FRAG = /* glsl */ `
uniform sampler2D hdri;
uniform float hasHdri;
uniform float day;
uniform vec3 top;
uniform vec3 bottom;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(bottom, top, smoothstep(-0.05, 0.5, d.y));
  vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
  vec3 sky = texture2D(hdri, uv).rgb;
  col = mix(col, sky, hasHdri * day * smoothstep(0.0, 0.25, d.y)); // en el horizonte vuelve al color de la niebla
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += vec3(1.0, 0.93, 0.78) * (pow(s, 1200.0) * 6.0 + pow(s, 14.0) * 0.12) * day; // sol de juego
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** HDRI en half float, con el disco solar recortado a MAX_RADIANCE. */
async function loadSky(): Promise<THREE.DataTexture> {
  const loader = new HDRLoader().setDataType(THREE.FloatType)
  const src = await loader.loadAsync(HDRI_URL)
  const data = src.image.data as Float32Array
  const half = new Uint16Array(data.length)
  for (let i = 0; i < data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(data[i], MAX_RADIANCE))
  const t = new THREE.DataTexture(half, src.image.width, src.image.height, THREE.RGBAFormat, THREE.HalfFloatType)
  t.mapping = THREE.EquirectangularReflectionMapping
  t.minFilter = t.magFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.LinearSRGBColorSpace
  t.needsUpdate = true
  src.dispose()
  return t
}

export function Environment() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const quality = useQualityStore((s) => s.quality)
  const light = useMemo(newLighting, [])
  const sunDir = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          hdri: { value: null },
          hasHdri: { value: 0 },
          day: { value: 1 },
          top: { value: light.skyTop }, // los mismos Color que actualiza lightingAt
          bottom: { value: light.skyBottom },
          sunDir: { value: sunDir },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [light, sunDir],
  )
  const fog = useMemo(() => new THREE.Fog('#cfe1f2', FOG_NEAR, FOG_FAR), [])

  useEffect(() => {
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, fog])

  // HDRI: cielo + environment. Mientras carga queda el gradiente; si falla (sin archivo) el juego sigue igual.
  useEffect(() => {
    let live = true
    let tex: THREE.DataTexture | null = null
    let env: THREE.Texture | null = null
    loadSky()
      .then((t) => {
        if (!live) return t.dispose()
        tex = t
        const pmrem = new THREE.PMREMGenerator(gl)
        const rt = pmrem.fromEquirectangular(t)
        pmrem.dispose()
        env = rt.texture
        scene.environment = env
        sky.uniforms.hdri.value = t
        sky.uniforms.hasHdri.value = 1
        exposeGame({ skyReady: true })
      })
      .catch((e) => console.warn('HDRI del cielo no disponible:', e))
    return () => {
      live = false
      scene.environment = null
      tex?.dispose()
      env?.dispose()
      sky.uniforms.hasHdri.value = 0
    }
  }, [gl, scene, sky])

  useEffect(() => () => sky.dispose(), [sky])

  // El renderer acumula los contadores de TODOS los pases del cuadro (sombra, escena, posproceso) y se limpia al empezar
  // el siguiente: así `renderInfo` mide el cuadro entero y no solo el último pase.
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])
  useFrame(() => gl.info.reset(), -1000)

  // Ajuste de calidad del menú de pausa -> calidad real ('auto' reactiva la degradación). `?quality=` del URL manda.
  const wanted = useSettings((s) => s.settings.quality)
  useEffect(() => {
    if (!parseQualityParam(window.location.search).auto) return
    const st = useQualityStore.getState()
    if (wanted === 'auto') st.setAuto(true)
    else st.set(wanted)
  }, [wanted])

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio || 1, QUALITY_PROFILE[quality].dpr))
  }, [quality, setDpr])

  useFrame((_, delta) => {
    reportFrame(delta * 1000) // degradación automática de calidad
    lightingAt(exactHour(), light)
    const day = THREE.MathUtils.clamp((light.sun - 0.15) / 2.6, 0, 1)
    sunDir.set(...light.sunDir)
    sky.uniforms.day.value = day
    fog.color.copy(light.skyBottom)
    scene.environmentIntensity = 0.06 + 0.5 * day // reflejos tenues de noche
  })

  return (
    <>
      <MaterialUpgrade />
      <mesh material={sky} frustumCulled={false} renderOrder={-1} name="cielo">
        <sphereGeometry args={[400, 32, 16]} />
      </mesh>
    </>
  )
}
