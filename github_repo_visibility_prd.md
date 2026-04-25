# GitHub Repo Visibility Chrome Extension

## Product Requirements Document and Implementation Plan

**Date:** April 23, 2026

## Executive summary

Build a free, open-source Chromium extension that adds a compact visibility layer to public GitHub repository pages. The extension should answer four questions quickly and in-context: Is this repository attracting attention? Is it active? Are maintainers responsive? Is the project trustworthy?

The MVP will be fully frontend, serverless, and anonymous by default. It will run as a Manifest V3 extension, call the GitHub REST API directly from the extension, compute derived metrics locally, and persist only local cache/state in the browser.

The product decision for v1 is explicit: no sign-in, no backend, no telemetry, public repositories only, and GitHub REST only. Authentication is deferred because the key public endpoints needed for the MVP can already be used without authentication on public resources [R1–R7].

## Do we need auth?

Not for the MVP. The repository, stargazers, repository statistics, issues, pull requests, releases, community profile, and commits endpoints can all be used without authentication when only public resources are requested [R1–R7].

Authentication becomes useful only for later enhancements: higher rate limits, private repository support, owner-only traffic endpoints, or personalized features like “starred by you” and “watching state.” GitHub’s primary REST limit is 60 requests per hour for unauthenticated requests and 5,000 requests per hour for authenticated-user requests [R8]. Traffic endpoints are specifically for repositories where the caller has write access [R15].

Decision: ship v1 with no auth. Keep the codebase ready for an optional future auth mode, but do not block core value behind sign-in.

## Problem statement

GitHub repo pages expose basic metadata such as stars, forks, and open issues, but they do not natively summarize the signals that matter most when evaluating an open-source project: recent star momentum, release freshness, maintenance cadence, community hygiene, and responsiveness to contributions.

Today, users often open multiple GitHub tabs, Insights pages, or external tools to answer simple evaluation questions. That creates friction and breaks the repo-page workflow. The extension should collapse those questions into a single, lightweight panel on the repo page itself.

## Goals

Show a useful summary on any public GitHub repo page with near-zero setup.

Work entirely client-side with no server, no account creation, and no data collection.

Use GitHub REST endpoints and local computation rather than scraping or remote processing.

Keep permissions narrow and understandable.

Be open-source friendly: simple architecture, readable code, easy local development.

## Non-goals

Private repository support in v1.

Owner-only traffic metrics in v1.

Write actions to GitHub such as starring, watching, commenting, or filing issues.

Cross-repository dashboards, alerts, or portfolio analytics.

Guaranteed full all-time star history on first paint for very large repositories.

GitHub Enterprise Server support in v1.

## Target users and jobs to be done

Adopter / evaluator: “I’m considering this project as a dependency. Tell me whether it is active, maintained, and healthy without leaving the repo page.”

Contributor: “I want to know whether my pull request or contribution will likely get attention and review.”

Maintainer / observer: “I want a compact readout of how this repository looks to outsiders.”

## Product principles

In-context first. The default experience lives on the repo page, not in the extension popup.

Truth over hype. Prefer precise labels such as “recent sample,” “partial,” or “unavailable” over misleading certainty.

Progressive depth. Show a compact summary immediately, then let users expand into activity and star-trend detail.

No dark patterns. No forced account, no telemetry, no upsell.

Respect GitHub. Use documented endpoints, cache aggressively, and keep request volume small.

## User experience

Surface area: inject a compact panel into public GitHub repository pages under the repository header or in the right rail, with a fallback mount if GitHub layout changes.

Default state: a compact summary card with key metrics and 2–3 badges. Expanded details are one click away.

Sections: Summary, Activity, Responsiveness, and Stars.

States: loading, partial data, unavailable, archived, fork, no release, rate limited.

Copy style: short labels, no jargon when a plain-English term works better, and tooltips for computed metrics.

## MVP feature set

1) Summary card
Show stars, forks, true watchers/subscribers, days since last push, latest release age, and community-health score. Use subscribers_count for watchers, not watchers_count, because GitHub’s REST responses map watchers_count and stargazers_count to stars, while subscribers_count corresponds to watchers [R16].

2) Activity snapshot
Show a 52-week commit sparkline and a recent-activity headline such as “active this month” or “quiet recently.” Repository statistics endpoints can return 202 Accepted while GitHub is generating the data, and some statistics are limited for repositories with 10,000+ commits, so the UI must clearly handle those states [R3].

