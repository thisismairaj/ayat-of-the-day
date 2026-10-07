// Shared ayat-fetching and caching logic for the CLI. The Claude Code mod
// (hooks/register.tsx) has its own copy of this same logic, because it runs
// in a sandboxed hooks environment with no Node/fs access - it goes through
// $.http.fetch and $.fs.write instead of the real fetch/fs used here. Both
// use the exact same formula (day-of-year, local calendar day, 6236 total
// ayat) and the same cache file, so a user running both gets one consistent
// answer for "today," whichever one fetched it first.
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const TOTAL_AYAT = 6236
const EDITION = 'en.sahih' // Saheeh International translation
const CACHE_PATH = path.join(os.homedir(), '.claude', 'ayat-of-the-day-cache.json')

export type Ayat = { ref: string; text: string; date: string }

// Local calendar day, not UTC - the ayat should roll over at the user's own
// midnight, not at 00:00 UTC.
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayOfYearLocal(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0)
  const cur = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((cur - start) / 86400000)
}

function todaysGlobalAyahNumber(): number {
  return (dayOfYearLocal(new Date()) % TOTAL_AYAT) + 1
}

async function fetchTodaysAyat(): Promise<Ayat | undefined> {
  const n = todaysGlobalAyahNumber()
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/ayah/${n}/${EDITION}`)
    if (!res.ok) return undefined
    const body: any = await res.json()
    const data = body?.data
    if (!data?.text || data?.surah?.number === undefined || data?.numberInSurah === undefined) {
      return undefined
    }
    return {
      ref: `${data.surah.number}:${data.numberInSurah}`,
      text: String(data.text),
      date: todayLocal(),
    }
  } catch {
    return undefined
  }
}

function readCache(): (Ayat & { stale?: boolean; unavailable?: boolean }) | undefined {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return undefined
  }
}

function writeCache(ayat: Ayat | undefined, stale: boolean) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
    const payload = ayat ? { ...ayat, stale } : { date: todayLocal(), stale: true, unavailable: true }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload))
  } catch {
    // best-effort - a write failure here shouldn't crash the CLI
  }
}

export async function getTodaysAyat(): Promise<{ ayat: Ayat | undefined; stale: boolean }> {
  const today = todayLocal()
  const cached = readCache()

  if (cached?.date === today && !cached.unavailable) {
    return { ayat: cached, stale: false }
  }

  const fresh = await fetchTodaysAyat()
  if (fresh) {
    writeCache(fresh, false)
    return { ayat: fresh, stale: false }
  }

  // Network failed - fall back to whatever was last cached, even if stale,
  // rather than showing nothing. Still write the cache so the Claude Code
  // mod side (if also installed) sees the same fallback state.
  const fallback = cached && !cached.unavailable ? cached : undefined
  writeCache(fallback, fallback !== undefined)
  return { ayat: fallback, stale: fallback !== undefined }
}
