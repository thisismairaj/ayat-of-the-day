#!/usr/bin/env node
import { getTodaysAyat } from './ayat.js'

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

const HELP = `ayat-of-the-day - a real Quranic ayat, fetched live, every day

Usage:
  ayat-of-the-day [options]
  ayat [options]

Options:
  -s, --status   Single-line output for status bars (truncated to 100 chars)
  -j, --json     JSON output: {"ref","text","date","stale"}
  -p, --plain    Plain text, no emoji
  -h, --help     Show this help

Caches one ayat per local calendar day in ~/.claude/ayat-of-the-day-cache.json
- shared with the Claude Code plugin of the same name, if installed, so both
show the same answer for "today."
`

async function main() {
  const args = process.argv.slice(2)
  const statusMode = args.includes('--status') || args.includes('-s')
  const jsonMode = args.includes('--json') || args.includes('-j')
  const plainMode = args.includes('--plain') || args.includes('-p')
  const helpMode = args.includes('--help') || args.includes('-h')

  if (helpMode) {
    console.log(HELP)
    return
  }

  const { ayat, stale } = await getTodaysAyat()

  if (jsonMode) {
    console.log(JSON.stringify(ayat ? { ...ayat, stale } : { error: 'unavailable' }))
    if (!ayat) process.exitCode = 1
    return
  }

  if (!ayat) {
    console.error('Could not fetch an ayat - api.alquran.cloud is unreachable and nothing is cached yet.')
    process.exitCode = 1
    return
  }

  if (statusMode) {
    const icon = plainMode ? '' : '📖 '
    const staleNote = stale ? ' (cached, offline)' : ''
    console.log(`${icon}${ayat.ref}${staleNote} — ${truncate(ayat.text, 100)}`)
    return
  }

  const heading = plainMode
    ? `Ayat of the day - Quran ${ayat.ref} (Saheeh International)`
    : `📖 Ayat of the day — Quran ${ayat.ref} (Saheeh International)`
  console.log(heading)
  console.log('')
  console.log(ayat.text)
  if (stale) console.log('\n(cached - could not reach api.alquran.cloud for a fresh fetch)')
}

main()
