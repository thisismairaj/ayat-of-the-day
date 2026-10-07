# ayat-of-the-day

![ayat-of-the-day](assets/banner.png)

A Claude Code mod that fetches a real Quranic ayat each day, live from
[api.alquran.cloud](https://alquran.cloud/api), for you to show in your own
status line — plus `/ayat` (or `/ayah`) to see the full verse.

Example status line: `📖 2:286 — Allah does not burden a soul beyond what it can bear.`

## Features

- Real ayat text, fetched live — not a hardcoded list
- Same ayat for everyone on a given day (deterministic, by day-of-year —
  no server-side "random" endpoint needed)
- Cached per day, so it only fetches once a day, and falls back to the last
  cached ayat if the network is down
- `/ayat` command shows the full verse and its reference (e.g. `2:255`) —
  `/ayah` works too, same command under both spellings
- Writes to a plain cache file your *own* status line script reads — not
  Claude Code's built-in "plugin notice" row, which always gets prefixed
  with the plugin's name and a warning icon by the engine, with no way for
  a plugin to turn that off
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

After installing, you still need to wire the cache file into your own status
line (below) — the plugin itself doesn't display anything on its own.

## How it works

Each session start, the mod computes a global ayah number from the day of
the year (1–6236, the total ayah count in the Quran), fetches that ayah's
text and reference from `api.alquran.cloud` (Saheeh International
translation), and writes it to `~/.claude/ayat-of-the-day-cache.json`. The
result is also cached internally via `$.store`, so later sessions the same
day reuse it instead of refetching, and if the API is ever unreachable, the
last cached ayat is written instead of nothing.

`/ayat` and `/ayah` are also registered — same command, two spellings —
showing the full verse text in the transcript on demand.

## Integrating with your status line

Claude Code's own `$.ui.status()` API pins a *separate* "plugin notice" row,
always prefixed with the plugin's name and a warning-style icon by the
engine — not configurable, and not the same thing as your real
`statusLine.command` row. So instead of using it, this mod writes the day's
ayat to a cache file, and you read it yourself from your status line script
as one more segment, the same way you'd integrate any other status source.

If your `~/.claude/settings.json` has a `statusLine.command` pointing at
your own script, add something like this to it:

```bash
ayat_cache="$HOME/.claude/ayat-of-the-day-cache.json"
if [ -f "$ayat_cache" ]; then
  today_local=$(date "+%Y-%m-%d")  # local day - matches the mod's own local-date cache key
  ayat_out=$(node -e '
    const fs = require("fs");
    try {
      const obj = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (obj.date !== process.argv[2] || obj.unavailable) process.exit(0);
      let text = String(obj.text || "");
      if (text.length > 100) text = text.slice(0, 99).trimEnd() + "…";
      process.stdout.write(`📖 ${obj.ref} — ${text}`);
    } catch {}
  ' "$ayat_cache" "$today_local" 2>/dev/null)
  [ -n "$ayat_out" ] && echo "$ayat_out"  # or append it as your own segment
fi
```

If you don't have a custom status line script yet, this can be the whole
thing — see [Claude Code's statusLine
docs](https://docs.claude.com/en/docs/claude-code) for the `settings.json`
shape.

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
