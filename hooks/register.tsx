import type { Register } from 'claude-code'

// Real ayat, fetched live from api.alquran.cloud (verified working: a test
// fetch for global ayah 262 correctly returned 2:255, Ayat al-Kursi, with
// its own surah/ayah numbers matching). 6236 is the total ayah count in the
// Quran; the day-of-year picks the same global ayah for everyone on a given
// day, deterministically, with no server-side "random" endpoint needed.
const TOTAL_AYAT = 6236
const EDITION = 'en.sahih' // Saheeh International translation

type Ayat = { ref: string; text: string; date: string }

// Local calendar day, not UTC - the ayat should roll over at the user's own
// midnight, not at 00:00 UTC (which was 5am in Karachi, for example). Date's
// local getters (getFullYear/getMonth/getDate, no "UTC") already reflect the
// machine's real timezone; the only trick is still routing them through
// Date.UTC() for the day-of-year subtraction, which sidesteps DST entirely
// by treating the local Y/M/D as if they were a UTC instant - same pattern
// as the original UTC-only version, just fed local components instead.
function todayLocal(): string {
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

async function fetchTodaysAyat($: any): Promise<Ayat | undefined> {
  const n = todaysGlobalAyahNumber()
  try {
    const res = await $.http.fetch(`https://api.alquran.cloud/v1/ayah/${n}/${EDITION}`)
    if (!res.ok) return undefined
    const body = JSON.parse(res.text)
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

async function getTodaysAyat($: any): Promise<{ ayat: Ayat | undefined; stale: boolean }> {
  const today = todayLocal()
  const cached = (await $.store.get('ayat-cache')) as Ayat | undefined

  if (cached?.date === today) {
    return { ayat: cached, stale: false }
  }

  const fresh = await fetchTodaysAyat($)
  if (fresh) {
    await $.store.set('ayat-cache', fresh)
    return { ayat: fresh, stale: false }
  }

  // Network failed - fall back to whatever was last cached, even if stale,
  // rather than showing nothing.
  return { ayat: cached, stale: cached !== undefined }
}

function fullText(ayat: Ayat | undefined, stale: boolean): string {
  if (!ayat) {
    return 'Could not fetch an ayat - api.alquran.cloud is unreachable and nothing is cached yet.'
  }
  const staleNote = stale ? '\n\n*(cached - could not reach api.alquran.cloud for a fresh fetch)*' : ''
  return `**Ayat of the day — Quran ${ayat.ref}** (Saheeh International)\n\n> ${ayat.text}${staleNote}`
}

// $.ui.status pins a SEPARATE "plugin notice" row (always framed with the
// plugin's name and a warning-style icon by the engine - not configurable,
// and not the same thing as a real statusLine.command row). That's not what
// we want here: we want to appear as one segment inside the user's own real
// status line. So instead we write today's ayat to a fixed cache file, and
// the user's statusline-command.sh reads it and appends it as a segment -
// the same integration pattern used for the claude-pray plugin.
async function homeDir($: any): Promise<string | undefined> {
  return (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
}

async function writeStatusCache($: any, ayat: Ayat | undefined, stale: boolean) {
  const home = await homeDir($)
  if (!home) return // nowhere reliable to write - statusline-command.sh just won't find anything
  const payload = ayat ? { ...ayat, stale } : { date: todayLocal(), stale: true, unavailable: true }
  try {
    await $.fs.write(`${home}/.claude/ayat-of-the-day-cache.json`, JSON.stringify(payload))
  } catch {
    // best-effort - a write failure here shouldn't block session start
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const { ayat, stale } = await getTodaysAyat($)
    await writeStatusCache($, ayat, stale)

    await $.command.register({
      name: 'ayat',
      description: "Show today's ayat in full, fetched live from api.alquran.cloud.",
    })

    return next(e)
  })

  on('command.run', { command: 'ayat' }, async $ => {
    const { ayat, stale } = await getTodaysAyat($)
    return { text: fullText(ayat, stale) }
  })

  // Draw the CommandOutput row ourselves, from a fresh lookup, instead of
  // letting the engine's default renderer frame the command.run text with a
  // "plugin-name: " prefix.
  on('ui.render', { component: 'CommandOutput', props: { command: 'ayat' } }, async ($, e) => {
    const { Markdown } = $.ui.resolve(e)
    const { ayat, stale } = await getTodaysAyat($)
    return <Markdown text={fullText(ayat, stale)} />
  })
}
