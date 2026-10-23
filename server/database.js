import { openStore } from './store.js'
export async function openDatabase() {
  if (process.env.DATABASE_URL) {
    const { openPostgresStore } = await import('./postgres-store.js')
    return openPostgresStore(process.env.DATABASE_URL)
  }
  if (process.env.REQUIRE_DATABASE_URL === '1')
    throw new Error('DATABASE_URL is required for persistent hosted storage')
  return openStore()
}
