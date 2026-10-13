# ClaudeMods: progress log

Dragon Ball Z themed mods for Claude Code itself (function-hook plugins, Claude Code 2.1.296 plugin API):
a Kamehameha progress band with power gauges, a Scouter pane, a Saiyan status line and Shenron with
Dragon Balls, all sharing 10 color schemes. Built to try out before installing.

## Where it stands (2026-10-13)
- Four mods in `mods/`, each passes `claude plugin validate` and `claude plugin test`:
  kamehameha 19 tests, scouter 9, saiyan-status 14, shenron 28.
- Try them: `try-mods.cmd` (all four) or `try-mods.cmd <mod>`; nothing is installed.
- Checked live on 2026-10-13: a fresh `try-mods.cmd` session drew the gauges (KI, STAMINA 5h, TRAINING 7d,
  ZENI, `[ Hide (back: /gauges) ]`), the saiyan status line and the mini bars on the prompt-hint line.
  Later also live: Shenron's coil above the gauges and his tail on the hint line; the user found and
  `/grab`bed 4 Dragon Balls. Not yet seen live by me: the Kamehameha charge/beam, `/scouter`, `/shenron`, `/dbztheme`.
- Not installed anywhere; local git history, no GitHub (user's choice).

## Log
### 2026-10-13: first build (nodeterm team of 5 stations), gauges, Shenron, color schemes
- **Team run** in the shared working tree (no worktrees, by request): briefs in `specs/` (`THEME.md`,
  `COMMON.md`, one per mod); stations Kamehameha, Scouter and Saiyan-Status built the first three mods
  (14:17-14:28); Palettes and Shenron followed (14:57-16:13). Detail per session in `WORKFLOW.md`.
- **kamehameha**: band above the prompt. Charge bar with the chant `Ka... Me... Ha... Me... HA...!!` and
  a growing ball; charge = `1-exp(-(t/45s + 0.08*tools + 0.04*steps))`, capped at 95%. Beam fires 4 s
  at turn end, then a "Last Kamehameha" summary; interrupted turns fizzle.
- **Power gauges** (user asked for bars tracking usage/context): KI (context, "Senzu Bean time (/compact)"
  at 85%), STAMINA 5h and TRAINING 7d with a time marker and pace forecast ("on pace ✓" / "runs out in
  Xm!"), SPEND, CACHE, ZENI (cost, optional `zeniBudget`), plus mini bars on the prompt-hint line. All
  toggleable (`showUsageGauges`, `showCacheGauge`, `showZeni`, `hintBars`, ...).
- **scouter**: `/scouter` pane: POWER LEVEL, KI breakdown, STAMINA/TRAINING, ZENI, BATTLE LOG; "IT'S OVER
  9000!!!" toast, stamina alerts at 80/90%.
- **saiyan-status**: status line `⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24`, transformation
  toasts, `/senzu` (compacts ~150 ms after answering, because compact is refused inside a command hook),
  `autoSenzu` and `staminaWarnings` off by default. Its Dragon Balls moved to shenron.
- **shenron** (user asked for a dragon wrapped round the window and 7 balls granting a wish): random finds
  after tool calls (`findRate` rare/normal/frequent, guaranteed after 60/40/15 calls), `/grab`, balls flee
  after 90 s; `/dragonradar`; `/shenron` (`/shenron preview` without wishes) with the dragon round all
  four edges; five wishes (compact, unlock a secret scheme, a Haiku tip, immortality refused, pet him).
- **Color schemes**: `shared/palettes.ts` is canonical (goku, vegeta, namek, frieza, super-saiyan-blue,
  ultra-instinct, majin-buu, kaioken, secret golden-frieza and super-saiyan-rose), copied into each mod's
  `hooks/palettes.ts`; `/dbztheme` sets every mod's `palette` via `$.config.set`. Claude Code's own theme
  can't be extended by plugins, so only the DBZ windows recolor.
- **Fix:** Palettes station flagged goku `warn` as `#ff9a3c`; set back to the original `#ff7a00` everywhere.
- **Fix:** the user pressed `[ Hide ]` and couldn't get the band back. Added `/gauges` (toggles the band),
  relabelled the button "Hide (back: /gauges)", and hidden resets on session start.
- **Fix:** `/grab` did nothing while Claude was working: a mod's slash command waits for the turn to end
  unless registered with `immediate: true`. Now set on `/grab`, `/dragonradar`, `/gauges`, `/scouter`
  (not `/shenron` or `/dbztheme`: wishes compact and theme switches reload mods).
- **Shenron around the prompt** (user asked for a dragon around the terminal border): mods can't draw on
  the terminal's own edges (only the band above the prompt, the hint line, panes, status line). So Shenron
  now lies along the top of the band above the prompt (his body holds the 7 Dragon Ball slots, a found
  ball sits in his mouth, scales shine while Claude works) and his tail `╰≈≈≈∽` runs on the hint line.
  Toggle `promptCoil` (on). Kamehameha now keeps another mod's band beneath it and draws it above the
  gauges, so the two stack whichever runs first. Seen live in a fresh `try-mods.cmd` session.
  Tests: kamehameha 19, shenron 28.
- **Decided against:** custom Claude Code themes (not possible through plugins); Dragon Ball pop-up pane
  below 144 columns (the engine won't seat an unasked pane there, so a toast + `/grab` is used).
- **Next / open:** user tries every feature live and picks which mods to keep; then maybe install via a
  marketplace file + `/plugin install`. Git: local history; GitHub: no (user's choice).
