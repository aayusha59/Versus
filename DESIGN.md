# Design System: Letterpress Tote Board

This is the binding visual spec for `apps/web`. Read `.impeccable.md` first for audience and tone.
Every DON'T below is a hard rule; a reviewer will reject work that breaks one.

## 1. Concept

A racetrack tote board and a boxing fight card, printed by letterpress on cream stock with two
inks: near-black and vermilion. Every duel has a left fighter and a right fighter. The left side
always prints in ink, the right side always prints in vermilion. That is the whole color logic
of the product, and it must be consistent on every screen: odds bars, buttons, tables, stamps.

The memorable thing: the odds are a physical tote board. Big split-flap numerals that flip when
the odds move. Everything else is quiet broadsheet typography and rules so the board is the hero.

## 2. Color (CSS variables, oklch, light theme only)

```css
:root {
  --paper:        oklch(96.5% 0.012 85);   /* cream stock */
  --paper-2:      oklch(93.5% 0.014 85);   /* slightly darker paper for alternating rows / rails */
  --ink:          oklch(22% 0.015 70);     /* near-black warm ink, never #000 */
  --ink-2:        oklch(42% 0.014 70);     /* secondary text */
  --ink-3:        oklch(62% 0.012 75);     /* tertiary / disabled */
  --rule:         oklch(78% 0.014 80);     /* hairlines */
  --rule-strong:  var(--ink);              /* double rules, section breaks */
  --vermilion:    oklch(57% 0.21 32);      /* the second ink; right side; primary action */
  --vermilion-2:  oklch(47% 0.2 32);       /* hover / pressed */
  --vermilion-tint: oklch(92% 0.05 32);    /* right-side row tint, stamp backgrounds */
  --ink-tint:     oklch(90% 0.012 80);     /* left-side row tint */
  --gain:         oklch(48% 0.13 150);     /* positive delta, a green ink */
  --loss:         var(--vermilion);        /* negative delta reuses vermilion */
  --focus:        oklch(60% 0.18 250);     /* focus ring only; never decorative */
}
```

Side mapping: `--side-a: var(--ink)`, `--side-b: var(--vermilion)`. Text on vermilion fills uses
`--paper`, never gray. Text on ink fills uses `--paper`. Never place gray text on a colored fill.

Forbidden: gradients of any kind, `box-shadow` for decoration, `backdrop-filter`, glow, neon,
cyan/purple, pure black or white, dark mode.

## 3. Typography

Google Fonts, loaded with `next/font/google`, `display: swap`.

- **Display: Archivo** (variable, axes `wdth` 62–125 and `wght` 100–900). Matchup headlines use
  `font-variation-settings: "wdth" 75; font-weight: 800; text-transform: uppercase;
  letter-spacing: -0.01em; line-height: 0.9`. This is the fight-poster voice.
- **Body and UI: Archivo** at normal width, weights 400/500/600. `font-variant-numeric: tabular-nums`
  on every numeric element, without exception.
- **Editorial accent: Instrument Serif** italic, used sparingly for taglines, the market question
  when shown in full sentence form, and short explanatory asides. Never for UI controls or numbers.
- Forbidden: Inter, Roboto, Arial, Helvetica, system-ui, monospace used for "technical" flavor.

Fluid scale (rem):

```css
--t-xs:  clamp(0.72rem, 0.68rem + 0.2vw, 0.8rem);
--t-sm:  clamp(0.82rem, 0.78rem + 0.25vw, 0.92rem);
--t-md:  clamp(0.95rem, 0.9rem + 0.3vw, 1.05rem);
--t-lg:  clamp(1.15rem, 1.05rem + 0.5vw, 1.4rem);
--t-xl:  clamp(1.6rem, 1.3rem + 1.4vw, 2.4rem);
--t-2xl: clamp(2.4rem, 1.6rem + 3.6vw, 4.8rem);   /* matchup headlines */
--t-board: clamp(3.2rem, 2rem + 6vw, 8rem);        /* tote board numerals */
```

Labels above data use `--t-xs`, uppercase, `letter-spacing: 0.08em`, color `--ink-2`.

## 4. Layout and rhythm

- Max content width 1280px, 12-column grid, `gap: clamp(16px, 2vw, 32px)`. Page gutter
  `clamp(16px, 4vw, 56px)`.
- **Left rail**: on desktop a 3-column rail holds navigation, the operator clock (UTC), and
  network status. It is separated from content by a single vertical hairline, not a background.
- **Broadsheet rules replace cards.** Sections are separated by a double rule (two 1px lines
  4px apart in `--ink`). Sub-sections by a single hairline in `--rule`. Nothing is wrapped in a
  bordered rounded box. `border-radius` is 0 everywhere except 2px on inputs and buttons.
- **Asymmetry**: the duel page hero is 7/12 headline and copy on the left, 5/12 tote board on the
  right, and the board deliberately hangs 24px below the headline baseline. The board page lists
  duels as full-width rows, not tiles.
