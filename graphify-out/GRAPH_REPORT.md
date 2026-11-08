# Graph Report - .  (2026-11-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 396 nodes · 839 edges · 21 communities (18 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `920bd02b`
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

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 30 edges
2. `supabaseAdminAvailable()` - 27 edges
3. `POST()` - 26 edges
4. `withSupabaseRetry()` - 22 edges
5. `requireSessionOrUnauthorized()` - 18 edges
6. `compilerOptions` - 16 edges
7. `getAuthConfig()` - 14 edges
8. `buildEpub()` - 13 edges
9. `Lang` - 11 edges
10. `Sermorizer()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/status/route.ts → lib/supabase-server.ts
- `POST()` --calls--> `requireSessionOrUnauthorized()`  [EXTRACTED]
  app/api/generate/route.ts → lib/auth/server.ts
- `POST()` --calls--> `findStructuralProblems()`  [EXTRACTED]
  app/api/generate/route.ts → lib/html-structure.ts
- `POST()` --calls--> `sendPushToAll()`  [EXTRACTED]
  app/api/generate/route.ts → lib/push.ts
- `POST()` --calls--> `stitchPartsServer()`  [EXTRACTED]
  app/api/generate/route.ts → lib/stitch.ts

## Import Cycles
- None detected.

## Communities (21 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (46): POST(), clientIp(), POST(), POST(), POST(), POST(), POST(), POST() (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (56): bumpAttempt(), clearAttempt(), cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences() (+48 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (34): announce(), BookPanel, canvasToPayload(), EMPTY_META, fileToPayloads(), formatEntryDate(), ImagePayload, imageToBase64() (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (24): LANG_LABEL, LANG_ORDER, BookLabels, BookMeta, buildBookHtml(), Chapter, cleanTitle(), collectScriptureRefs() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (18): bestTitle(), Body, Item, Parsed, parseItem(), POST(), fileName(), stitchParts() (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (23): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 10 - "Community 10"
Cohesion: 0.27
Nodes (6): Body, POST(), ensureConfigured(), savePushSubscription(), sendPushToAll(), StoredSub

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (6): checkKeyVerse(), checkNesting(), checkSectionNumbering(), findStructuralProblems(), StructuralProblem, Tag

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 13 - "Community 13"
Cohesion: 0.43
Nodes (6): extractTitleText(), FONT_SWAP, reassembleTranslatedHtml(), SplitTranslationDoc, swapFonts(), withLang()

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **111 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `RequestBody` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 7` to `Community 3`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 4` to `Community 7`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 7` to `Community 4`?**
  _High betweenness centrality (0.195) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09984639016897082 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08448540706605223 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.059506531204644414 - nodes in this community are weakly interconnected._