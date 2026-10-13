# saiyan-status

A Dragon Ball Z status line for Claude Code: your context window is your **Ki**, and the fuller it gets
the further Goku transforms. It also adds Senzu Beans (compaction). Part of the ClaudeMods DBZ HUD, along
with `kamehameha`, `scouter` and `shenron`. Dragon Balls (finds, Shenron, wishes) live in the `shenron` mod
now; the old `/dragonballs` command, `dragonBalls` toggle and `★n` on the status line are gone from here.

## What it shows

**Status line** (under the prompt, refreshed on every usage measurement, at the end of each turn and
once a minute):

```
⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24
```

| Part | Meaning |
|---|---|
| `SSJ2` | Transformation tier from Ki: Base (<25), Kaioken (25-50), SSJ (50-70), SSJ2 (70-85), SSJ3 (85-95), Limit Breaker (95+) |
| `Ki 73%` | Context window fill |
| `Stamina 41% (2h13m)` | 5-hour rate-limit window used and time until it resets. Left out when the account has no rate limits |
| `Zeni $1.24` | Session cost in USD |

A figure that hasn't been read yet shows as `--` (never 0). After a compaction, Ki shows `--` until
the next response measures it again.

**Transformation toasts**: when Ki moves up into a new tier you get one toast, e.g.
`Goku went Super Saiyan 2! (Ki 71%)`, or `LIMIT BREAKER! Ki 96%: eat a Senzu Bean (/senzu)`. Going down
(after a compaction): `Powered down to Base. Ki 12%`. The first reading of a session sets the tier
without a toast.

**Senzu Bean**: `/senzu` compacts the conversation. The command answers `Eating a Senzu Bean... (Ki 87%)`
straight away. When the compaction finishes, a toast and a transcript notice say
`Ate a Senzu Bean! Ki 87% → 14% (freed 146k)`. When Ki first reaches 85% (again after each drop below
85%) you get `Ki at 85%: a Senzu Bean is ready (/senzu)`. It never compacts by itself unless
`autoSenzu` is on.

**Stamina warnings** (off by default): one toast each time the 5-hour window crosses 80% and 90%, e.g.
`Stamina 90%! Rest until 3:40 PM`, once per threshold per window. The `scouter` mod owns this toast by
default, so keep it off here unless scouter is off. That way you never get both.

## Toggles (`userConfig`)

Every row shows in `/config` under saiyan-status. Changing one reloads the mod.

| Toggle | Default | What it switches |
|---|---|---|
| `statusLine` | on | The status line |
| `transformToasts` | on | Tier up/down toasts |
| `senzu` | on | `/senzu` and the 85% "Senzu Bean is ready" toast |
| `autoSenzu` | **off** | Compact automatically at Ki 92%, just after the turn that got there ends (once, until Ki drops below 92% again) |
| `staminaWarnings` | **off** | 80% / 90% 5-hour window toasts (scouter does these by default) |

## Try it

```
claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/saiyan-status
```

Then work as usual: the line shows up under the prompt after the first response. Type `/senzu` to compact.

## Checks

```
claude plugin validate D:/ClaudeProjects/ClaudeMods/mods/saiyan-status
claude plugin test D:/ClaudeProjects/ClaudeMods/mods/saiyan-status
```

`hooks/saiyan.test.ts` covers: the tier at every boundary, the status text with and without rate
limits, a transformation toast firing once on crossing (and on powering down), `/senzu` calling the
compaction and its result line, the 85% offer, auto Senzu, the stamina warnings, and that Dragon Balls
are gone (no `★`, no `/dragonballs`, the old store keys left as they were).

## Files

- `.claude-plugin/plugin.json`: manifest and toggles
- `hooks/register.tsx`: the hooks (status, toasts, `/senzu`)
- `hooks/logic.ts`: pure helpers (tiers, texts)
- `hooks/saiyan.test.ts`: tests
- `types/index.d.ts`: the mod's `$.state` values

## Engine notes

- The plugin store may still hold `balls` and `wishes` from the old Dragon Ball game. This mod no longer
  reads or writes them and does not delete them.

- Claude Code refuses `$.session.compact()` from inside a `command.run` hook ("it would compact under
  the turn this hook is holding"). So `/senzu` answers first and compacts 150 ms later on a
  `$.clock.after` timer. That's why the result comes as a toast and a notice, not as the command's
  own output line.
- Auto Senzu uses the same timer just after `turn.complete`. If the engine still refuses, it tries
  again after the next turn.
