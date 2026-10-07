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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

function spinnerMessage(ayat: Ayat | undefined, stale: boolean): string {
  if (!ayat) return '📖 Ayat unavailable'
  // ui.render for Spinner fires on every animation tick (many times a
  // second), and the engine appends its own elapsed-time/mode suffix after
  // whatever we return. A long line wraps on normal terminal widths, and as
  // the elapsed-seconds digit count changes ("9s" -> "10s"), the wrap point
  // shifts - the whole block visibly reflows at high frequency, which reads
  // as the text "moving." 100 chars is a middle ground: enough of the ayat
  // to be worth reading, short enough to stay on one line on most terminal
  // widths.
  return `📖 ${ayat.ref} — ${truncate(ayat.text, 100)}`
}

async function commandResult($: any): Promise<{ text: string }> {
  const { ayat, stale } = await getTodaysAyat($)
  return { text: fullText(ayat, stale) }
}

async function commandOutput($: any, e: any) {
  const { Markdown } = $.ui.resolve(e)
  const { ayat, stale } = await getTodaysAyat($)
  return <Markdown text={fullText(ayat, stale)} />
}

// Cached once per session, read synchronously from the Spinner hook (which
// fires on every animation tick, often several times a second) instead of
// re-reading $.store on every single render. Set once in session.start,
// reset naturally on a hot reload since module-level state doesn't survive
// one (session.start fires again after a reload too).
let sessionAyat: Ayat | undefined
let sessionStale = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const { ayat, stale } = await getTodaysAyat($)
    sessionAyat = ayat
    sessionStale = stale

    // Two spelling aliases, same command - "ayah" is the more standard
    // transliteration, "ayat" the more common one in casual use. Registering
    // both avoids the exact spelling confusion that caused real problems
    // earlier in this project (an unrelated "ayah-of-the-day@inline" plugin
    // entry got mixed up with this "ayat-of-the-day" one).
    await $.command.register({
      name: 'ayat',
      description: "Show today's ayat in full, fetched live from api.alquran.cloud.",
    })
    await $.command.register({
      name: 'ayah',
      description: "Alias for /ayat - show today's ayat in full.",
    })

    return next(e)
  })

  on('command.run', { command: 'ayat' }, $ => commandResult($))
  on('command.run', { command: 'ayah' }, $ => commandResult($))

  // Draw the CommandOutput row ourselves, from a fresh lookup, instead of
  // letting the engine's default renderer frame the command.run text with a
  // "plugin-name: " prefix. One hook per command name - the matcher's
  // "command" value has to be a literal for the engine to recognize this as
  // answering its own command instead of a generic gate.
  on('ui.render', { component: 'CommandOutput', props: { command: 'ayat' } }, ($, e) => commandOutput($, e))
  on('ui.render', { component: 'CommandOutput', props: { command: 'ayah' } }, ($, e) => commandOutput($, e))

  // Replace the spinner's word/verb ("Sauteing...", "Proofing...") with
  // today's ayat while Claude is working - the moment the user is actually
  // looking at the screen with nothing else to read. Rewriting just
  // `message` (not drawing a whole custom tree) keeps the engine's own
  // elapsed-time/token/effort info and ellipsis animation intact; it only
  // supplies the text that word/message would otherwise show.
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    const message = spinnerMessage(sessionAyat, sessionStale)
    return next({ ...e, props: { ...e.props, message } })
  })
}
