// Voces de la radio y ambiente, 100 % locales (sin servicios en la nube ni claves):
//   texto de las misiones (src/audio/radio.ts + src/game/missions/defs) -> Windows SAPI (System.Speech, voz es-*)
//   -> ffmpeg (paso de banda 300-3400 Hz, compresión, saturación suave, ruido blanco) -> public/audio/voice/*.mp3 (mono, 48 kbps)
//   y el manifest public/audio/voice/manifest.json { id, file, hash, text, duration, sha256 }.
// Los .mp3 de voz NO se versionan (ver NOTICE.md); el manifest sí. El ambiente (viento y rig lejano) es síntesis propia por ffmpeg.
//   node scripts/gen-voice.mjs                regenera todo
//   node scripts/gen-voice.mjs --if-missing   (predev/prebuild) solo lo que falta o cambió; sin motor de voz, avisa y sigue
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const VOICE_DIR = join(root, 'public/audio/voice')
const MANIFEST = join(VOICE_DIR, 'manifest.json')
const AMBIENT = join(root, 'public/audio/ambient/rig-lejano.mp3')
const ifMissing = process.argv.includes('--if-missing')
const FORBIDDEN = /aprobad|habilitad|certificad|area segura|zona de exclusion/
const plain = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const fnv = (text) => {
  let h = 0x811c9dc5
  for (const ch of text) (h ^= ch.codePointAt(0)), (h = Math.imul(h, 0x01000193) >>> 0)
  return h.toString(16).padStart(8, '0')
}

function findFfmpeg() {
  for (const c of [process.env.FFMPEG, 'ffmpeg', 'C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe']) {
    if (c && spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0) return c
  }
  return null
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.status !== 0) throw new Error(`${cmd} falló (${r.status}): ${(r.stderr || r.error || '').toString().slice(-600)}`)
  return r.stdout
}

// Texto fuente: los mismos módulos del juego, cargados por vite (TS + JSON) sin levantar servidor.
async function sourceLines() {
  const { createServer } = await import('vite')
  const vite = await createServer({ root, configFile: false, logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } })
  try {
    const { LINK_LINES, missionLines } = await vite.ssrLoadModule('/src/audio/radio.ts')
    const { ALL_MISSIONS } = await vite.ssrLoadModule('/src/game/missions/defs/index.ts')
    return [...new Map([...Object.values(LINK_LINES), ...ALL_MISSIONS.flatMap(missionLines)].map((l) => [l.id, l])).values()]
  } finally {
    await vite.close()
  }
}

/** Voz española instalada (Windows SAPI) o null. Prueba solo System.Speech; sin voz es-* no inventa otra. */
function findVoice() {
  if (process.platform !== 'win32') return null
  const r = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ? { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'es-*' } | % { $_.VoiceInfo.Name + '|' + $_.VoiceInfo.Culture.Name }"],
    { encoding: 'utf8' },
  )
  const first = (r.stdout ?? '').split(/\r?\n/).find(Boolean)
  if (r.status !== 0 || !first) return null
  const [name, culture] = first.trim().split('|')
  return { name, culture }
}

const PS = `param($In, $Out, $Voice)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($Voice)
$s.Rate = -1
foreach ($i in (Get-Content -Raw -Encoding UTF8 $In | ConvertFrom-Json)) {
  $s.SetOutputToWaveFile((Join-Path $Out ($i.file + '.wav')))
  $s.Speak($i.text)
  $s.SetOutputToNull()
}
$s.Dispose()
`