- Spacing rhythm: tight inside groups (4–8px), medium between related blocks (16–24px), generous
  between sections (48–96px, fluid). Do not use the same padding everywhere.
- Left-align text. Center only the tote board numerals and stamps.
- Mobile: rail collapses to a top strip; tote board stacks above the bet panel; tables become
  two-column definition lists, never horizontally scrolled; nothing critical is hidden.

## 5. Components (behavior from Radix primitives, skin is ours)

Install `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-select`,
`@radix-ui/react-slider`, `@radix-ui/react-tooltip`, `@radix-ui/react-toggle-group`. Do not
install shadcn/ui or any pre-styled kit.

- **ToteBoard**: two big numerals (left in ink, right in vermilion) with the side names printed
  small above in condensed caps, a thin center rule, and a sub-line "Apple leads 54–46". Each
  digit is a split-flap cell: on change, the old digit flips up and the new one flips in
  (`transform: rotateX`, 240ms, ease-out-quint, staggered 30ms per digit). Respect
  `prefers-reduced-motion` by crossfading instead.
- **OddsBar**: a 6px bar, ink from the left and vermilion from the right meeting at the odds,
  with a 1px paper gap at the meeting point. Used in list rows.
- **BetPanel**: a segmented control (ToggleGroup) with two options styled as fighter corners:
  "Apple" fills ink, "Nvidia" fills vermilion when selected. Amount input in `--t-xl` tabular
  numerals with the currency printed small at the right. Below it a three-line receipt in
  hairline rows: "You receive", "Fee (paid to holders)", "Odds after". The submit button is a
  full-width rectangle in the selected side's ink with paper text: "Bet Apple" / "Bet Nvidia".
- **TaleOfTheTape**: a two-column comparison table with the metric name centered in a narrow
  middle column and the two fighters' values flanking it, right-aligned on the left and
  left-aligned on the right. Rows: Price, Market cap, Shares outstanding, 30-day change, Pair
  token, Oracle feed, Holders, Fees paid out.
- **Stamp**: uppercase label, 2px border in vermilion or ink, `--t-xs`, letter-spacing 0.12em,
  rotated -3deg, `mix-blend-mode: multiply`, slight opacity 0.92. Used for LIVE, RESOLVED, PAID
  IN AAPLX, DEVNET. Never more than one stamp per row.
- **Ledger**: a dense table of payouts. Columns: time (UTC), side, amount in pair token, holders
  paid, tx link. Alternating rows use `--paper-2`. Numbers right-aligned tabular.
- **Button**: rectangle, 2px border, 2px radius, `--t-sm` uppercase 600 with 0.06em tracking.
  Variants: `primary` (fill in side ink), `outline` (ink border, fills on hover), `ghost`
  (text only, underline on hover). Disabled: `--ink-3` border and text, no fill.
- **Field**: label above in caps, input with a bottom-only 1.5px ink border (no box), focus
  switches border to `--focus`. Errors print in vermilion below in `--t-xs`, sentence case.
- **WalletButton**: our own; opens a Radix Dialog listing detected wallets as rows with the
  wallet name and a hairline between rows. No wallet-adapter default UI or CSS.
- **Chart**: hand-rolled SVG line of odds over time, 1.5px ink stroke, vermilion stroke for the
  right side if both are shown, no area fill, no gridlines except a single 50% hairline, axis
  labels in `--t-xs`. Do not use a charting library.
- **EmptyState**: a short sentence in Instrument Serif italic plus one outline button. It should
  teach ("No duels yet. Create the first one from a template.").

Forbidden components: cards, card grids, icon-above-heading blocks, hero metric tiles,
gradient text, sparklines as decoration, modals for anything except the wallet picker and
transaction confirmation, toasts stacked in a corner (use an inline status line under the
action instead).

## 6. Motion

- Page load: sections reveal with opacity 0→1 and translateY 8px→0, 360ms, `cubic-bezier(0.22, 1, 0.36, 1)`,
  40ms stagger, once. Tote board digits flip in last.
- Odds change: split-flap as above. Bar meeting point animates with `transform: scaleX` on the
  two halves, 300ms.
- Hover: buttons fill in 120ms; rows get `--paper-2` background in 80ms.
- Never animate width/height/padding/margin. No bounce, no elastic, no spring overshoot.

## 7. Copy

Sports-page voice. Short. Numbers first. Examples:
- "Apple leads 54–46."
- "Paid 3.1 AAPLx to 412 holders at 14:20 UTC."
- "Resolves Dec 31, 21:00 UTC from Pyth AAPL/USD and NVDA/USD."
- Errors: "Not enough USDC. You have 12.40." Never "Oops" or "Something went wrong."
- Empty states teach the next action in one sentence.

## 8. Accessibility

Focus ring 2px `--focus` offset 2px on every interactive element. Contrast ≥ 4.5:1 for text
(ink on paper is ~12:1; vermilion on paper is ~4.6:1, so use it at `--t-md` or larger for text).
All numerals have `aria-label`s with units. Split-flap animation respects reduced motion.
