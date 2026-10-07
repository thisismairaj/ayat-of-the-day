# ayat-of-the-day

![ayat-of-the-day](assets/banner.png)

Fetches a real Quranic ayat each day, live from
[api.alquran.cloud](https://alquran.cloud/api) — as a Claude Code mod, shown
while Claude is working (replacing the usual spinner verb, since that's when
you're actually looking at the screen with nothing else to read), with
`/ayat` or `/ayah` to see the full verse; and as a standalone CLI
(`npx ayat-of-the-day`) that works anywhere, not just inside Claude Code.

> **Changed in 0.5.0:** the ayat used to live in the status line, always
> visible but cramped and truncated with ellipses. It now replaces the
> spinner's verb instead - shown only while Claude is actively working,
> which is also the moment you're actually looking at the screen with
> nothing else to read. If anything about the spinner display looks off on
> your terminal, [open an issue](https://github.com/thisismairaj/ayat-of-the-day/issues).

## Features

- Real ayat text, fetched live — not a hardcoded list
- Same ayat for everyone on a given day (deterministic, by day-of-year —
  no server-side "random" endpoint needed)
- Cached per day, so it only fetches once a day, and falls back to the last
  cached ayat if the network is down
- `/ayat` command shows the full verse and its reference (e.g. `2:255`) —
  `/ayah` works too, same command under both spellings
- Shown in place of the spinner's usual verb while Claude works, not
  Claude Code's built-in "plugin notice" row (`$.ui.status()`), which always
  gets prefixed with the plugin's name and a warning icon by the engine,
  with no way for a plugin to turn that off
- The Claude Code mod itself has zero npm dependencies and zero build step —
  `hooks/register.tsx` runs directly as TypeScript. (The standalone CLI is a
  separate piece with its own minimal build - see Development below.)

## Requirements

- Claude Code with mod support (function-hooks plugins)

## Installation

Inside a Claude Code session, run:

```
/plugin marketplace add thisismairaj/ayat-of-the-day
/plugin install ayat-of-the-day
```

Or via the CLI:

```bash
claude plugin marketplace add thisismairaj/ayat-of-the-day
claude plugin install ayat-of-the-day
```

That's it — no further setup. It shows automatically the next time Claude is
working on something.

## CLI

Works standalone, with no Claude Code involved at all:

```bash
npx ayat-of-the-day              # full verse, formatted
npx ayat-of-the-day --status     # one line, truncated - for status bars
npx ayat-of-the-day --json       # {"ref","text","date","stale"}
npx ayat-of-the-day --plain      # no emoji
```

`ayat` works as a short alias for `ayat-of-the-day` too. The CLI caches to
`~/.claude/ayat-of-the-day-cache.json` and uses the exact same day-of-year
formula as the Claude Code mod, so even though the mod itself no longer
touches that file (it caches internally instead, for the spinner display),
both always compute the same ayat for "today" - same formula, same answer.

## How it works

Each session start, the mod computes a global ayah number from the day of
the year (1–6236, the total ayah count in the Quran), fetches that ayah's
text and reference from `api.alquran.cloud` (Saheeh International
translation), and caches it internally via `$.store` for the rest of the
day - later sessions the same day reuse it instead of refetching, and if the
API is ever unreachable, the last cached ayat is used instead of nothing.

While Claude is working, a `ui.render` hook on the `Spinner` component
rewrites its `message` field - normally a short verb like "Sauteing..." or
"Proofing..." - to today's ayat instead, truncated to fit one line. The
engine still draws its own elapsed-time, token, and effort info around it;
only the word/message text is replaced.

`/ayat` and `/ayah` are also registered — same command, two spellings —
showing the full verse text in the transcript on demand.

## Translation note

Ayat are fetched from api.alquran.cloud's `en.sahih` edition (Saheeh
International). This is a real, live-fetched translation from a public API —
not something generated or guessed.

## Development

Two separate pieces, two separate build stories:

**The Claude Code mod** (`hooks/register.tsx`) is not a compiled plugin — it
runs directly, no build step. To develop it locally, use Claude Code's
`plugin-authoring` skill, which hot-reloads a mod folder on save. Validate
the plugin manifest and hooks module:

```bash
claude plugin validate .
```

**The CLI** (`src/`) does need a build, since npm can't execute raw
TypeScript:

```bash
npm install
npm run build    # compiles src/ -> dist/
node dist/index.js --status
```

`dist/` is committed to the repo (same reason claude-pray commits its own
`dist/`): `npx github:thisismairaj/ayat-of-the-day` works straight off the
repo with no build step required of the person running it.

## License

MIT
