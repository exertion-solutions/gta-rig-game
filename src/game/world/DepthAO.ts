import { Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2, type Camera, type PerspectiveCamera } from 'three'

// Oclusión ambiental SOLO con el buffer de profundidad (la normal se reconstruye de la profundidad vecina): no hay pase
// de normales, es decir, no vuelve a dibujar la escena (SSAO clásico = +0,94 M de triángulos, docs/perf.md). Es un
// pase de pantalla completa que se fusiona con el resto de efectos (sin draw calls extra). Estilo Alchemy/SAO: 12
// muestras en espiral con rotación por píxel (ruido de gradiente entrelazado, que el grano de película disimula).
const FRAG = /* glsl */ `
uniform vec2 uProj;   // P[0][0], P[1][1] de la cámara
uniform vec2 uNF;     // near, far
uniform vec2 uRes;
uniform float uRadius;
uniform float uStrength;

float aoDist(float d) { return uNF.x * uNF.y / (uNF.y - (uNF.y - uNF.x) * d); } // distancia en +z (m)
vec3 aoPos(vec2 uv, float d) {
  float z = aoDist(d);
  return vec3((uv * 2.0 - 1.0) / uProj * z, -z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  outputColor = inputColor;
  if (depth > 0.99999) return; // cielo
  vec2 px = 1.0 / uRes;
  vec3 pc = aoPos(uv, depth);
  if (-pc.z > 110.0) return;
  float dl = readDepth(uv - vec2(px.x, 0.0)), dr = readDepth(uv + vec2(px.x, 0.0));
  float dd = readDepth(uv - vec2(0.0, px.y)), du = readDepth(uv + vec2(0.0, px.y));
  vec3 pl = aoPos(uv - vec2(px.x, 0.0), dl), pr = aoPos(uv + vec2(px.x, 0.0), dr);
  vec3 pd = aoPos(uv - vec2(0.0, px.y), dd), pu = aoPos(uv + vec2(0.0, px.y), du);
  vec3 dx = abs(pr.z - pc.z) < abs(pl.z - pc.z) ? pr - pc : pc - pl;
  vec3 dy = abs(pu.z - pc.z) < abs(pd.z - pc.z) ? pu - pc : pc - pd;
  vec3 n = normalize(cross(dx, dy));
  if (n.z < 0.0) n = -n;

  float z = -pc.z;
  float rPx = clamp(uRadius * uProj.y / z * uRes.y * 0.5, 3.0, 70.0);
  float noise = fract(52.9829189 * fract(dot(uv * uRes, vec2(0.06711056, 0.00583715))));
  float occ = 0.0;
  const int N = 12;
  for (int i = 0; i < N; i++) {
    float a = (float(i) + 0.5) / float(N);
    float ang = a * 6.2831853 * 3.0 + noise * 6.2831853;
    vec2 suv = uv + vec2(cos(ang), sin(ang)) * (a * a * 0.85 + 0.15) * rPx * px;
    float sd = readDepth(suv);
    if (sd > 0.99999) continue;
    vec3 v = aoPos(suv, sd) - pc;
    float vv = dot(v, v);
    float f = 1.0 - smoothstep(uRadius * 0.6, uRadius * 1.6, sqrt(vv)); // lo muy lejano (otro objeto) no ocluye
    occ += max(dot(v, n) - 0.06 * z, 0.0) / (vv + 0.02) * f;
  }
  float ao = clamp(1.0 - uStrength * occ * uRadius * 0.5 / float(N) * 2.0, 0.0, 1.0);
  ao = mix(ao, 1.0, smoothstep(45.0, 105.0, z)); // lejos no se nota y el radio en píxeles se vuelve ruido
  outputColor.rgb = inputColor.rgb * ao;
}`

export class DepthAOEffect extends Effect {
  private cam: PerspectiveCamera | null = null
  constructor({ radius = 0.9, strength = 1.0 }: { radius?: number; strength?: number } = {}) {
    super('DepthAOEffect', FRAG, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uProj', new Uniform(new Vector2(1, 1))],
        ['uNF', new Uniform(new Vector2(0.1, 500))],
        ['uRes', new Uniform(new Vector2(1280, 720))],
        ['uRadius', new Uniform(radius)],
        ['uStrength', new Uniform(strength)],
      ]),
    })
  }
  set mainCamera(c: Camera) {
    this.cam = c as PerspectiveCamera
  }
  setSize(w: number, h: number) {
    ;(this.uniforms.get('uRes')!.value as Vector2).set(w, h)
  }
  update() {
    const c = this.cam
    if (!c) return
    ;(this.uniforms.get('uProj')!.value as Vector2).set(c.projectionMatrix.elements[0], c.projectionMatrix.elements[5])
    ;(this.uniforms.get('uNF')!.value as Vector2).set(c.near, c.far)
  }
}
