# ClaudeMods

Dragon Ball Z themed mods for Claude Code itself (function-hook plugins on the 2.1.296 plugin API):
a Kamehameha band with power gauges, a Scouter pane, a Saiyan status line and Shenron with Dragon Balls,
sharing 10 color schemes. The user tries them before installing; they like things done end to end,
toggleable features, and plain explanations.

## Read first
- `PROGRESS.md` (log and current state), `WORKFLOW.md` (who built what), `README.md`, each mod's README.
- `specs/THEME.md` (palette, glyphs, vocabulary) and `specs/COMMON.md` (how a mod is built here).
- `WORKFLOW.html` is the picture of how the project was built, drawn from `workflow.json` by
  `_brain/workflow.py` on each /save-progress: edit the JSON (or let /save-progress do it), never the HTML.

## Layout
- `mods/kamehameha`, `mods/scouter`, `mods/saiyan-status`, `mods/shenron`: one plugin each
  (`.claude-plugin/plugin.json`, `hooks/register.tsx`, tests in `hooks/*.test.ts(x)`, `types/index.d.ts`).
- `shared/palettes.ts`: CANONICAL color schemes; each mod keeps an identical copy at `hooks/palettes.ts`.
- `specs/`: the station briefs. `try-mods.cmd`: starts Claude Code with the mods loaded.

## Commands
- Try: `try-mods.cmd` (all four) or `try-mods.cmd <mod>` (`claude --plugin-dir mods/<mod>`).
- Check: `claude plugin validate mods/<mod>` and `claude plugin test mods/<mod>`. No node or tsc on this PC.

## Rules
- Change colors in `shared/palettes.ts`, then copy it into all four mods' `hooks/palettes.ts`.
- Leave `SHENRON_RNG` unset outside tests (it fixes the random numbers).
- Every hide/close control must say how to bring it back (`/gauges` for the band).

## Gotchas
- The plugin API changes per Claude Code release; trust the build's own `claude-code.d.ts`.
- `$.session.compact()` is refused inside a `command.run` hook: answer, then compact from a timer.
- Toasts take no color, and a mod's newer toast replaces its older one: join same-moment messages.
- A pane opened unasked only seats at 144+ columns.
- Plugins can't add Claude Code themes; `/dbztheme` only recolors the DBZ windows.
- Git Bash rewrites `claude -p "/cmd"` into a path: smoke-test slash commands from PowerShell.
- Test kit: no `toBeCloseTo`; `session.start` needs `{cwd, surface, isInteractive}`; `command.run` needs
  `origin` and `presentation`.
