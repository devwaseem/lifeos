import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const wrangler = join(root, 'node_modules/wrangler/bin/wrangler.js')
const localConfig = ['--local', '--config', 'wrangler.worker.toml']
const localState = [...localConfig, '--persist-to', '.wrangler/state']
const tablesQuery = `SELECT name FROM sqlite_schema WHERE type = 'table'
  AND substr(name, 1, 7) != 'sqlite_' AND substr(name, 1, 4) != '_cf_' ORDER BY name`
const quote = (name) => `"${name.replaceAll('"', '""')}"`

function run(args) {
  return execFileSync(process.execPath, [wrangler, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function query(sql) {
  return JSON.parse(run(['d1', 'execute', 'lifeos', ...localState, '--command', sql, '--json']))[0].results
}

function counts(database) {
  return database.prepare(tablesQuery).all().map(({ name }) => ({
    name,
    rows: database.prepare(`SELECT COUNT(*) AS rows FROM ${quote(name)}`).get().rows,
  }))
}

// Exports contain private training data. Keep them owner-only and under a gitignored directory.
process.umask(0o077)
const directory = join(root, '.wrangler/backups', `production-sync-${new Date().toISOString().replaceAll(':', '-')}`)
mkdirSync(directory, { recursive: true, mode: 0o700 })
const productionFile = join(directory, 'production.sql')
const backupFile = join(directory, 'local-before-sync.sql')
const importFile = join(directory, 'import.sql')

try {
  console.log('Copying production D1 to local D1. Production is read-only; local data will be replaced.')
  console.log('Avoid editing the local app until this command finishes, then reload it.')
  console.log('Exporting production...')
  // This is deliberately the only remote operation. Never execute SQL against production here.
  run(['d1', 'export', 'lifeos', '--remote', '--config', 'wrangler.toml', '--output', productionFile])
  const sql = readFileSync(productionFile, 'utf8')
  const snapshot = new DatabaseSync(':memory:')
  let expected
  try {
    snapshot.exec(sql)
    if (snapshot.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok'
      || snapshot.prepare('PRAGMA foreign_key_check').all().length > 0) {
      throw new Error('Production export failed SQLite integrity checks; local data has not been replaced.')
    }
    expected = counts(snapshot)
  } finally {
    snapshot.close()
  }

  console.log('Backing up local D1...')
  run(['d1', 'export', 'lifeos', ...localConfig, '--output', backupFile])
  const drops = query(tablesQuery).map(({ name }) => `DROP TABLE ${quote(name)};`).join('\n')
  writeFileSync(importFile, `PRAGMA defer_foreign_keys = ON;\n${drops}\n${sql}\n`)

  console.log('Replacing local D1...')
  // Wrangler executes the entire local file as one D1 batch, so an import error rolls back the replacement.
  run(['d1', 'execute', 'lifeos', ...localState, '--file', importFile, '--yes', '--json'])
  const countSql = expected.map(({ name }) =>
    `SELECT '${name.replaceAll("'", "''")}' AS name, COUNT(*) AS rows FROM ${quote(name)};`
  ).join('\n')
  const actualCounts = JSON.parse(run([
    'd1', 'execute', 'lifeos', ...localState, '--command', countSql, '--json',
  ])).flatMap((result) => result.results)
  for (const { name, rows } of expected) {
    const actual = actualCounts.find((table) => table.name === name)
    if (actual?.rows !== rows) throw new Error(`Row count mismatch for ${name}: expected ${rows}, got ${actual?.rows}`)
  }
  if (query('PRAGMA foreign_key_check').length > 0) throw new Error('Local foreign key check failed.')

  // A development branch may contain migrations newer than the production snapshot.
  console.log('Applying any newer local migrations (without demo seeding)...')
  run(['d1', 'migrations', 'apply', 'lifeos', ...localState])
  console.table(expected)
  console.log(`Local backup and production snapshot: ${relative(root, directory)}`)
  console.log('Done. Reload http://localhost:5173 to pull this snapshot into browser storage.')
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  if (error.stdout) console.error(String(error.stdout))
  if (error.stderr) console.error(String(error.stderr))
  console.error(`Any completed exports are preserved in ${relative(root, directory)}`)
  process.exitCode = 1
}
