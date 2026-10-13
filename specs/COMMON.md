# How every ClaudeMods station works (read this first)

You are one station of a nodeterm team building Dragon Ball Z themed **Claude Code mods** (function-hook
plugins that change Claude Code's own interface). Three stations work at once in the same folder
`D:\ClaudeProjects\ClaudeMods` (no git, no worktrees). Build ONLY your own mod, in ONLY your own folder.

## Read before writing code
1. `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`: palette, glyphs, vocabulary, shared rules. Follow it.
2. The mod-authoring docs of this Claude Code build (2.1.296). Read them as files; do NOT invoke the
   plugin-authoring skill (it would tell you to write somewhere else):
   - Guide: `~/AppData/Local/Temp/claude/bundled-skills/2.1.296/2d12c0db36af50f0d63d0c76a7bb06aa/plugin-authoring/reference.md`
   - Examples (each a complete hooks module): `.../plugin-authoring/examples/band.tsx`, `band-state.d.ts`,
     `pane.tsx`, `pane-state.d.ts`, `tool-call.ts` (same folder as above, `examples/`)
   - The API (about 21,000 lines, the authority; grep it, then read the declaration you land on):
     `~/AppData/Local/Temp/claude/bundled-skills/2.1.296/2d12c0db36af50f0d63d0c76a7bb06aa/plugin-authoring/types/claude-code.d.ts`
     Useful greps: `usage: (args?: SessionUsageArgs)`, `export type SessionUsage`, `SessionContextUsage`,
     `SessionRateLimit`, `'session.measure'`, `AbovePrompt: {`, `Pane: {`, `export type TextProps`,
     `export type RasterProps`, `'turn.complete'`, `'turn.step'`, `'tool.call'`, `status:`, `toast:`,
     `clock`, `every:`, `command.register`, `userConfig`, `claude-code/testing`.

## The mod's shape (three files plus a contract)
- `.claude-plugin/plugin.json`: `{ "name": "<mod-name>", "version": "0.1.0", "description": "<one line>", "types": "./types/index.d.ts", "userConfig": { ... } }`
- `hooks/hooks.json`: `{ "modules": ["./register.tsx"] }`
- `hooks/register.tsx`: `export const register: Register = (on, options) => { ... }`, `Register` imported
  as a type from `'claude-code'`. JSX compiles against the global `h`; elements come from
  `const { Box, Text, Button } = $.ui.resolve(e)`. No DOM, no Node, no `import()`.
- `types/index.d.ts`: declares every `$.state` value under `interface PluginState { '<mod-name>': {...} }`.
- State a drawing reads lives in `$.state` (atoms via `atom/read/update` from `'claude-code'`), never
  in module variables (a hot reload wipes those). Values that must survive sessions go in `$.store`.
- Render hooks never write state; write from handlers, timers (`$.clock.every`) or other events.

## Check it (required before you report success)
- `claude plugin validate D:/ClaudeProjects/ClaudeMods/mods/<mod-name>` must report no errors.
- Write at least one `hooks/*.test.ts` (or `.test.tsx`) for the main behaviour (kit: `claude-code/testing`,
  `test`, `expect`, `mock`; mount UI on BOTH `terminal` and `desktop` surfaces) and run
  `claude plugin test D:/ClaudeProjects/ClaudeMods/mods/<mod-name>`; it must pass.
- There is no node/tsc on this PC: `validate` + `test` are the checks.
- Write `mods/<mod-name>/README.md`: what it shows, every `userConfig` toggle, and how to try it:
  `claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/<mod-name>`.

## Windows notes
- Claude Code's Bash tool wraps commands in `bash -c '...'`: never put an apostrophe inside a heredoc.
  Write files with the Write tool.
- Do not open, print or copy secrets. Do not touch other projects in D:\ClaudeProjects.

## When you are done
Report your outcome with the nodeterm shim (this exact line, absolute path):

    sh "~/AppData/Roaming/node-terminal/canvas-control/nodeterm.sh" report-outcome --outcome succeeded --note "<mod-name>: validate ok, N tests pass"

or, if anything is broken, unfinished or you are unsure:

    sh "~/AppData/Roaming/node-terminal/canvas-control/nodeterm.sh" report-outcome --outcome failed --note "<one line why>"

Then end your turn with a short summary: files written, what validate/test said, anything the engine
could not do that the spec asked for (and what you did instead).
