# Station brief: `kamehameha` mod (the progress bar)

First read `D:\ClaudeProjects\ClaudeMods\specs\COMMON.md` and `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`.
Your folder: `D:\ClaudeProjects\ClaudeMods\mods\kamehameha\`. Plugin name: `kamehameha`.

## What it is
A band above the prompt (`ui.render` on `{ component: 'AbovePrompt' }`) that turns every turn into a
Kamehameha. The user's headline ask: "the progress bar can be like a kamehameha".

## While a turn runs (`e.props.isWorking`)
- A charging bar that grows as the turn goes on. A turn has no true percent, so make charge a mix of
  time and activity: e.g. `charge = 1 - exp(-elapsed/45s)` plus a bump per tool call / model step,
  capped at 95% until the turn completes. It must visibly move at least every second or two.
- The chant advances with charge, in 5 stages: `Ka...` `Me...` `Ha...` `Me...` `HA...!!` (20% each).
- Draw it like an energy ball gathering in cupped hands, e.g.
  `Ka... Me... Ha...  ⊂(◉)⊃ ▓▓▓▓▓▓▓▒▒░░░░░░░░  58%  ⚡ 7 techniques · 0:41`
  the ball glyph growing `.` `o` `O` `◎` `◉` with charge, the bar in ki-blue, brighter as it fills.
- A subtle shimmer/pulse animation (cycle partial glyphs) driven by `$.clock.every` (<= 4 fps), writing
  the frame index to `$.state`; stop the timer when the turn ends.
- Show live figures: elapsed time, tool calls ("techniques"), and the current tool's name if the API
  gives it cheaply (e.g. last `tool.call`'s tool), e.g. `⚡ Bash`.

## When the turn completes (`turn.complete`)
- FIRE: for ~4 seconds the band shows the beam across the full width (`e.props.bodyColumns`):
  `⊂(◉)⊃═════════════════════════════════>  HAAAAAA!!!` in beam-white/ki-blue. Animate it shooting
  out left to right over the first second if you can do it cheaply (a few frames), then hold.
- Then settle into a one-line summary of the last attack:
  `Last Kamehameha: 1:12 · 14 techniques · 23.4k tokens · Ki 63%` (tokens from `turn.complete`'s
  `usage` if present; Ki from `$.session.usage().context`).
- If the turn was interrupted or errored, show a fizzle instead: `⊂(·)⊃ ...fizzled` in dim.

## Ki gauge (second line, toggle `showKiGauge`)
`KI ████████████░░░░░░░░ 63%  (126k / 200k)` colored by THEME's gauge rule, from
`$.session.usage().context` (read `SessionContextUsage` for the field names). `--` before any reading.
Refresh on `session.measure`.

## Toggles (`userConfig`, all boolean default true)
`animate` (shimmer + beam animation; off = static bars), `showKiGauge`, `showSummary` (last-attack line
when idle), `fireBeam` (the 4 s beam).
Plus a `[ Hide ]` Button in the band like the band.tsx example.

## Done means
validate clean, a test that mounts the band on terminal and desktop and checks: idle with no turn yet
draws nothing or only the gauge; working state shows a chant stage + percent; after turn.complete the
beam/summary appears. Then report-outcome as COMMON.md says.
