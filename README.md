# hs-block

Single source of truth for hubsell email domain rules. One list, two consumers: the marketing website and the app.

An email is rejected if any of these is true:

1. It fails the shape check `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`
2. Its domain is on the **competitor** list, exact match or any sub-domain
3. Its domain is on the **blocked** list (ad-hoc manual blocks), exact match or any sub-domain
4. Its domain is on the **disposable** list, exact match or any sub-domain
5. Its domain is on the **free provider** list, exact match only

Verdicts are `ok`, `blocked`, `disposable`, `free`, plus `invalid` from `validateEmail()`. The first list to match decides the message, so disposable is checked before free.

The sub-domain asymmetry is deliberate. `sales.apollo.io` is a competitor and `x.mailinator.com` is disposable, but `foo.gmail.com` is not a free provider.

---

## Blocking a domain

```bash
npm run block -- baddomain.com
npm run block:competitor -- newcompetitor.com
```

Then ship it:

```bash
git add data generated
git commit -m "Block: baddomain.com"
git push
```

That is the whole workflow. The app picks the change up within its refresh window, five minutes by default, with no deploy. The website picks it up on its next deploy.

Removing a domain:

```bash
npm run block -- --remove baddomain.com
npm run block:competitor -- --remove oldcompetitor.com
```

Editing `data/blocked.json` or `data/competitors.json` by hand works too, as long as you run `npm run build` before committing.

---

## Layout

| Path | Role |
|---|---|
| `data/free.json`, `common-free.json`, `competitors.json`, `blocked.json` | The source of truth. Humans and the CLI edit these. |
| `data/disposable.json` | Machine-maintained. Synced weekly from upstream, never edit by hand. |
| `generated/data-full.js` | Full lists as a module. Imported by `hs-block`. |
| `generated/data-light.js` | Small lists as a module. Imported by `hs-block/light`. |
| `generated/email-domains.json` | Published file the app fetches at runtime. |
| `src/core.js` | The rules. No data, so entry points do not pull each other's lists. |
| `bin/block.mjs` | The CLI. |
| `bin/build.mjs` | Regenerates `generated/` from `data/`. |
| `bin/sync-disposable.mjs` | Pulls the upstream disposable list. |
| `src/selftest.js` | Shared fixtures, run by both consumers. |

`generated/` is committed on purpose. It means consumers need no build step, and the app can fetch the published JSON straight from `main`.

---

## The disposable list

Synced from [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains), about 8,700 domains, CC0 licensed so there is no attribution obligation. `.github/workflows/sync-disposable.yml` runs every Monday at 06:00 UTC and commits any change. You can also run it from the Actions tab, or locally:

```bash
npm run sync:disposable
npm run sync:disposable -- --dry-run   # see what would change
```

Because this runs unattended and feeds a live blocking path, the sync refuses to write when something looks wrong:

- Fewer than 5,000 domains fetched, which means a broken or truncated upstream file
- The list would shrink by more than 10% in one go
- A hardcoded never-block set (our own domain and the major mailbox providers) is stripped out regardless of what upstream says

A refused sync fails the workflow loudly and leaves the previous list in place. Stale beats wrong.

The list is server-side only. At 8,700 domains it would dominate a page bundle, so `hs-block/light` does not carry it and the browser never flags a disposable address as you type. The server catches it on submit.

---

## Three entry points

**`hs-block`** for servers. Full free list, thousands of domains. Never import this into browser code.

```js
import { validateEmail, classifyEmail } from 'hs-block';

const v = validateEmail(input);
// { ok: false, verdict: 'free', message: 'Please use your corporate work email.', domain: 'gmail.com' }

classifyEmail('karan@apollo.io');      // 'blocked'
classifyEmail('karan@mailinator.com'); // 'disposable'
```

**`hs-block/light`** for browsers. Competitor and manual blocks in full, plus 33 common free providers. Instant feedback only, and bypassable with devtools, so the server must always re-check.

```js
import { classifyEmailLight, EMAIL_DOMAIN_MESSAGES } from 'hs-block/light';
```

**`hs-block/live`** for servers that must block without deploying. Starts from the bundled lists, then refreshes from the published JSON.

```js
import { createLiveValidator } from 'hs-block/live';

export const emails = createLiveValidator({
  intervalMs: 5 * 60 * 1000,
  onError: (err) => logger.warn({ err }, 'hs-block refresh failed'),
});

emails.start();               // background refresh, timer is unref'd
await emails.refresh();       // optional: warm on boot

const v = emails.validate(input);
if (!v.ok) return reject(v.message);
```

`emails.status()` reports whether it is serving `bundled` or `live` lists, the version, the last refresh, the last error and the current list sizes. Worth exposing on a health endpoint.

Refreshes use `If-None-Match`, so an unchanged list costs a 304 rather than a few hundred KB.

### Why the bundled copy still matters

The pinned package is the floor. If GitHub is unreachable, the fetch times out or the payload looks wrong, the validator keeps serving the last good lists and never fails open. Three sanity floors reject a bad payload: at least 1,000 free domains, at least 10 competitors, and at least 5,000 disposable domains if that key is present at all. A truncated file cannot silently unblock everything.

---

## Self-test

`hs-block/selftest` holds the fixtures both consumers run, so there is one definition of "the rules still work". It checks behaviour, not version numbers, because the version is not what breaks.

```js
import { validateEmail, DISPOSABLE_DOMAINS } from 'hs-block';
import { assertRules } from 'hs-block/selftest';

assertRules(validateEmail, { disposable: DISPOSABLE_DOMAINS.length }); // throws on failure
```

Use `runSelfTest()` instead if you want `{ failures, warnings, passed }` rather than an exception.

Fixtures marked `required: false` are regressions from real incidents. They are reported as warnings rather than failures, so upstream dropping a domain never blocks anybody's deploy.

The website runs this as a `prebuild` step: a failed check fails the build, so Cloudflare keeps serving the previous deploy instead of shipping a broken gate. The app should run it in CI and on its health endpoint.

---

## Installing it

Both consumers install from a git tag, so no registry is needed:

```bash
npm install github:krnshrm/hs-block#v1.0.0
```

Bump the tag to pick up list changes in the bundled copy. The app does not need to do this for blocks to work; it only changes the fallback floor.

---

## Releasing

```bash
npm run build
npm test
npm version patch          # or minor
git push && git push --tags
```

The published JSON is served from:

```
https://raw.githubusercontent.com/krnshrm/hs-block/main/generated/email-domains.json
```

It is fetched from `main`, not from a tag, which is what makes blocking instant.

---

## CI

`.github/workflows/ci.yml` runs `npm run check` and `npm test` on every push. The check fails if `generated/` is stale relative to `data/`, which is the one mistake that would leave the app fetching an out-of-date list.

---

## Where the free list comes from

Generated from [`willwhite/freemail`](https://github.com/willwhite/freemail) (`data/free.txt`) and committed here rather than fetched at runtime. Junk entries from upstream that are not valid domains are dropped during normalisation.

It is a freemail list, not a disposable-address list. It catches many throwaways but not all. Nothing here normalises `+tag` or Gmail dots, since these rules only look at the domain. If the app needs one trial per human, do that separately.
