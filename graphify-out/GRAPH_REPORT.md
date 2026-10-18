# Graph Report - .  (2026-10-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 381 nodes · 754 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59c2c126`
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

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 30 edges
2. `supabaseAdminAvailable()` - 25 edges
3. `withSupabaseRetry()` - 22 edges
4. `requireSessionOrUnauthorized()` - 16 edges
5. `compilerOptions` - 16 edges
6. `getAuthConfig()` - 14 edges
7. `buildEpub()` - 13 edges
8. `Sermorizer()` - 10 edges
9. `setSessionCookie()` - 10 edges
10. `Lang` - 10 edges

## Surprising Connections (you probably didn't know these)
- `bumpAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `bumpAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `clearAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `clearAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `POST()` --calls--> `supabaseAdminAvailable()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts

## Import Cycles
- None detected.

## Communities (22 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (36): POST(), POST(), POST(), POST(), POST(), GET(), Body, POST() (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (31): announce(), BookPanel, canvasToPayload(), EMPTY_META, fileToPayloads(), formatEntryDate(), ImagePayload, imageToBase64() (+23 more)

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
Cohesion: 0.21
Nodes (24): ALLOWED_STATUS, Ctx, DELETE(), gate(), GET(), PATCH(), PatchBody, addUsageServer() (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (19): bumpAttempt(), clearAttempt(), clientIp(), POST(), POST(), hashPasscode(), scryptAsync, verifyPasscode() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (23): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (15): buildGenerationUserContent(), buildInputBlocks(), buildPartUserContent(), ContentBlock, fractionWord(), GenerationInput, ImagePayload, mediaBlock() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.28
Nodes (11): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+3 more)

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
Cohesion: 0.39
Nodes (7): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent

### Community 14 - "Community 14"
Cohesion: 0.36
Nodes (6): extractTitleText(), FONT_SWAP, reassembleTranslatedHtml(), SplitTranslationDoc, swapFonts(), withLang()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **110 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `Body` (+105 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 7` to `Community 3`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 2` to `Community 7`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 7` to `Community 2`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _110 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10980392156862745 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0596078431372549 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09936575052854123 - nodes in this community are weakly interconnected._