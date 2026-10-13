# Station brief: `scouter` mod (the full readout)

First read `D:\ClaudeProjects\ClaudeMods\specs\COMMON.md` and `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`.
Your folder: `D:\ClaudeProjects\ClaudeMods\mods\scouter\`. Plugin name: `scouter`.

## What it is
Vegeta's scouter as a side pane: a live readout of everything useful about the session. Opened with
the slash command `/scouter` (toggle open/closed), drawn by a `ui.render` hook on
`{ component: 'Pane', requestId: 'scouter' }` (see examples/pane.tsx). Scouter-green text on the
terminal, orange headings, framed like a scouter lens (a `Box` with `round` border).

## Sections (top to bottom, sized to `e.props.bodyColumns`)
1. Header: `◢ SCOUTER ◣  Model <name>` (model name if the API gives it).
2. **POWER LEVEL**: total tokens this session (sum of turn usages: input + output + cache reads/writes;
   keep a running sum in `$.state` from `turn.complete`'s `usage`, or better if `$.session.usage()` /
   cost data gives totals). Big number with thousands separators. When it passes 9000 the first time in
   a session: toast `IT'S OVER 9000!!!` (kaioken-red) and keep a flag so it fires once.
3. **KI (context)**: gauge bar + `126k / 200k (63%)`, colored by THEME's rule. Below it a breakdown by
   category from `$.session.usage({ breakdown: 'summary' })` (system prompt, tools, memory files,
   messages, free space...: read `ContextBreakdownDetail` and the breakdown's type for the real field
   names). Only fetch the breakdown when the pane is open and on `session.measure` with `context`
   changed; never in the render hook itself (compute in the event/timer, store the result in state).
4. **STAMINA (5h)** and **TRAINING (7d)**: each rate-limit window as a gauge + `41%` + `resets in 2h 13m`
   (from `resetsAt`). `--` when the list is empty (API key users have none). Spend limit too if present.
5. **ZENI**: `$1.24` session cost (`cost.usd`), and cost per attack (cost / turns).
6. **BATTLE LOG**: session time since `startedAt`, attacks (turns), techniques (tool calls) with the top
   3 tools by count (`Bash ×12 · Edit ×8 · Read ×5`), files edited count (Edit/Write/NotebookEdit
   distinct paths), failed tool calls if the result says so.
7. Footer: `[ Refresh ]` and `[ Close ]` Buttons.

## Alerts (toasts; each toggleable)
- Over 9000 (once per session).
- Stamina: crossing 80% and 90% of the 5h window: `Stamina 90%! Rest until 3:40 PM` (local time of
  resetsAt), once per threshold per window reset.

## Toggles (`userConfig`, boolean default true unless said)
`over9000Toast`, `staminaAlerts`, `showBreakdown`, `autoOpen` (default FALSE: open the pane at
session start when the terminal is fullscreen/wide enough; read the pane notes on `isPlaced` and
`viewport.isFullscreen`).

## Done means
validate clean; tests that (a) `/scouter` opens the pane and it draws the POWER LEVEL / KI / ZENI
sections on terminal and desktop with mocked usage figures, (b) the 9000 toast fires once. Then
report-outcome as COMMON.md says.
