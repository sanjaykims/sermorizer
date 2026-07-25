# Graph Report - .  (2026-07-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 374 nodes · 800 edges · 19 communities (17 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2160dc97`
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

## Communities (19 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (47): POST(), POST(), POST(), POST(), POST(), POST(), GET(), Body (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (43): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent, ALLOWED_STATUS (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (30): announce(), BookPanel, EMPTY_META, fileToPayload(), formatEntryDate(), ImagePayload, imageToBase64(), Job (+22 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (32): LANG_LABEL, LANG_ORDER, fileName(), stitchParts(), BookLabels, BookMeta, buildBookHtml(), Chapter (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (15): buildGenerationUserContent(), buildInputBlocks(), buildPartUserContent(), ContentBlock, fractionWord(), GenerationInput, ImagePayload, mediaBlock() (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (11): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (7): bumpAttempt(), clearAttempt(), clientIp(), POST(), hashPasscode(), scryptAsync, verifyPasscode()

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **106 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `RequestBody` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 6` to `Community 4`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 3` to `Community 6`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 6` to `Community 3`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09134615384615384 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11170212765957446 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06471631205673758 - nodes in this community are weakly interconnected._