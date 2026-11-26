import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')

/** Verifica `lock[key]` ({archivo: sha256}) contra los archivos bajo `root`. */
export function checkAssets(lockPath, root, key = 'files') {
  const entries = Object.entries(JSON.parse(readFileSync(lockPath, 'utf8'))[key] ?? {})
  const missing = []
  const mismatched = []
  for (const [name, hash] of entries) {
    const f = join(root, name)
    if (!existsSync(f)) missing.push(name)
    else if (sha256(f) !== hash) mismatched.push(name)
  }
  return { ok: !missing.length && !mismatched.length, missing, mismatched }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = resolve('assets.lock.json')
  let bad = false
  for (const [key, root] of [['files', 'public/models/rig10'], ['vendor', 'vendor/visor']]) {
    const r = checkAssets(lock, resolve(root), key)
    if (r.ok) continue
    bad = true
    r.missing.forEach((n) => console.error(`FALTA       ${root}/${n}`))
    r.mismatched.forEach((n) => console.error(`HASH DISTINTO ${root}/${n}`))
  }
  if (bad) {
    console.error('Assets inválidos. Corré: npm run sync-assets')
    process.exit(1)
  }
  console.log('assets OK')
}