// Filtro de radio: banda 300-3400 Hz, compresión, saturación suave y ruido blanco suave (+ cola de ruido de 0,25 s).
// Determinista (ruido con semilla, -bitexact): mismo texto y misma voz -> mismo mp3 -> mismo sha256.
const RADIO = [
  '[0:a]aresample=22050,highpass=f=300,lowpass=f=3400,acompressor=threshold=-20dB:ratio=6:attack=5:release=80:makeup=5,asoftclip=type=tanh,adelay=120|120,apad=pad_dur=0.25[v]',
  '[1:a]highpass=f=300,lowpass=f=3400[n]',
  '[v][n]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9',
].join(';')
const ENC = ['-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '48k', '-fflags', '+bitexact', '-flags:a', '+bitexact']

function radioMp3(ffmpeg, wav, out) {
  run(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-f', 'lavfi', '-i', 'anoisesrc=c=white:a=0.012:r=22050:seed=7', '-filter_complex', RADIO, ...ENC, out])
}
const duration = (ffmpeg, f) => {
  const probe = ffmpeg.replace(/ffmpeg(\.exe)?$/i, (_, e) => `ffprobe${e ?? ''}`)
  return Number(Number(run(probe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim()).toFixed(2))
}

// Viento + rumor grave + zumbido lejano de equipo (55 Hz): bucle de 8 s con cruces por cero y fundidos de 0,2 s en los bordes.
function genAmbient(ffmpeg) {
  mkdirSync(join(root, 'public/audio/ambient'), { recursive: true })
  const fc =
    '[0:a]lowpass=f=140,volume=2.2[rum];[1:a]highpass=f=180,lowpass=f=900,tremolo=f=0.25:d=0.5[wind];[2:a]volume=0.5[hum];' +
    '[rum][wind][hum]amix=inputs=3:normalize=0,volume=0.4,afade=t=in:d=0.2,afade=t=out:st=7.8:d=0.2,alimiter=limit=0.8'
  run(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anoisesrc=c=brown:a=0.9:d=8:r=22050:seed=11', '-f', 'lavfi', '-i', 'anoisesrc=c=pink:a=0.5:d=8:r=22050:seed=23', '-f', 'lavfi', '-i', 'sine=f=55:d=8:r=22050', '-filter_complex', fc, ...ENC, AMBIENT])
  console.log(`ambiente: ${AMBIENT.slice(root.length + 1)} (${statSync(AMBIENT).size} B)`)
}

const lines = await sourceLines()
for (const l of lines) if (FORBIDDEN.test(plain(l.text))) throw new Error(`palabra prohibida en ${l.id}`)

const ffmpeg = findFfmpeg()
if (!ffmpeg) {
  console.warn('gen-voice: sin ffmpeg (FFMPEG, PATH o C:\\Tools\\ffmpeg\\bin): solo subtítulos.')
  process.exit(0)
}
if (!ifMissing || !existsSync(AMBIENT)) genAmbient(ffmpeg)

const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { lines: {} }
const fileOf = (id) => `${id.replace(/[^a-z0-9]+/gi, '_')}.mp3`
const fresh = (l) => {
  const e = old.lines?.[l.id]
  const f = join(VOICE_DIR, fileOf(l.id))
  return e && e.text === l.text && e.hash === fnv(l.text) && e.file === fileOf(l.id) && existsSync(f) && sha256(f) === e.sha256
}
const todo = ifMissing ? lines.filter((l) => !fresh(l)) : lines
if (!todo.length) {
  console.log('voces al día')
  process.exit(0)
}

const voice = findVoice()
if (!voice) {
  console.warn('gen-voice: no hay voz española local (System.Speech es-*): quedan solo los subtítulos.')
  // En CI no hay voces: el manifest se vacía en el árbol de trabajo para que el build no pida archivos inexistentes.
  if (process.env.CI) writeFileSync(MANIFEST, `${JSON.stringify({ voice: null, lines: {} }, null, 2)}\n`)
  process.exit(0)
}

mkdirSync(VOICE_DIR, { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), 'gen-voice-'))
try {
  const items = todo.map((l) => ({ file: l.id.replace(/[^a-z0-9]+/gi, '_'), text: l.text }))
  writeFileSync(join(tmp, 'in.json'), JSON.stringify(items), 'utf8')
  writeFileSync(join(tmp, 'tts.ps1'), `\uFEFF${PS}`, 'utf8')
  run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(tmp, 'tts.ps1'), '-In', join(tmp, 'in.json'), '-Out', tmp, '-Voice', voice.name])
  const out = {}
  for (const l of lines) {
    const file = fileOf(l.id)
    const f = join(VOICE_DIR, file)
    if (todo.includes(l)) radioMp3(ffmpeg, join(tmp, `${l.id.replace(/[^a-z0-9]+/gi, '_')}.wav`), f)
    out[l.id] = { id: l.id, file, hash: fnv(l.text), text: l.text, duration: duration(ffmpeg, f), sha256: sha256(f) }
  }
  const manifest = { generator: 'scripts/gen-voice.mjs', voice: `${voice.name} (${voice.culture}), Windows SAPI + ffmpeg`, lines: out }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`voz: ${voice.name} (${voice.culture}); ${todo.length}/${lines.length} líneas generadas`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
