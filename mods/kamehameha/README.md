# kamehameha

A Dragon Ball Z band above Claude Code's prompt. Every turn charges a Kamehameha, the turn's end fires it,
and a second line shows your context window as a Ki gauge.

## What it shows

**While a turn runs**: the chant advances with the charge (`Ka...` `Me...` `Ha...` `Me...` `HA...!!`,
20% each), the ki ball grows in cupped hands (`.` `o` `O` `◎` `◉`), and a bar in the scheme's ki color fills,
fading toward its beam color as it goes, with live figures:

```
Ka... Me... Ha... Me...         ⊂(◎)⊃ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▓▓▓▒░░░░░░░░ 77%  ⚡ 7 techniques · 0:41 · Bash
KI █████████████░░░░░░░ 63%  (126k / 200k) [ Hide ]
```

A turn has no true percent, so the charge mixes time and activity:
`1 - exp(-(elapsed/45s + 0.08 × tool calls + 0.04 × model requests))`, held at 95% or below until the
turn ends. Techniques are tool calls; the name after them is the last tool called. The bar and the clock
move every 250 ms (every second with `animate` off).

**When the turn ends**: the beam fires across the band for 4 seconds, shooting out over the first
second, then the band settles into a summary of the last attack:

```
⊂(◉)⊃═══════════════════════════════════════════════════════════════>  HAAAAAA!!!
Last Kamehameha: 1:12 · 14 techniques · 23.4k tokens · Ki 63%
```

Tokens are every token the turn's requests sent and received (input, cache writes, cache reads and
output, from `turn.complete`'s usage); `--` when the engine reported none. An interrupted or failed
turn fizzles instead: `⊂(·)⊃ ...fizzled`, and its summary says `fizzled`.

**Ki gauge**: the context window from `$.session.usage().context`, refreshed on every
`session.measure`, colored by fill in the color scheme's tokens (0-50% `ki`, 50-70% `gold`, 70-85% `warn`,
85%+ `danger`; in `goku`: blue, gold, orange, red).
`--` before the first reading.

**Power gauges** (under the Kamehameha line, one aligned row each, only for figures the engine gives):

```
KI          ███████████████░░░░░░░░░ 63%  (126k / 200k)
STAMINA 5h  ██████████░░│░░░░░░░░░░░ 41%  resets 2h12m · on pace ✓
TRAINING 7d █████░░░░░░│░░░░░░░░░░░░ 22%  resets 3d12h · on pace ✓
CACHE       █████████████████████░░░ 87%  of input reused · Instant Transmission
ZENI        $1.24 · $0.31/attack · this session
```

- STAMINA / TRAINING are the 5-hour and 7-day usage limits (subscriptions only; no rows on an API key).
  The `│` (the scheme's gold) marks how much of the window's time has gone by: fill left of it means you are under pace.
  When usage at the rate so far would hit 100% before the reset, the row turns red: `runs out in 40m!`.
- CACHE is the share of input tokens served from the prompt cache over the finished turns.
- ZENI is the session cost; with a `zeniBudget` it becomes a gauge (`$2.50 of $5.00`).
- KI adds `Senzu Bean time (/compact)` at 85%.

**Bars under the prompt**: the hint line under the prompt ends with mini bars,
`⚡ KI ▰▰▰▰▱▱ 63% · 5h ▰▰▱▱▱▱ 41% · 7d ▰▱▱▱▱▱ 22%`, so they show even with the band collapsed.

**Color scheme**: every color comes from the `palette` setting (default `goku`, the original blue/orange
look; see the Color schemes list in the top-level README). The shenron mod's `/dbztheme` sets it on all
DBZ mods at once.

**`[ Hide (back: /gauges) ]`** hides the band. **`/gauges`** brings it back (and hides it again); it also comes back on your next prompt and in every new session. The engine's own `[-]` (or ctrl+x ctrl+a) collapses it too. The band gives way to Claude Code's surveys.

## Settings (`userConfig`, all on by default except `zeniBudget` and `palette`)

| Toggle | What it does |
|---|---|
| `palette` | String, default `goku`: the DBZ color scheme (`goku`, `vegeta`, `namek`, `frieza`, `super-saiyan-blue`, `ultra-instinct`, `majin-buu`, `kaioken`, `golden-frieza`, `super-saiyan-rose`). Also set by `/dbztheme` (shenron mod). An unknown name falls back to `goku`. |
| `animate` | Shimmer on the charging bar (moving glint, cycling head, pulsing ball) and the beam shooting out. Off: static bars, updated once a second. |
| `showKiGauge` | The `KI` gauge line. |
| `showSummary` | The `Last Kamehameha:` line while idle. |
| `fireBeam` | The 4-second beam (or fizzle) when a turn ends. Off: straight to the summary. |
| `showUsageGauges` | The STAMINA (5h) and TRAINING (7d) rows with reset countdown and pace warning. |
| `showCacheGauge` | The CACHE row. |
| `showZeni` | The ZENI (cost) row. |
| `zeniBudget` | Number, default 0: a session budget in USD that turns ZENI into a gauge. |
| `hintBars` | The mini bars at the end of the hint line under the prompt. |

Change them in the `/config` menu (rows under `kamehameha`) or in settings under
`pluginConfigs.kamehameha`.

## Try it

```
claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/kamehameha
```

## Checks

```
claude plugin validate D:/ClaudeProjects/ClaudeMods/mods/kamehameha
claude plugin test D:/ClaudeProjects/ClaudeMods/mods/kamehameha
```

The tests (`hooks/kamehameha.test.tsx`) mount the band on the terminal and desktop surfaces: idle draws
only the Ki gauge (`--` before a reading, nothing at all with the gauge off), a running turn shows the
chant, percent, techniques and tool, `turn.complete` fires the beam and then the summary, an
interrupted turn fizzles, and `Hide` hides the band until the next turn. `hooks/gauges.test.tsx` covers the
power gauges; `hooks/palette.test.tsx` checks that `palette: namek` colors the headings and gauge in Namek's
colors and that an unknown palette falls back to goku.

## Files

- `hooks/register.tsx`: the hooks (turn start/step/complete, tool calls, measurements, the band).
- `hooks/kame.ts`: the pure figures and glyphs (charge, chant, bars, the charge color).
- `hooks/gauges.ts`: the power gauges' figures (pace, labels, gauge cells).
- `hooks/palettes.ts`: the color schemes, an exact copy of `shared/palettes.ts` (change that one, then copy).
- `types/index.d.ts`: the `$.state` values the band draws from.
