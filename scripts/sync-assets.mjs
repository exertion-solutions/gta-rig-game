import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { convertSecuencia } from './secuencia.mjs'

// destino en vendor/visor -> ruta en el repo del visor
const VENDOR = {
  'viewpoints.json': 'src/data/viewpoints/rig10-viewpoints.json',
  'drops.json': 'src/data/qhse/rig10-drops.json',
  'types.ts': 'src/types/qhse.ts',
  'layout_locacion.json': 'cad/data/layout_locacion.json',
  'secuencia.json': 'docs/secuencia-montaje-tipica.md', // se convierte a JSON (ver CONVERT)
}
// destino -> conversión del contenido bajado; el hash del lock es el del archivo resultante
const CONVERT = {
  'secuencia.json': (buf) => Buffer.from(JSON.stringify(convertSecuencia(buf.toString('utf8')), null, 2) + '\n'),
}
const lockPath = resolve('assets.lock.json')
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
const sha256 = (b) => createHash('sha256').update(b).digest('hex')

function fetchRaw(path) {
  const r = spawnSync(
    'gh',
    ['api', '-H', 'Accept: application/vnd.github.raw', `repos/${lock.source}/contents/${path}?ref=${lock.commit}`],
    { maxBuffer: 256 * 1024 * 1024 },
  )
  if (r.status !== 0) throw new Error(`gh api ${path}: ${r.stderr?.toString() || r.error}`)
  return r.stdout
}

function pull(entries, destRoot, srcOf, hashes, convert = {}) {
  const out = {}
  for (const name of entries) {
    const raw = fetchRaw(srcOf(name))
    const buf = convert[name] ? convert[name](raw) : raw
    const hash = sha256(buf)
    if (hashes?.[name] && hashes[name] !== hash) throw new Error(`hash distinto para ${name} en ${lock.commit}`)
    const dest = join(destRoot, name)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, buf)
    out[name] = hash
    console.log(`ok ${dest}`)
  }
  return out
}

pull(Object.keys(lock.files), resolve('public/models/rig10'), (n) => `public/models/rig10/${n}`, lock.files)
// vendor: los hashes del lock se exigen; fijarlos es una acción explícita (--pin-vendor).
const pin = process.argv.includes('--pin-vendor')
if (!lock.vendor && !pin) throw new Error('assets.lock.json sin "vendor": corré con --pin-vendor para fijarlo a propósito')
const vendor = pull(Object.keys(VENDOR), resolve('vendor/visor'), (n) => VENDOR[n], pin ? undefined : lock.vendor, CONVERT)
if (pin) {
  writeFileSync(lockPath, JSON.stringify({ ...lock, vendor }, null, 2) + '\n')
  console.log('assets.lock.json: vendor fijado')
}
