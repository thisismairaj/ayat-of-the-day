# ayat-of-the-day

![ayat-of-the-day](assets/banner.png)

A Claude Code status-line mod that shows a real Quranic ayat each day, fetched
live from [api.alquran.cloud](https://alquran.cloud/api), with a `/ayat`
command to see the full verse.

Example status line: `📖 2:286 — Allah does not burden a soul beyond what it can bear.`

## Features

- Real ayat text, fetched live — not a hardcoded list
- Same ayat for everyone on a given day (deterministic, by day-of-year —
  no server-side "random" endpoint needed)
- Cached per day via Claude Code's own plugin store, so it only fetches once
  a day, and falls back to the last cached ayat if the network is down
- `/ayat` command shows the full verse and its reference (e.g. `2:255`)
- Zero npm dependencies, zero build step — the hooks module runs directly as
  TypeScript, no `dist/` folder needed

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

No configuration needed — it works immediately on the next session start.

## How it works

Each session start, the mod computes a global ayah number from the day of
the year (1–6236, the total ayah count in the Quran), fetches that ayah's
text and reference from `api.alquran.cloud` (Saheeh International
translation), and sets it as the status line via `$.ui.status`. The result
is cached for the day via `$.store`, so later sessions the same day reuse it
instead of refetching, and if the API is ever unreachable, the last cached
ayat is shown instead of nothing.

A `/ayat` command is also registered, showing the full verse text in the
transcript on demand.

## Translation note

Ayat are fetched from api.alquran.cloud's `en.sahih` edition (Saheeh
International). This is a real, live-fetched translation from a public API —
not something generated or guessed.

## Development

This is a function-hooks mod, not a compiled plugin — `hooks/register.tsx`
runs directly, no build step. To develop it locally, use Claude Code's
`plugin-authoring` skill, which hot-reloads a mod folder on save.

Validate the plugin manifest and hooks module:

```bash
claude plugin validate .
```

## License

MIT
