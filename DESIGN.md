# Design System: Versus web

This is the binding visual spec for `apps/web`. Read `.impeccable.md` first for audience and tone.

## 1. Concept

The landing page is the v0 "IRL event" template (the copy of it lives in
`v0-irl-event-landing-custom-3-d-lanyard/` at the repo root, untracked): a full-viewport dithered
wave background, a fixed translucent header, Geist headlines that blur in, a "powered by" logo
marquee, a three-column feature card, a numbered list, a rounded call-to-action panel and a
centred footer. Every other page reuses the same tokens and primitives so the app reads as one
product: dark neutral surfaces, hairline borders, rounded cards, white primary buttons.

The one product-specific rule: **side A prints green, side B prints red**, everywhere. Odds bars,
tote-board numerals, matchup headlines, tags, "Back Apple" / "Back Nvidia" buttons.

## 2. Tokens

`apps/web/app/globals.css` holds two layers of CSS variables.

- The template's shadcn neutral dark set: `--background`, `--foreground`, `--card`, `--primary`,
  `--muted-foreground`, `--border`, `--input`, `--ring`, `--radius` (0.625rem). Landing components
  use these through Tailwind (`bg-background`, `text-muted-foreground`, `border`, `rounded-xl`).
- App tokens on top: `--fg`, `--fg-2`, `--fg-3`, `--line`, `--line-2`, `--bg-2`, `--bg-3`, and the
  side colours `--a` (#4ade80) and `--b` (#f4515b) with their tints. Exposed to Tailwind as
  `text-side-a`, `text-side-b`, `bg-side-a`, `text-fg-2`, `border-line` and so on. Never name a
  colour token `a` or `b` alone: it collides with `border-b`.

Dark only. No gradients except the Solana mark.

## 3. Typography

Geist for everything, Geist Mono for kickers, labels, tags, numerals and wallet keys. Both load
through `next/font/google` and are exposed as `--font-geist-sans` and `--font-geist-mono`.

- Page titles: `text-4xl font-semibold lg:text-5xl`, with a mono uppercase kicker above.
- Landing hero: `text-5xl md:text-6xl xl:text-7xl font-semibold`, two lines.
- Body: Geist 16px, `text-muted-foreground` for secondary copy.
- Matchups: `.display` (Geist 600, tight tracking), A in green, B in red, "vs" small and muted.
- Tabular numerals everywhere.

## 4. Layout

- Fixed header, 60px, `bg-background/50 backdrop-blur-3xl border-b`. Wordmark left, links centred
  on desktop (Board, Create, Positions, How it works), wallet button right. Hamburger below `lg`.
- App pages live in the `(app)` route group: `max-w-6xl px-6 pt-28`.
- Board: three-column card grid (`md:grid-cols-2 xl:grid-cols-3`), filter pills top right.
- Duel: header, then a 7/5 grid: tale of the tape, odds chart, ledger and rules on the left as
  cards; the tote board, bet panel and position card sticky on the right.
- Landing: the template's sections in order, hero at `min-h-dvh` with the dither behind it.

## 5. Components

Template primitives, copied verbatim into `components/ui` and `components/motion-primitives`:
`Button` (shadcn), `Card`, `InfiniteSlider`, `ProgressiveBlur`, `TextEffect`, `AnimatedGroup`,
`DecryptedText`, `Dither`. Do not restyle them.

App components keep their behaviour from Radix and are skinned by the classes in `globals.css`:
`.card`, `.btn` (same look as the shadcn button; `side="a"|"b"` fills green or red), `.tag`,
`.pill`, `.corners`, `.tabs-list`, `.oddsbar`, `.flaps` (split-flap tote board digits), `.ledger`,
`.tape`, `.dl`, `.sheet` (wallet dialog), `.select-*`, `.tip`, `.faq`.

## 6. Motion

The landing page animates the way the template does: dithered waves in a WebGL canvas
(`waveSpeed` 0.05, mouse interaction off), words blur in on view, the logo row scrolls. App pages
get one page-load reveal (`.reveal`, 480ms stagger) and the split-flap digits when odds change.
`prefers-reduced-motion` turns the reveal, pulse and flaps into fades.

## 7. Copy

Plain, active, short. "Back Apple", "Open the board", "Create a duel". Errors say what happened
and what to do: "Not enough USDC. You have 12.40." Empty states point to the next action.
