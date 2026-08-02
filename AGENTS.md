# Cognix product conventions

## Product

Cognix is a prompt-to-full-stack-app builder. The host product is a Next.js App Router application. Generated customer apps run inside Daytona sandboxes and are manipulated only through server-side agent tools.

## Required checks

- Run `npm run lint`, `npm test`, and `npm run build` after material changes.
- Keep secrets on the server. Never expose service keys through `NEXT_PUBLIC_*` variables or send them to a generated sandbox.
- Keep database access behind `src/lib/store.ts`, sandbox access behind `src/lib/daytona.ts`, and object storage behind `src/lib/storage.ts`.

## Interface rules

- Use Geist, semantic HTML, concise action-oriented labels, and visible `:focus-visible` rings.
- Every icon-only button needs an accessible name and at least a 32 px desktop hit target; use 44 px on coarse/mobile pointers.
- All primary flows must work by keyboard. Prefer native controls before ARIA.
- Design empty, loading, dense, and error states. Error copy must include a recovery action.
- Use tabular numbers for timestamps, usage, and counts. Use the ellipsis character (`…`).
- Avoid broad pill-shaped containers. Reserve pills for tags, compact filters, and status.
- Animations should use transform/opacity and respect `prefers-reduced-motion`.
- Do not use gradients for text. Use gradients only for restrained background atmosphere or project artwork.

