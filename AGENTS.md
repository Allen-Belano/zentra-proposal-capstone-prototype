# Zentra — agent notes

## Read the design system first

Before designing or changing any UI in this project, read **`docs/DESIGN.md`**.
It is the source of truth for the palette, type scale, spacing rhythm, component
styles, motion, accessibility targets, and anti-patterns. Do not introduce a
visual direction that contradicts it, and check the change against its rules
before calling the task done.

The rules that bite most often here:

- **Spacing rhythm is 8px** — 8, 12, 16, 24, 32, 48, 64, 96. Avoid one-off values.
- **44px minimum touch target** on any tappable control.
- **No horizontal scrolling.** Nothing should be wider than its container.
- **Restrained motion** — fades and short slides, no bouncy springs or
  overshoot, and respect `prefers-reduced-motion`.
- **Quiet chrome.** Blue is a signal, not a wash.

## Terminology

`docs/UX_AUDIT.md` §1 is the agreed vocabulary, and `src/lib/terms.ts` is the
single place every user-facing name for a stage, a document, and a technical
term is defined. Add new terms there rather than inline in a component, so the
app cannot drift.

The order lifecycle has **six stages** — Accounting → Purchasing → Receiving
→ Invoicing → Delivery → Collection. "Waiting for supplier" and "On hold" are
sub-states, not stages. Use the word **stage**, never "step".

## Commands

```bash
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run build:single
```

`npm run build` runs the typecheck, so it is the fastest way to know whether a
change compiles. There is no test suite; verify UI changes by driving the app.
