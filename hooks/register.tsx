import type { Register } from 'claude-code'

// Real ayat, fetched live from api.alquran.cloud (verified working: a test
// fetch for global ayah 262 correctly returned 2:255, Ayat al-Kursi, with
// its own surah/ayah numbers matching). 6236 is the total ayah count in the
// Quran; the day-of-year picks the same global ayah for everyone on a given
// day, deterministically, with no server-side "random" endpoint needed.
const TOTAL_AYAT = 6236
const EDITION = 'en.sahih' // Saheeh International translation

type Ayat = { ref: string; text: string; date: string }

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0)
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start
  return Math.floor(diff / 86400000)
}

function todaysGlobalAyahNumber(): number {
  return (dayOfYear(new Date()) % TOTAL_AYAT) + 1
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
      date: todayUTC(),
    }
  } catch {
    return undefined
  }
}

async function getTodaysAyat($: any): Promise<{ ayat: Ayat | undefined; stale: boolean }> {
  const today = todayUTC()
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

function fullText(ayat: Ayat | undefined, stale: boolean): string {
  if (!ayat) {
    return 'Could not fetch an ayat - api.alquran.cloud is unreachable and nothing is cached yet.'
  }
  const staleNote = stale ? '\n\n*(cached - could not reach api.alquran.cloud for a fresh fetch)*' : ''
  return `**Ayat of the day — Quran ${ayat.ref}** (Saheeh International)\n\n> ${ayat.text}${staleNote}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const { ayat, stale } = await getTodaysAyat($)

    if (ayat) {
      const staleNote = stale ? ' (cached, offline)' : ''
      $.ui.status(`📖 ${ayat.ref}${staleNote} — ${truncate(ayat.text, 110)}`)
    } else {
      $.ui.status(`📖 Ayat of the day unavailable (api.alquran.cloud unreachable)`)
    }

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
