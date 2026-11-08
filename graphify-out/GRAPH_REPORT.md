# Graph Report - .  (2026-11-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 409 nodes · 809 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aef35265`
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
- `fileName()` --calls--> `slug()`  [EXTRACTED]
  app/page.tsx → lib/util.ts
- `stitchParts()` --calls--> `escapeHtml()`  [EXTRACTED]
  app/page.tsx → lib/util.ts
- `POST()` --indirect_call--> `doc()`  [INFERRED]
  app/api/generate/route.ts → lib/__tests__/normalize-document.test.ts
- `bumpAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `bumpAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts

## Import Cycles
- None detected.

## Communities (23 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (44): POST(), POST(), POST(), POST(), POST(), POST(), GET(), Body (+36 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (33): announce(), BookPanel, canvasToPayload(), EMPTY_META, fileName(), fileToPayloads(), formatEntryDate(), ImagePayload (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (29): LANG_LABEL, LANG_ORDER, BookLabels, BookMeta, buildBookHtml(), Chapter, cleanTitle(), collectScriptureRefs() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (24): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent, checkEmphasisBudget() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (25): ALLOWED_STATUS, Ctx, DELETE(), gate(), GET(), PATCH(), PatchBody, deletePasskey() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (19): buildGenerationUserContent(), buildInputBlocks(), buildPartUserContent(), ContentBlock, fractionWord(), GenerationInput, ImageMediaType, ImagePayload (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (23): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (13): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (7): bumpAttempt(), clearAttempt(), clientIp(), POST(), hashPasscode(), scryptAsync, verifyPasscode()

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 14 - "Community 14"
Cohesion: 0.36
Nodes (6): extractTitleText(), FONT_SWAP, reassembleTranslatedHtml(), SplitTranslationDoc, swapFonts(), withLang()

### Community 15 - "Community 15"
Cohesion: 0.40
Nodes (3): ensureConfigured(), sendPushToAll(), StoredSub

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **114 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `Body` (+109 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 3`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 2` to `Community 8`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10520163646990065 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0596078431372549 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11282051282051282 - nodes in this community are weakly interconnected._