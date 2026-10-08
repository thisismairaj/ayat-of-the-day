# Contributing to ayat-of-the-day

Thanks for considering a contribution — this is a small project, so keep changes focused.

## Before you start

For anything beyond a typo fix, please open an issue first to discuss the change.

## Setup

```bash
git clone https://github.com/thisismairaj/ayat-of-the-day
cd ayat-of-the-day
npm install
npm run build     # compiles src/ to dist/ for the CLI (npm run dev to watch)
```

## Two separate pieces, two workflows

- **CLI** (`src/index.ts`, `src/ayat.ts`) — compiled with `tsc` to a committed `dist/`. Run `npm run build` after any change here; don't hand-edit `dist/`.
- **Claude Code plugin hook** (`hooks/register.tsx`) — a function-hook "mod" loaded directly by Claude Code's own TypeScript-capable loader. No build step: edit it directly and reload the plugin session to test.

Both independently implement the same day-of-year / local-calendar-day ayat formula, because the plugin hook runs sandboxed with no Node `fs`/`fetch` access and goes through `$.http.fetch`/`$.fs.write` instead. A logic change to that formula almost always needs to land in both places — see the comment at the top of `src/ayat.ts`.

## Testing

There's no automated test suite yet. Verify manually:

```bash
node dist/index.js            # full output
node dist/index.js --status   # status-line form
node dist/index.js --json     # JSON form
```

and exercise the plugin hook in a real Claude Code session (`claude --plugin-dir .`).

## Submitting

1. Fork the repo and create a branch named `your-username/short-description`.
2. Commit with a clear message explaining *why*, not just what changed.
3. Open a pull request against `master` describing the change and linking any related issue.

## Code style

- Keep it dependency-light — the CLI's only real "dependency" today is the global `fetch`.
- Match the existing style: small functions, minimal comments.
