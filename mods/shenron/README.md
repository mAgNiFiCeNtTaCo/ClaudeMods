# shenron: Dragon Balls, Shenron and wishes for Claude Code

A Dragon Ball Z mod for Claude Code. While you work, Dragon Balls turn up at random. Grab all seven and
Shenron rises, coiled around a pane of his own, and grants you a wish. It also has `/dragonradar` and
`/dbztheme`, which switches the color scheme of every DBZ mod at once.

## Try it

```
claude --plugin-dir D:/ClaudeProjects/ClaudeMods/mods/shenron
```

**To see Shenron right away**, type `/shenron preview`. The dragon appears with every wish shown but
disabled. To earn him for real quickly, set `findRate` to `frequent` (`/config`, the shenron rows).
You then get a ball at least every 15 tool calls, and you `/grab` each one.

## What it does

### Dragon Balls turn up while you work
After each tool call of the main conversation (subagents don't count), the mod rolls for a find:

| findRate | chance per tool call | sure by |
|---|---|---|
| `rare` | 1.5% | 60 tool calls without a find |
| `normal` (default) | 3% | 40 |
| `frequent` | 8% | 15 |

- A find gives you a toast, `✨ A Dragon Ball appeared! The 4-Star Ball, grab it! (/grab)`, and a small
  pane with the orange ball, its stars and a `[ Grab it ]` button (`g`). The pane never takes the
  keyboard. On a terminal narrower than 144 columns there is no pane: the toast and `/grab` do the job.
- Only one ball is out at a time. It is always a star you don't hold yet.
- `/grab` (or the button) collects it: `Got the 4-Star Dragon Ball! ★★★★☆☆☆ 4/7`.
  `/grab` works at once even while Claude is still working (so do `/dragonradar`, `/gauges` and `/scouter`).
- With `ballEscape` on, a ball you don't grab within 90 seconds flies away:
  `The 4-Star Dragon Ball flew away...`.
- The hint line under the prompt shows your balls, `🐉 ●●●●○○○`. It adds `✨ /grab` while a ball is out
  and `/shenron` once you hold all seven. It keeps the other mods' additions (kamehameha's bars).
- The stars you hold, your lifetime finds, the wishes granted and the secret schemes you unlocked all
  carry over to later sessions. A ball that is out does not.

### Shenron
The 7th ball summons him: `The sky darkens... SHENRON HAS BEEN SUMMONED!`, and a dialog pane opens.
Shenron's body wraps around all four edges of the pane:

- the head with antlers, whiskers and a glowing red eye at the top right
- the scaled body down the right side, along the bottom (a claw at each bottom corner), up the left and
  along the top
- the tail tapering off just before the head

The art is sized to whatever room the pane gets: docked beside the transcript floor to ceiling, or
inline above the prompt. Below 44 columns he becomes a plain scaled coil with one red eye. With
`shenronAnimation` on, his scales shimmer, his eye glows and blinks, and the night sky inside twinkles.

Inside the coil: `I AM THE ETERNAL DRAGON. STATE YOUR WISH.` and five wishes (hotkeys `1`-`5`):

1. **Restore my Ki**: compacts the conversation, like a Senzu Bean.
2. **Grant me a new power**: unlocks a secret color scheme (first `golden-frieza`, then
   `super-saiyan-rose`, after that a random other scheme) and switches every DBZ mod to it.
3. **Share your wisdom**: one short Claude Code or coding tip in Shenron's voice from Claude Haiku
   (`claude-haiku-5-5`, at most 120 tokens). A built-in tip is used if the model doesn't answer. The tip
   also stays in the transcript as a notice row (the model never reads it).
4. **Make me immortal**: `THAT IS BEYOND MY POWER.` Nothing is spent; you can wish again.
5. **Pet Shenron**: he reacts and his eyes change. Nothing is spent.

After a granted wish (1-3), Shenron says `YOUR WISH HAS BEEN GRANTED. FAREWELL!`. The pane closes after
about 3 seconds (9 for a tip, so you can read it) and the balls scatter:
`The Dragon Balls scattered across the Earth...`. Esc (or `[ Leave ]`) closes the pane without a wish,
and you keep the balls.

### Commands

| Command | What it does |
|---|---|
| `/grab` | Collect the Dragon Ball that is out. |
| `/shenron` | With all seven balls, summon Shenron. Otherwise: `Gather all seven Dragon Balls first. ●●●○○○○ 3/7`. |
| `/shenron preview` | Show Shenron without spending anything; the wishes are shown but disabled. |
| `/dragonradar` | Toggle the Dragon Radar pane: a round green grid with your seven ball slots (held ones as bright `★n`, missing ones as dim blips, the one that is out as a red `◉n`), plus held balls, lifetime finds, wishes granted, the find rate and tool calls since the last find. |
| `/dbztheme` | A pane listing every color scheme (sample colors, name, tagline). The current one is marked. Secret ones show as `??? (wish only)` until Shenron grants them. Press one to apply it. |
| `/dbztheme <name>` | Apply a scheme directly (`/dbztheme namek`, `/dbztheme super saiyan blue`). A locked secret answers `Only Shenron can grant that power.` |

Applying a scheme sets the `palette` option of every DBZ mod that is loaded and offers it:
`kamehameha.palette`, `scouter.palette` and `shenron.palette`. Each mod reloads in the new colors, and you
get a toast such as `Transformed! Color scheme: Super Saiyan Blue`.

## Options (`/config`, the shenron rows, or `pluginConfigs` in settings)

| Option | Default | What it does |
|---|---|---|
| `palette` | `goku` | DBZ color scheme for this mod's panes (also set by `/dbztheme`). Shenron's own body always stays dragon green. |
| `findRate` | `normal` | `rare`, `normal` or `frequent` (see the table above). |
| `ballEscape` | on | An ungrabbed ball flies away after 90 seconds. Off: it waits until you grab it. |
| `hintTail` | on | Show `🐉 ●●●●○○○` at the end of the hint line under the prompt. |
| `shenronAnimation` | on | Shimmering scales, a glowing and blinking eye, a twinkling sky (about 3 frames a second, only while Shenron's pane is open). |

## Files

- `hooks/register.tsx`: the hooks (finds, commands, wishes, the four panes).
- `hooks/art.ts`: the drawings as plain data (Shenron's coil, the radar, the ball), so they can be tested.
- `hooks/palettes.ts`: an unchanged copy of `shared/palettes.ts`.
- `hooks/shenron.test.tsx`: the tests (`claude plugin test D:/ClaudeProjects/ClaudeMods/mods/shenron`).
- `types/index.d.ts`: the state the panes draw from.

For tests only, the environment variable `SHENRON_RNG` (numbers between 0 and 1, comma-separated) makes
the rolls predictable. Leave it unset in normal use.
