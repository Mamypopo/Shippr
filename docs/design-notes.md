# Shippr — design direction

## Brief

A market intelligence and carrier-decision desk for Thai freight forwarders and
logistics coordinators. Read several times a day, at a desk, usually in a hurry.
It has three jobs, in this order:

1. Did the market move against me this week?
2. What is blocked right now?
3. Can I justify this carrier choice to a client?

Chosen direction: **stowage plan**. UI copy in Thai; industry terms
(WCI, SCFI, FEU, transit time, CR) stay in English, because that is what the
desk actually says out loud.

## The device

A container bay plan: a grid of addressed slots, each filled according to what
is in it. It is an engineering document, not a presentation — hairline rules, no
rounded corners, tiny edge addressing, and colour used strictly as a code.

That gives the page its organising rule:

> The page is one continuous ruled grid, and colour means risk. Nothing else
> is coloured.

Status colour is the only chroma on the page. Links, buttons and headings are
ink. This is both true to the source document and the discipline that keeps a
dense screen readable: if a cell is coloured, something needs attention.

## Tokens

### Colour

| Token      | Hex       | Role                                                  |
| ---------- | --------- | ----------------------------------------------------- |
| `--hull`   | `#17232B` | Primary ink. A real blue-green, not a tinted black.   |
| `--deck`   | `#C9CFC8` | Page ground — concrete apron, dark enough that a painted block reads as a block. |
| `--plan`   | `#FAFAF7` | The drawn sheet.                                      |
| `--clear`  | `#1F6B4A` | Low risk — solid fill, light ink on top.              |
| `--watch`  | `#C2761A` | Moderate — container-paint ochre.                     |
| `--hazard` | `#9B2F24` | High risk — IMDG red oxide.                           |

Status colours are used as **solid fills**, not tints. A bay plan is read as a
shape before a single figure is read, and whisper-tinted cells cannot do that.

Deliberately not: cream + serif + terracotta (`#D97757` and neighbours), and
not near-black with one acid accent — there are three signal colours here and
they are assigned by data, not by taste.

### Type

- **Chakra Petch** — every heading and figure. Angular and squared off, the
  vernacular of stencilled markings on container doors and port machinery.
- **Anuphan** — prose. A calm geometric Thai sans.

Both are Thai-first families. Neither is the Plex-plus-monospace pairing that
makes technical pages interchangeable.

Figures use `tabular-nums` on Chakra Petch rather than a monospace face, so a
column of rates still reads straight down without importing the
terminal-printout look.

Scale, major third from 16: 12 / 14 / 16 / 20 / 25 / 39 / 49 / 61.
Thai body gets extra line-height for its ascenders.

No all-caps labels. No eyebrow text above headings.

### Layout

One grid, full width, sections as regions inside it rather than floating cards.

```
┌───────────────────────────────────────────────────────────────┐
│ Shippr                                    สถานะข้อมูล  บัญชี  │ 2px rule under
├───────────────────────────────────────────────────────────────┤
│ ตลาดสัปดาห์นี้                                                 │
│  ── WCI composite ขึ้น 4.2% มาที่ $2,448/FEU                   │ ruled rows,
│  ── Shanghai รอเทียบท่า 4.6 วัน — แออัดหนัก                    │ not bullets
├──────────────┬──────────────┬──────────────┬──────────────────┤
│ WCI          │ SCFI         │ BDI          │ BDRY             │ one band,
│ 2,448        │ 1,392        │ 1,845        │ 9.84             │ hairline
│ ▲ 4.2%  ▁▂▅▇ │ ▼ 1.1%  ▇▅▃▂ │ ▲ 0.6%  ▃▄▅▆ │ ▲ 2.0%  ▂▃▅▆     │ dividers
├──────┬───────┴───┬──────────┴──┬───────────┴──┬───────┬───────┤
│THLCH │ CNSHA     │ CNNGB       │ SGSIN        │ NLRTM │ USLAX │ bay-plan
│ 1.8  │ 4.6       │ 2.9         │ 1.1          │ 3.4   │ 5.2   │ cells,
│      │███████████│▓▓▓▓▓▓▓▓▓▓▓▓▓│              │▓▓▓▓▓▓▓│███████│ filled
└──────┴───────────┴─────────────┴──────────────┴───────┴───────┘
```

Left-aligned throughout; figures right-aligned within their column so they can
be read down. Edge addressing (UN/LOCODE, week-ending date) sits in the cell
corner the way a slot address does.

The AHP matrix is the memorable element and gets the boldness budget: a real
upper-triangle matrix, editable in place, with the reciprocal half rendered
greyed so the user sees the whole thing.

### Motion

One moment only: when the ranking reorders under a slider change, rows move to
their new positions. It answers the user's action and shows what changed.
No scroll reveals, no hover lifts. `prefers-reduced-motion` turns it off.

## Self-critique before building

- Hairline rules and zero radius overlap with the broadsheet cliché. The
  separation is that this grid is **addressed and filled** — edge codes, square
  cells, colour-coded status — where a broadsheet is justified prose in columns.
  Keeping the outer rule at 2px against 1px inner rules reinforces that it is a
  plan, not a page of newsprint.
- Mono type risks reading as the usual "monospace for small data labels" tell.
  Mitigation: mono only where alignment or code-ness is functional — figures,
  locodes, matrix cells — never as decoration on a heading.
- Numbered markers appear only on the AHP wizard, which genuinely is a
  sequence.

## Log

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
