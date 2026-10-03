# Shippr — design direction

## Brief

A market intelligence and carrier-decision desk for Thai freight forwarders
and logistics coordinators. Read several times a day, at a desk, usually in a
hurry. Three jobs, in this order:

1. Did the market move against me this week?
2. What is blocked right now?
3. Can I justify this carrier choice to a client?

UI copy in Thai; industry terms (WCI, SCFI, FEU, transit time, CR) stay in
English, because that is what the desk says out loud.

**The client pinned the visual direction with references: minimal.** White
ground, near-black text, 1px hairline panels, generous whitespace, small
uppercase monospace labels for metadata, solid black calls to action. The
brief's own direction wins over any house preference, so this is followed
exactly.

## The organising rule

> The interface is monochrome. Colour appears in exactly two places: risk
> state, and inside charts.

On a page this quiet a single coloured mark carries real weight, which is the
whole reason to keep everything else in ink. It also means the charts read as
charts rather than as decoration.

## Tokens

### Colour

| Token            | Hex       | Role                               |
| ---------------- | --------- | ---------------------------------- |
| `--ink`          | `#111111` | Primary text                       |
| `--ink-soft`     | `#565656` | Secondary text                     |
| `--ink-faint`    | `#8C8C8C` | Labels, metadata                   |
| `--ground`       | `#FFFFFF` | Page and panel                     |
| `--surface`      | `#FAFAFA` | Hover, subtle fill                 |
| `--line`         | `#E5E5E5` | Hairline panel borders             |
| `--ok`           | `#15803D` | Low risk, below market             |
| `--warn`         | `#B45309` | Moderate risk, rate rising         |
| `--bad`          | `#B91C1C` | High risk, stale data, above market|

### Chart series — validated, not chosen by eye

Charts are the one place identity is carried by hue, so the palette was run
through the dataviz validator against this exact surface (`#ffffff`) rather
than eyeballed:

| Slot | Hex       | | Slot | Hex       |
| ---- | --------- |-| ---- | --------- |
| 1    | `#2A78D6` | | 4    | `#EDA100` |
| 2    | `#EB6834` | | 5    | `#E87BA4` |
| 3    | `#1BAF7A` | |      |           |

Five slots **pass** the adjacent-pair gate that grouped bars are judged on
(worst CVD ΔE 9.1, worst normal-vision ΔE 19.6). The same five **fail** the
all-pairs gate that an overlay needs — only three slots clear it. That result
decided the form: see the log entry below.

Sequential blue (`#9EC5F4` → `#184F95`) carries magnitude wherever one measure
is plotted — the ranking bars and the sparklines.

Three slots sit under 3:1 against white, so the contrast relief rule applies:
every chart ships visible value labels and the per-criterion figures beneath
the ranking act as its table view. Nothing is gated behind colour.

### Type

- **Anuphan** — all prose, headings and figures. A neutral Thai grotesque.
- **IBM Plex Mono** — small uppercase metadata labels and aligned figures only.

Scale: 11 / 13 / 15 / 16 / 18 / 22 / 28 / 36 / 48.
Thai body gets extra line-height for its ascenders.

### Motion

One moment only: ranking rows move to their new position when a weight
changes. It answers the user's action and shows what changed. No scroll
reveals, no hover lifts. `prefers-reduced-motion` turns it off.

## Log

- 2026-10-03 — **third pass. Misread the client twice; this one follows the
  references they gave.** When they said the UI resembled a well-known skills
  directory, that was the target, not the complaint — and the second pass had
  pushed in the opposite direction, into saturated industrial blocks. The
  direction is now pinned by their own references and followed exactly:
  white, hairline panels, whitespace, monospace metadata labels, black CTAs.

- 2026-10-03 — **charts, after the client granted colour and asked for best
  practice.** Ran the palette through the validator instead of choosing by
  eye, and the numbers changed the design:

  The carrier radar chart from the original brief was **replaced with grouped
  bars**. Two reasons, in order of weight. First, five overlapping series
  cannot be told apart safely: five slots clear the adjacent-pair gate that
  grouped bars are judged on, but only three clear the all-pairs gate an
  overlay needs, so a radar would have capped the tool at three carriers when
  the brief asks for five. Second, a radar asks the reader to compare polygon
  areas — the least accurate comparison there is — and its shape changes with
  the arbitrary order of the axes. Length against a shared baseline is read
  accurately.

  Series colour is bound to the carrier's position in the quote list, never to
  its rank, so re-sorting the ranking does not repaint the series.

  Recharts was removed with the radar; every chart here is hand-rolled SVG or
  CSS, which keeps the dashboard's critical path free of a chart library and
  means the charts print.


- 2026-10-03 — first pass. Direction and language confirmed with the client
  before building.
- 2026-10-03 — **second pass, after the client said it looked like every other
  technical site.** They were right, and the fault was in the execution rather
  than the direction. The first pass had hairline-outlined boxes on near-white
  with monospace micro-labels, which is cliché #3 plus the monospace-label tell
  the brief warns about — and, more to the point, it is not what a stowage plan
  looks like. A plan is a mosaic of solid painted blocks.

  Changed:
  - Status colours became solid fills instead of 10%-opacity tints. The port
    grid is now the hero and reads as a shape at a glance.
  - Dropped IBM Plex and all monospace. Chakra Petch (angular, stencil-like)
    for headings and figures, Anuphan for prose — both Thai-first.
  - Ground darkened from `#E4E7E3` to `#C9CFC8` so a painted block has
    something to sit on.
  - Plan frame went from 2px to 3px solid ink; buttons became painted blocks
    rather than outlined chips.
  - Removed the `.slot-address` monospace micro-label, the single strongest
    tell. Addresses now sit in the display face inside the painted cell.
  - The page opens on the mosaic rather than on a summary card.
