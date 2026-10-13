# ClaudeMods: Dragon Ball Z HUD for Claude Code

Four Claude Code mods (function-hook plugins) that turn the Claude Code terminal into a Dragon Ball Z
HUD. They are for trying out before installing anything for good: each is loaded straight from its
folder for one session.

| Mod | What it shows |
|---|---|
| `mods/kamehameha` | Band above the prompt: every turn charges a Kamehameha (`Ka... Me... Ha...` + growing ki ball and bar), fires a beam when the turn ends, then shows a last-attack summary. Second line: Ki (context window) gauge. |
| `mods/scouter` | `/scouter` opens a side pane: Power level (tokens), Ki (context) with breakdown, Stamina (5h limit) and Training (7d limit) with reset times, Zeni (cost), battle log (time, turns, tool calls, files edited). "IT'S OVER 9000!!" toast. |
| `mods/saiyan-status` | Status line (`⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24`), transformation toasts as context fills, `/senzu` (compact). Dragon Balls moved to the `shenron` mod. |
| `mods/shenron` | Dragon Balls turn up at random while you work (`/grab` within 90 s); `/dragonradar` shows your collection; at 7, Shenron coils around a big window and grants a wish (compact, a secret color scheme, wisdom...). `/shenron preview` shows him anytime. `/dbztheme` switches the color scheme of every DBZ mod. |

## Try them
- All four: double-click `try-mods.cmd`, or run `try-mods.cmd` in a terminal.
- One mod: `try-mods.cmd scouter` (or `kamehameha`, `saiyan-status`, `shenron`).
- By hand: `claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/<mod>`.

Every feature can be switched off in the config menu (`/config`, the mod's rows) or under
`pluginConfigs` in settings. Each mod's README lists its toggles.

## Color schemes
`kamehameha` and `scouter` draw in one of these DBZ color schemes, picked by each mod's `palette` setting
(default `goku`, the original look). **`/dbztheme`** (from the `shenron` mod) switches all mods at once.
The table lives in `shared/palettes.ts`; each mod keeps an identical copy at `hooks/palettes.ts`.

| Palette | Name | Tagline |
|---|---|---|
| `goku` | Goku | Orange gi, blue ki. The classic. |
| `vegeta` | Vegeta | Saiyan armor and a Final Flash. |
| `namek` | Namek | Green skies and Piccolo calm. |
| `frieza` | Frieza | Purple, white and a Death Beam. |
| `super-saiyan-blue` | Super Saiyan Blue | God ki, cyan aura. |
| `ultra-instinct` | Ultra Instinct | Silver, quiet, untouchable. |
| `majin-buu` | Majin Buu | Pink, bouncy, turns things into candy. |
| `kaioken` | Kaioken | Times twenty. Everything is red. |
| `golden-frieza` | Golden Frieza | Gold and violet. **Wish only** (Shenron grants it). |
| `super-saiyan-rose` | Super Saiyan Rose | Rose ki, silver edge. **Wish only** (Shenron grants it). |

Each palette sets the same tokens: `ki` (charge, low gauges), `beam` (beam core), `heading` (labels),
`frame` (borders), `gold` (50-70% fill, highlights), `warn` (70-85%), `danger` (85%+, warnings) and
`readout` (pane text). Dim text stays dim in every scheme.

## Layout
- `mods/<mod>/`: the plugin (`.claude-plugin/plugin.json`, `hooks/register.tsx`, tests, `types/`).
- `specs/`: the briefs the build stations worked from (`THEME.md` is the shared look).
- Checks: `claude plugin validate mods/<mod>` and `claude plugin test mods/<mod>`.