3) Responsiveness
Show recent merged PR count, median time to merge for the recent sample analyzed, and recent closed-issue count. Because GitHub issues endpoints may return pull requests as well, filter any item that includes a pull_request key [R4].

4) Star trend
Show a recent daily star trend for the last 30 or 90 days. Use the stargazers endpoint with the application/vnd.github.star+json media type so the response includes starred_at timestamps [R2]. This feature should load on demand or progressively because it is the most request-expensive metric.

5) Hygiene and trust signals
Show archived/fork status, detected license, release freshness, and community files via the community profile endpoint. Community profile metrics are not available for forks, so fork repos need an explicit “not available for forks” state [R7].

## Out of scope for v1 but designed for later

Optional user-provided token for higher rate limits.

Private repository visibility.

Owner-only traffic views/clones/referrers.

Repo comparison mode.

GitHub Enterprise domains and custom API base URLs.

Export or shareable report URLs.

## Functional requirements

FR1. The extension must activate automatically on public GitHub repository pages and remain dormant elsewhere.

FR2. The extension must derive owner/repo from the current page URL and fetch data through the GitHub REST API in extension context, not from the page’s own JavaScript context.

FR3. The extension must render a usable cached summary before background revalidation when cached data exists.

FR4. The extension must never require sign-in for MVP functionality.

FR5. The extension must label metrics as exact, sampled, partial, or unavailable where appropriate.

FR6. The extension must preserve keyboard navigation and not interfere with GitHub page behavior.

FR7. The extension must persist cache locally and store no user analytics or personal identifiers.

FR8. The extension must degrade gracefully under rate limits, 202 warm-up responses, missing releases, missing community metrics, and large-repo star-history constraints.

FR9. The extension must expose explanatory tooltips for computed fields such as merge time, recent star trend, and community health.

FR10. The extension must be open-source ready with clear contributor docs and a build that can run locally without any hosted service.

## Metric definitions

Days since last push
Source: repository endpoint pushed_at. Display as “pushed X days ago.”

Watchers
Display subscribers_count and label it “Watchers.” Do not use watchers_count for this field [R16].

Latest release age
Source: latest release endpoint. Display “No releases” if the endpoint returns not found [R6].

Community health
Source: community profile health_percentage [R7].

52-week commit sparkline
Source: repository statistics commit_activity endpoint [R3].

Recent PR responsiveness
Compute from a recent closed-PR sample by reading merged_at and created_at for merged PRs. Display both the sample size and the median time to merge.

Recent issue closures
Compute from recent closed issues after excluding any records with pull_request [R4].

Star trend
Compute from starred_at timestamps. Mark the result as exact if the loader paginates back beyond the requested time window, otherwise mark it partial.

## Architecture

High-level architecture
Content script + UI shell on github.com repository pages. Background/service worker handles API calls, caching, deduplication, and metric computation. No backend. No remote code [R14].

Why the service worker owns network access
Chrome documents that content-script requests are still treated as cross-origin requests even if the extension has host permissions, so the GitHub API client should live in the extension context and communicate with the page via message passing [R11].

Manifest model
Use Manifest V3. Chrome moved background logic to service workers that run only when needed, and MV3 disallows remotely hosted code [R14].

State ownership
UI state stays in the content script. Data cache and in-flight request registry live in the service worker. Persisted cache uses IndexedDB for larger records and chrome.storage.local for smaller settings or cache metadata. Use chrome.storage.session only for volatile in-memory session state if later needed [R12].

## Permissions and privacy

Required extension permissions
storage. No identity permission in v1. No tabs permission in v1 unless needed for a later popup workflow.

Required host permissions
https://github.com/* for repo-page content injection and https://api.github.com/* for REST requests.

Why this is still low-friction
The extension requests access only to GitHub and the GitHub API; it does not request broad all-sites access.

Privacy policy stance
No telemetry, no external backend, no cookies, no remote scripts, no user account. All cached data remains in-browser on the user’s machine.

Future note
If GitHub Enterprise support is added later, optional_host_permissions can be introduced so users can grant additional hosts at runtime [R13].

## Data sources and endpoint plan

Base repository metadata
GET /repos/{owner}/{repo}
Used for name, owner, description, stars, forks, subscribers_count, archived, fork, pushed_at, default branch, license, topics [R1].

