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
| `--hull`   | `#1B2A32` | Primary ink. A real blue-green, not a tinted black.   |
| `--deck`   | `#E4E7E3` | Page ground — cool concrete apron grey.               |
| `--plan`   | `#F5F6F3` | Cell fill, one step up from the deck.                 |
| `--rule`   | `#A8B2AD` | Hairline grid.                                        |
| `--rule-heavy` | `#5C6B66` | Plan border, 2px.                                |
| `--clear`  | `#2F6B4F` | Low risk — reefer green.                              |
| `--watch`  | `#B5811F` | Moderate — signal ochre.                              |
| `--hazard` | `#A33027` | High risk — IMDG red oxide.                           |

Deliberately not: cream + serif + terracotta (`#D97757` and its neighbours),
and not near-black with one acid accent. The ground is cool, the accents are
three signal colours rather than one decorative one, and they are assigned by
data rather than by taste.

### Type

- **IBM Plex Sans Thai** — all prose and labels. Thai and Latin from one
  superfamily, with a drafting-office character that suits the document.
- **IBM Plex Mono** — every figure, code and matrix cell. Not for decorative
  small labels: mono is here because a bay plan and a terminal printout are
  monospaced, and because columns of rates only compare if the digits align.

Scale, major third from 16: 11 / 13 / 16 / 20 / 25 / 31 / 39 / 49.
Hero figures at 39–49. Thai body gets extra line-height for its ascenders.

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
