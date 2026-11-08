# Graph Report - .  (2026-11-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 424 nodes · 913 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b79ccd3`
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

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 30 edges
2. `POST()` - 29 edges
3. `supabaseAdminAvailable()` - 27 edges
4. `withSupabaseRetry()` - 22 edges
5. `requireSessionOrUnauthorized()` - 18 edges
6. `compilerOptions` - 16 edges
7. `getAuthConfig()` - 14 edges
8. `buildEpub()` - 13 edges
9. `Lang` - 11 edges
10. `Sermorizer()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `doc()`  [INFERRED]
  app/api/generate/route.ts → lib/__tests__/normalize-document.test.ts
- `POST()` --calls--> `getAuthConfig()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/auth/server.ts
- `POST()` --calls--> `setSessionCookie()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/auth/server.ts
- `POST()` --calls--> `supabaseAdminAvailable()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `POST()` --calls--> `hashPasscode()`  [EXTRACTED]
  app/api/auth/setup/route.ts → lib/auth/crypto.ts

## Import Cycles
- None detected.

## Communities (20 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (37): announce(), BookPanel, canvasToPayload(), EMPTY_META, fileToPayloads(), formatEntryDate(), ImagePayload, imageToBase64() (+29 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (44): POST(), POST(), POST(), POST(), POST(), POST(), GET(), Body (+36 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (44): cleanTranscript(), POST(), repairHeadingEchoSummary(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (32): LANG_LABEL, LANG_ORDER, fileName(), stitchParts(), BookLabels, BookMeta, buildBookHtml(), Chapter (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (30): bumpAttempt(), clearAttempt(), clientIp(), POST(), ALLOWED_STATUS, Ctx, DELETE(), gate() (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (23): checkEmphasisBudget(), checkKeyVerse(), checkNesting(), checkSectionNumbering(), checkSummaryIsNotHeadingEcho(), findNestingProblems(), findStructuralProblems(), SectionDigest (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (23): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.31
Nodes (10): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 13 - "Community 13"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **115 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `RequestBody` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 5`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 3` to `Community 8`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 8` to `Community 3`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05928614640048397 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10213032581453634 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07474600870827286 - nodes in this community are weakly interconnected._