Community health
GET /repos/{owner}/{repo}/community/profile
Used for health_percentage and presence of README, CONTRIBUTING, templates, license, and code of conduct [R7].

Activity
GET /repos/{owner}/{repo}/stats/commit_activity
Used for the 52-week sparkline and weekly totals [R3].

Recent release
GET /repos/{owner}/{repo}/releases/latest
Used for release freshness [R6].

Recent PR sample
GET /repos/{owner}/{repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100
Used for recent merged-PR counts and merge-time sample [R5].

Recent issue sample
GET /repos/{owner}/{repo}/issues?state=closed&sort=updated&direction=desc&per_page=100
Filter out records that include pull_request [R4].

Star trend
GET /repos/{owner}/{repo}/stargazers?per_page=100&page=N
Use Accept: application/vnd.github.star+json [R2].

Optional commit count helper
GET /repos/{owner}/{repo}/commits?since=...&per_page=1
Use Link headers to estimate counts when helpful [R9].

## Caching, request budgeting, and rate limits

Anonymous-mode reality
GitHub allows unauthenticated requests for public data, but the primary REST limit is 60 requests per hour per originating IP [R8]. This means the extension must be careful with cold-start fan-out and especially with star-history pagination.

Request budget target
Cold summary load should stay within roughly 4–6 requests before any user expands deeper views. Heavy or paginated features, especially star trends, should load only when expanded.

Caching policy
Store repo summaries and derived metrics locally. Use stale-while-revalidate semantics where possible: return cached data immediately, then refresh in the background and update the UI if the payload changes.

Conditional requests
Persist ETags and/or Last-Modified values for endpoints that provide them. GitHub recommends conditional GETs, and authorized 304 responses do not count against the primary rate limit [R10]. In anonymous mode, treat conditional requests primarily as a bandwidth and freshness optimization, not as a guaranteed rate-limit bypass.

Pagination strategy
Use per_page up to 100 and parse Link headers rather than guessing totals [R9].

Backoff
On 403 rate-limit responses or abuse protection, stop background retries, show a human-readable state, and avoid hammering the API.

## Edge cases and failure handling

Fork repository
Community profile metrics are unavailable for forks [R7]. Show “community health unavailable for forks.”

Statistics warming up
If stats endpoints return 202 Accepted, show “preparing activity data” and retry with bounded backoff [R3].

No content
If stats endpoints return 204, show “no activity data available” [R3].

10,000+ commit repositories
Some statistics endpoints are limited or degraded for repositories with 10,000 or more commits [R3]. The UI must show “limited by GitHub stats API” rather than silently omitting the section.

No releases
Treat latest release 404 as a normal state, not an error.

Large star histories
If the 90-day cutoff cannot be reached within the page/time budget, show the result as partial or offer “load deeper history.”

Rate limited
Show a clear anonymous-rate-limit message, preserve cached data, and stop further eager fetches until the retry window.

GitHub layout changes
Use resilient selectors and a fallback insertion strategy so the panel survives moderate DOM changes.

## Accessibility and performance requirements

The panel must be fully keyboard navigable and screen-reader friendly.

Do not rely on color alone for meaning; pair color with text or icons.

Respect reduced-motion preferences for charts or transitions.

Do not block initial GitHub page rendering. Mount an empty shell quickly, then hydrate data asynchronously.

Performance target: cached summary visible almost immediately; cold summary within a couple of seconds on a typical connection; deep star history explicitly lazy-loaded.

## Open-source operating model

License recommendation: MIT or Apache-2.0. Pick one and be explicit in the repository.

Repository hygiene: CONTRIBUTING.md, issue templates, code of conduct, release notes, screenshots, and architectural notes in the README.

Build and tooling should work with a single local setup flow and no cloud dependencies.

No analytics SDKs, no hosted error tracking, and no mandatory remote config for v1.

## Recommended tech stack

TypeScript for all runtime code.

Vite for extension bundling and local development.

Preact or React for the injected UI; prefer Preact if bundle size matters more than ecosystem convenience.

Vitest for unit tests and Playwright for end-to-end UI checks on GitHub pages.

IndexedDB wrapper (for example, a tiny custom wrapper or idb) for larger cached payloads such as star pages.

## Suggested file structure

manifest.json

src/background/service-worker.ts — request orchestration, cache, metrics computation

src/background/messages.ts — typed message contracts

src/content/index.tsx — mount point and repo-page detection

src/content/mount.ts — resilient DOM insertion logic

src/ui/App.tsx — top-level panel

src/ui/components/* — metrics cards, charts, tooltips, states

src/api/github.ts — fetch wrapper, headers, retry/backoff, ETag support

src/api/endpoints.ts — endpoint builders

src/cache/indexed-db.ts — long-lived cache

src/cache/local-meta.ts — small metadata and settings

src/metrics/summary.ts — repo-level normalization

src/metrics/activity.ts — commit sparkline and freshness

src/metrics/responsiveness.ts — PR and issue sample metrics

src/metrics/stars.ts — stargazer pagination and daily aggregation

src/utils/link-header.ts — parse GitHub Link headers

src/utils/date.ts — relative-time helpers

tests/unit/*

tests/e2e/*

## Implementation plan

Milestone 0 — Foundation
Set up the repo, build pipeline, MV3 manifest, content-script injection, service-worker messaging, and a placeholder panel. Exit criteria: the extension mounts on public repo pages and can display owner/repo derived from the URL.

Milestone 1 — Summary card
Implement repository, community-profile, and latest-release fetching. Normalize basic fields and render the compact summary with archived/fork/no-release states. Add storage.local or IndexedDB-backed caching. Exit criteria: a public repo page shows stable summary data with cached reload behavior.

Milestone 2 — Activity
Implement commit_activity fetching with 202/204 handling and 10,000-commit-limit messaging. Render a 52-week sparkline and freshness labels. Exit criteria: recent activity renders correctly across active, inactive, and stats-warming repos.

Milestone 3 — Responsiveness
Implement recent closed PR and recent closed issue sampling, merge-time calculation, and issue filtering via pull_request. Exit criteria: the panel shows recent-sample responsiveness metrics with tooltip definitions and sample-size labeling.

Milestone 4 — Stars
Implement the stargazer client with application/vnd.github.star+json, daily aggregation, progressive pagination, request caps, and exact-vs-partial labeling. Exit criteria: users can open the Stars view and see a recent trend without hurting default page load.

Milestone 5 — Polish
Add empty/error/rate-limit states, improved mount resilience, accessibility work, keyboard support, tooltips, and small visual polish. Exit criteria: the extension is comfortable to use and handles expected edge cases cleanly.

Milestone 6 — Release readiness
Complete README, screenshots, license, contributor docs, CI checks, versioning, and packaging for the Chrome Web Store. Exit criteria: the extension can be built and packaged reproducibly from a fresh checkout.

## Engineering workstreams

Workstream A: platform shell
Manifest, injection, message passing, environment config, build/release scripts.

Workstream B: GitHub API client
Headers, Accept negotiation, rate-limit handling, Link parsing, ETag persistence, retry policy.

Workstream C: metrics engine
Pure functions that convert raw GitHub payloads into a stable view model. Keep these functions framework-agnostic and unit tested.

Workstream D: UI layer
Panel layout, charts, tooltips, theme compatibility with GitHub light/dark modes, accessibility.

Workstream E: quality
Unit tests, fixture payloads, GitHub-page smoke tests, manual matrix, and regression checklist.

## Acceptance criteria by feature

Summary
Given any supported public repo page, the extension shows stars, forks, watchers, push freshness, release freshness, and community health or a precise unavailable state.

Activity
Given a repo with available stats, the extension shows a readable 52-week sparkline. Given 202 or 204 from GitHub, the extension shows a correct non-error state.

Responsiveness
Given recent PR and issue data, the extension shows merge-time and closure metrics labeled with sample scope.

Stars
Given a repo where the recent star window can be resolved within the request budget, the extension shows an exact recent daily trend. Otherwise it clearly labels the result partial or unavailable until deeper loading is requested.

Rate limiting
Given anonymous-limit exhaustion, the extension retains cached data and shows a comprehensible message instead of failing silently.

Privacy
No telemetry requests are made to any non-GitHub server.

## Testing plan

Unit tests
Link-header parsing, date-window math, star aggregation, merge-time median logic, issue filtering, cache expiration decisions.

Integration tests
Content-script mount behavior, service-worker message flow, cache-hit vs cache-miss paths, retry/backoff behavior.

Fixture tests
Archived repo, fork repo, no-release repo, repo with no activity, stats-202 repo, repo with large star history, repo with limited stats due to 10,000+ commits.

Manual QA matrix
Small active repo, huge popular repo, abandoned repo, archived repo, fork, repo with many PRs, and repo with zero releases.

Performance checks
Cold load request count, cached render latency, star-view request cap behavior, and UI responsiveness on expansion.

## Launch plan

Alpha
Unpacked developer build used by the maintainers on a hand-picked set of public repos.

Beta
Public GitHub release + README instructions for side-loading. Collect GitHub issues from users, not telemetry.

General availability
Chrome Web Store listing after UX polish, screenshots, and permission copy are finalized.

## Risks and mitigations

Risk: anonymous rate limit is too restrictive for star history.
Mitigation: keep summary cheap, lazy-load star trends, cache aggressively, and label partial results honestly.

Risk: GitHub stats endpoints are inconsistent or delayed.
Mitigation: treat 202/204/limit states as first-class UX, not exceptions [R3].

Risk: GitHub DOM changes break injection.
Mitigation: centralize selectors, maintain fallback mount points, and cover insertion with smoke tests.

Risk: users misread “watchers.”
Mitigation: source the number from subscribers_count and provide a tooltip explaining the distinction [R16].

Risk: misleading pseudo-science score.
Mitigation: prefer transparent component metrics and badges over a single opaque overall score.

## Future roadmap

Optional fine-grained PAT mode for users who want higher limits.

Private repo support once auth exists.

Owner-only traffic views and clones [R15].

GitHub Enterprise domain support via optional host permissions [R13].

Repo comparison and export/share workflows.

Optional GraphQL helper endpoints only if they clearly reduce request volume without increasing complexity.

## Recommendation

Ship the first release as an anonymous, public-repo-only, frontend-only extension. That keeps the product aligned with the original vision: free, open-source, zero account, and very low friction.

The most important design choice is not “can we use auth later?” but “can the default experience feel valuable within a tiny anonymous request budget?” The PRD above is built around that constraint.

## References

- **R1** — GitHub REST API: Get a repository (public resources can be accessed without authentication): https://docs.github.com/en/rest/repos/repos
- **R2** — GitHub REST API: List stargazers (supports starred_at timestamps via application/vnd.github.star+json; public resources can be accessed without authentication): https://docs.github.com/en/rest/activity/starring
- **R3** — GitHub REST API: Repository statistics (public resources can be accessed without authentication; some endpoints return 202/204; some statistics are limited for repositories with 10,000+ commits): https://docs.github.com/en/rest/metrics/statistics
- **R4** — GitHub REST API: Issues (issues endpoints may return pull requests; identify them via pull_request key; public resources can be accessed without authentication): https://docs.github.com/en/rest/issues/issues
- **R5** — GitHub REST API: Pull requests (public resources can be accessed without authentication): https://docs.github.com/en/rest/pulls/pulls
- **R6** — GitHub REST API: Releases (latest release endpoint; public resources can be accessed without authentication): https://docs.github.com/en/rest/releases/releases
- **R7** — GitHub REST API: Community profile metrics (returns health_percentage and related signals; repository cannot be a fork; public resources can be accessed without authentication): https://docs.github.com/en/rest/metrics/community
- **R8** — GitHub REST API: Rate limits (60 requests/hour unauthenticated per IP; 5,000 requests/hour authenticated user): https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- **R9** — GitHub REST API: Using pagination (Link header; per_page parameter): https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
- **R10** — GitHub REST API: Best practices (conditional requests with ETag/Last-Modified; authorized 304 responses do not count against the primary rate limit): https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- **R11** — Chrome Extensions: Cross-origin network requests (content scripts are still subject to cross-origin rules; extension context needs host permissions): https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- **R12** — Chrome Extensions: storage API (storage.local and storage.session limits and behavior): https://developer.chrome.com/docs/extensions/reference/api/storage
- **R13** — Chrome Extensions: permissions API (optional_host_permissions at runtime): https://developer.chrome.com/docs/extensions/reference/api/permissions
- **R14** — Chrome Extensions: Manifest V3 (service workers run only when needed; no remotely hosted code): https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- **R15** — GitHub REST API: Repository traffic (requires write access): https://docs.github.com/en/rest/metrics/traffic
- **R16** — GitHub REST API: Starring (watchers_count maps to stars; subscribers_count maps to watchers): https://docs.github.com/en/rest/activity/starring