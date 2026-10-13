# scouter

Vegeta's scouter for Claude Code: a side pane with a live readout of your session inside a round "lens"
frame, drawn in the DBZ color scheme you pick (default `goku`: scouter-green readout, orange headings,
blue lens). Part of the ClaudeMods Dragon Ball Z family
(`kamehameha`, `scouter`, `saiyan-status`).

Type **`/scouter`** to open it. Type it again (or press **Close**) to put it away.

## What it shows

```
╭──────────────────────────────────────────╮
│ ◢ SCOUTER ◣ · Goku  Model claude-opus-5-5│
│                                          │
│ ⚡ POWER LEVEL                            │
│ 1,234,567                                │
│ IT'S OVER 9000!!!                        │
│                                          │
│ ⚡ KI (context)                           │
│ █████████████████████████▒···········    │
│ 126k / 200k (63%)                        │
│ System prompt                       3.1k │
│ System tools                       14.2k │
│ Messages                            109k │
│ Free space                           74k │
│                                          │
│ ⚡ STAMINA (5h)                           │
│ ████████████████▒····················    │
│ 41% · resets in 2h 13m                   │
│                                          │
│ ⚡ TRAINING (7d)                          │
│ ████▒································    │
│ 12% · resets in 3d 0h                    │
│                                          │
│ ⚡ ZENI                                   │
│ Zeni $1.24                               │
│ $0.31 per attack                         │
│                                          │
│ ⚡ BATTLE LOG                             │
│ Time 1h 05m · Attacks 4                  │
│ Techniques 25: Bash ×12 · Edit ×8 · Read │
│ ×5                                       │
│ Files edited 3 · Failed 1                │
│                                          │
│ [ Refresh ] [ Close ]                    │
╰──────────────────────────────────────────╯
```

| Section | What it is | Where the number comes from |
|---|---|---|
| Header | The color scheme in use, and the model you are talking to | `palette` setting; `$.session.model()` |
| **POWER LEVEL** | Total tokens this session: input + output + cache reads + cache writes, every turn (subagents too) | Summed from each `turn.complete`'s `usage` |
| **KI (context)** | How full the context window is, with a gauge, and a breakdown by category | `$.session.usage()`; breakdown from `$.session.usage({ breakdown: 'summary' })` (estimated locally, sends no requests) |
| **STAMINA (5h)** / **TRAINING (7d)** | Your rate-limit windows, how used, and when they reset. A **SPEND LIMIT** row appears when a gateway reports one | `rateLimits` of the usage reading |
| **ZENI** | Session cost in US dollars, and cost per attack (cost / turns) | `cost.usd` |
| **BATTLE LOG** | Time since the session started, attacks (turns), techniques (tool calls) with the top 3 tools, distinct files edited (Edit / Write / NotebookEdit), failed tool calls | Counted from `turn.complete` and `tool.call` |

Gauges are colored by the scheme's tokens: `ki` under 50%, `gold` 50-70%, `warn` 70-85%, `danger` from 85%
(in `goku`: blue, gold, orange, red). Headings use `heading`, readout text `readout`, the lens border
`frame`; dim text stays dim.
A figure Claude Code has not reported yet shows `--`, never 0. If you sign in with an API key you have
no rate-limit windows, so STAMINA and TRAINING read `--`.

### Alerts (toasts)

- **IT'S OVER 9000!!!** the first time the power level passes 9000 (once per session; `/clear` starts a new one).
- **Stamina 80%! / Stamina 90%! Rest until 3:40 PM** when the 5-hour window crosses 80% and 90%. Each
  threshold fires once per window; a new window (after the reset) can fire them again.

## Settings (`userConfig`)

All are rows in `/config` (or `pluginConfigs.scouter.options` in settings.json).

| Toggle | Default | What it does |
|---|---|---|
| `palette` | `goku` | The DBZ color scheme (`goku`, `vegeta`, `namek`, `frieza`, `super-saiyan-blue`, `ultra-instinct`, `majin-buu`, `kaioken`, `golden-frieza`, `super-saiyan-rose`), shown in the title as `◢ SCOUTER ◣ · Vegeta`. Also set by `/dbztheme` (shenron mod) for all DBZ mods at once. An unknown name falls back to `goku` |
| `over9000Toast` | on | The IT'S OVER 9000 toast |
| `staminaAlerts` | on | The 80% / 90% stamina toasts |
| `showBreakdown` | on | The category list under the KI gauge (fetched only while the pane is open, when the context changed) |
| `autoOpen` | **off** | Open the scouter by itself at session start, but only in the fullscreen layout where it docks as a sidebar and the terminal is wide enough (144+ columns) |

## Try it

```
claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/scouter
```

then type `/scouter`. Works in the terminal and in the desktop app.

## Check it

```
claude plugin validate D:/ClaudeProjects/ClaudeMods/mods/scouter
claude plugin test D:/ClaudeProjects/ClaudeMods/mods/scouter
```

The tests (`hooks/scouter.test.tsx`) mock the usage figures and check, on both the terminal and the
desktop surface: `/scouter` opens and closes the pane; POWER LEVEL, KI, STAMINA, TRAINING, ZENI and
BATTLE LOG draw the right numbers; missing figures read `--`; the 9000 toast fires exactly once (and not
at all when switched off); the stamina alerts fire once per threshold; `autoOpen` opens it on a
fullscreen terminal; `palette: namek` colors the headings, gauge, readout, lens and title in Namek's
scheme, and an unknown palette falls back to goku.

## Notes and limits

- Toasts have no color option in Claude Code, so the 9000 toast is plain text. The pane itself shows
  the power level and an `IT'S OVER 9000!!!` line in the scheme's danger color once you pass it.
- The power level counts from when the scouter loaded. A resumed session starts again from 0, because
  Claude Code does not hand plugins the token counts of earlier turns.
- "Rest until 3:40 PM" uses the clock time of the plugin sandbox. If it shows UTC instead of your local
  time, the "resets in 2h 13m" countdown in the pane is still right.
- Files: `hooks/register.tsx` (the hooks and the pane), `hooks/format.ts` (gauges and number formats),
  `hooks/palettes.ts` (the color schemes, an exact copy of `shared/palettes.ts`: change that one, then copy),
  `types/index.d.ts` (the pane's state), `.claude-plugin/plugin.json` (manifest and toggles).
