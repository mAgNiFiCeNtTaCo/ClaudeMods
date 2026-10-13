# Station brief: `saiyan-status` mod (status line, transformations, Senzu, Dragon Balls)

First read `D:\ClaudeProjects\ClaudeMods\specs\COMMON.md` and `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`.
Your folder: `D:\ClaudeProjects\ClaudeMods\mods\saiyan-status\`. Plugin name: `saiyan-status`.

## 1. Status line entry (`$.ui.status(text)`, toggle `statusLine`)
One compact line, updated on `session.measure` and `turn.complete`:
`⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24 · ★4`
- Tier name from context fill (THEME tiers: Base, Kaioken, SSJ, SSJ2, SSJ3, Limit Breaker).
- Stamina = 5h rate-limit window percent + time to reset; omit the part when there are no rate limits.
- Zeni = session cost USD. ★n = Dragon Balls held (section 4).
- `--` for figures not read yet. Keep it short (it shares the line with other things).

## 2. Transformations (toggle `transformToasts`)
When the context fill crosses into a new tier going UP, toast once:
`Goku went Super Saiyan 2! (Ki 71%)`; Limit Breaker: `LIMIT BREAKER! Ki 96%: eat a Senzu Bean (/senzu)`.
Going down (after a compact) toast `Powered down to Base. Ki 12%`. Keep the last tier in `$.state`.

## 3. Senzu Bean (toggle `senzu`)
- Slash command `/senzu`: compacts the conversation (`$.session.compact()`, read its doc and result),
  then answers with a line like `Ate a Senzu Bean! Ki 87% → 14% (freed 146k)`.
- When Ki reaches 85% the first time (per session, and again after each compact): toast
  `Ki at 85%: a Senzu Bean is ready (/senzu)`. Never compact automatically unless the toggle
  `autoSenzu` (default FALSE) is on, then compact at 92%.

## 4. Dragon Balls (toggle `dragonBalls`)
A small game across sessions, kept in `$.store` (it must survive restarts):
- Earn 1 Dragon Ball for each completed turn that used at least 3 tool calls and did not error
  (an "attack that landed"). Toast `Found the 4-Star Dragon Ball! (★4/7)`.
- At 7: toast `🐉 SHENRON HAS BEEN SUMMONED! Make your wish...`, count resets to 0, and a lifetime
  `wishes` counter goes up.
- `/dragonballs` command answers with the collection: `★★★★☆☆☆ 4/7 · wishes granted: 2`.

## 5. Rate-limit warnings (toggle `staminaWarnings`)
Toast when the 5h window crosses 80% and 90% (`Stamina 90%! Rest until 3:40 PM`, once per threshold per
window reset). The scouter mod owns this toast by default, so default `staminaWarnings` to FALSE here;
the two never double up.

## Toggles (`userConfig`)
`statusLine` (true), `transformToasts` (true), `senzu` (true), `autoSenzu` (false),
`dragonBalls` (true), `staminaWarnings` (false).

## Done means
validate clean; tests for: tier from fill (all boundaries), the status text with and without rate
limits, a transformation toast firing once on crossing, Dragon Ball earn + Shenron reset at 7 (with
mocked store), `/senzu` calling compact. Then report-outcome as COMMON.md says.
