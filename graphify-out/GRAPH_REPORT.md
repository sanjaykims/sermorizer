# Graph Report - .  (2026-08-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 381 nodes · 810 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `df8d148f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 24

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 30 edges
2. `supabaseAdminAvailable()` - 27 edges
3. `POST()` - 23 edges
4. `withSupabaseRetry()` - 22 edges
5. `requireSessionOrUnauthorized()` - 18 edges
6. `compilerOptions` - 16 edges
7. `getAuthConfig()` - 14 edges
8. `buildEpub()` - 13 edges
9. `Lang` - 11 edges
10. `Sermorizer()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `bumpAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `bumpAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `clearAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `clearAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `POST()` --calls--> `getAuthConfig()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/auth/server.ts

## Import Cycles
- None detected.

## Communities (25 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (44): POST(), POST(), POST(), POST(), POST(), POST(), GET(), Body (+36 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (49): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent, deletePasskey() (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (33): LANG_LABEL, LANG_ORDER, fileName(), stitchParts(), BookLabels, BookMeta, buildBookHtml(), Chapter (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (8): BookPanel, EMPTY_META, ImagePayload, Job, LANG_LABEL, Metadata, Status, SceneHero()

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.28
Nodes (11): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (9): announce(), formatEntryDate(), playChime(), primeAlerts(), registerPush(), Sermorizer(), upsert(), urlBase64ToUint8Array() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (7): bumpAttempt(), clearAttempt(), clientIp(), POST(), hashPasscode(), scryptAsync, verifyPasscode()

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 13 - "Community 13"
Cohesion: 0.39
Nodes (7): ALLOWED_STATUS, Ctx, DELETE(), gate(), GET(), PATCH(), PatchBody

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (5): formatCost(), PER_M, totalTokens(), usageToCost(), SummaryUsage

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (4): Palette, Theme, themeHint(), THEMES

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (4): canvasToPayload(), fileToPayloads(), imageToBase64(), pdfToImages()

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): waitForRow(), cloudDelete(), cloudGet(), cloudUpdate(), JobStatus

## Knowledge Gaps
- **108 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `RequestBody` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 6` to `Community 3`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 6` to `Community 2`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10520163646990065 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08834586466165413 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09936575052854123 - nodes in this community are weakly interconnected._