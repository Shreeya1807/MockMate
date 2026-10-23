import { DatabaseSync, backup } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
if (process.env.DATABASE_URL || process.env.REQUIRE_DATABASE_URL === '1')
  throw new Error('Use pg_dump or your PostgreSQL provider backup tools for hosted storage.')
const source = process.env.DATABASE_PATH || 'data/mockmate.sqlite'
const target = resolve(
  process.argv[2] || `backups/mockmate-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
)
mkdirSync(dirname(target), { recursive: true })
const db = new DatabaseSync(source, { readOnly: true })
try {
  await backup(db, target)
  console.log(`Consistent SQLite backup written to ${target}`)
} finally {
  db.close()
}
