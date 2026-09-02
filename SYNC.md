# Consumers of hs-block

Two repos consume these lists. Neither keeps its own copy.

## hubsell-website (Astro on Cloudflare Pages)

- `functions/api/subscribe.ts` imports `classifyEmail` from `hs-block`, the authoritative check. It rejects `disposable` on every form, including the otherwise ungated contact form
- The four form components import `classifyEmailLight` from `hs-block/light`, UX only
- Does not use `hs-block/live`. The site is static and its client-side check is advisory anyway; the server function re-checks on every submit
- Picks up list changes on its next deploy

## The app (Node/TypeScript)

- Uses `hs-block/live` on the server so a block takes effect without a deploy
- Its signup UI may use `hs-block/light` for instant feedback
- The account-creation endpoint must call the live validator, never trust the client

## The lockfile trap

On 2 Sep 2026 the website's `package.json` asked for v1.1.0 while `package-lock.json` still pinned v1.0.0. Cloudflare builds with `npm ci`, which installs from the lockfile, so the live site ran code with no disposable rule and accepted every throwaway address. Nothing failed and nothing logged.

Two things to know:

- Plain `npm install` does **not** re-resolve a git dependency when a lock entry already exists. It prints "up to date" and changes nothing. Use `npm install "github:krnshrm/hs-block#vX.Y.Z"` explicitly, then check the lockfile shows the new commit hash.
- Both consumers run `hs-block/selftest`, which turns this into a loud failure. The website fails its build; the app should fail CI.

## Rules

1. Never copy a domain list into either consumer. Import it.
2. Blocking a domain happens here, in this repo, and nowhere else.
3. A new verdict is a breaking change for consumers that branch on verdict strings. Adding `disposable` in v1.1.0 required a matching website change, shipped together.
4. Both consumers pin a git tag. The tag only controls the offline fallback, not what is actually enforced in the app.
5. If a third consumer appears, add it to this file.
