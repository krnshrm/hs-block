# Consumers of hs-block

Two repos consume these lists. Neither keeps its own copy.

## hubsell-website (Astro on Cloudflare Pages)

- `functions/api/subscribe.ts` imports `validateEmail` from `hs-block`, the authoritative check
- The four form components import `classifyEmailLight` from `hs-block/light`, UX only
- Does not use `hs-block/live`. The site is static and its client-side check is advisory anyway; the server function re-checks on every submit
- Picks up list changes on its next deploy

## The app (Node/TypeScript)

- Uses `hs-block/live` on the server so a block takes effect without a deploy
- Its signup UI may use `hs-block/light` for instant feedback
- The account-creation endpoint must call the live validator, never trust the client

## Rules

1. Never copy a domain list into either consumer. Import it.
2. Blocking a domain happens here, in this repo, and nowhere else.
3. Both consumers pin a git tag. The tag only controls the offline fallback, not what is actually enforced in the app.
4. If a third consumer appears, add it to this file.
