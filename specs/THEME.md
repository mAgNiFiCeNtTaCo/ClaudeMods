# Dragon Ball Z theme: shared by every ClaudeMods mod

All three mods (`kamehameha`, `scouter`, `saiyan-status`) must look like one family. Use these names,
colors and glyphs so they read as one HUD. Colors are hex strings for `Text`'s `color` prop (check the
`Color` type in the API d.ts; if hex is not accepted, use the closest theme key / named color).

## Palette
| Token | Hex | Used for |
|---|---|---|
| ki-blue | `#4fc3ff` | Kamehameha charge, ki gauges at low/normal fill |
| beam-white | `#e8f8ff` | Beam core, "HA!" text |
| gi-orange | `#ff7a00` | Headings, labels ("SCOUTER", "KI") |
| gi-blue | `#1e5bd8` | Secondary labels, borders |
| ssj-gold | `#ffd400` | Super Saiyan tiers, 50-85% fill, highlights |
| kaioken-red | `#ff3b30` | Danger: >85% fill, rate limit >90%, "OVER 9000" |
| scouter-green | `#39ff14` | Scouter pane readout text |
| dim | dimColor | Secondary figures |

Gauge colors by fill: 0-50% ki-blue, 50-70% ssj-gold, 70-85% gi-orange, 85%+ kaioken-red.

## Glyphs (terminal-safe; avoid emoji that render double-width inconsistently unless noted)
- Gauge fill `█`, partial `▓▒░`, empty `·` or `░`
- Ki ball: `(◉)` / growing `.` `o` `O` `◎` `◉`
- Beam: `◉═══════════>` then `≡≡≡` / `━━━` body
- Dragon Ball: `●` with star count, e.g. `★4` ; 7 collected = Shenron `🐉` (one emoji is fine)
- Section mark: `⚡`

## Vocabulary
- Context window = **Ki**. Context % = "Ki 63%".
- Session tokens = **Power level**. Crossing 9000 = "IT'S OVER 9000!!"
- Rate-limit windows = **Stamina** (5h) and **Training** (7d).
- Cost = **Zeni** (show real USD too: "Zeni $1.24").
- Tool calls = **Techniques**. A turn = an **Attack**.
- /compact = **Senzu Bean**.
- Transformation tiers by context fill: Base (<25), Kaioken (25-50), Super Saiyan (50-70),
  Super Saiyan 2 (70-85), Super Saiyan 3 (85-95), Limit Breaker (95+).

## Shared rules for every mod
- Each mod is its own plugin folder under `D:\ClaudeProjects\ClaudeMods\mods\<mod-name>\`. Touch only
  your own folder (and your own spec's notes). Never edit another mod.
- Every feature is toggleable through the manifest's `userConfig` (booleans, default on), so the user
  can test and switch parts off.
- Read real figures from `$.session.usage()` / the `session.measure` event; never invent numbers.
  When a figure is missing (no rate limits off a subscription, no context reading yet) show `--`,
  never 0.
- Keep it light: no polling faster than 4 times a second, nothing heavy in render hooks.
