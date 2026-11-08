# Graph Report - .  (2026-11-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 409 nodes · 869 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bfb03f2a`
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
2. `POST()` - 28 edges
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
- `fileName()` --calls--> `slug()`  [EXTRACTED]
  app/page.tsx → lib/util.ts
- `stitchParts()` --calls--> `escapeHtml()`  [EXTRACTED]
  app/page.tsx → lib/util.ts
- `bumpAttempt()` --calls--> `getSupabaseAdmin()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts
- `bumpAttempt()` --calls--> `withSupabaseRetry()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/supabase-server.ts

## Import Cycles
- None detected.

## Communities (22 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (46): POST(), POST(), POST(), POST(), POST(), POST(), GET(), Body (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (36): announce(), BookPanel, canvasToPayload(), EMPTY_META, fileName(), fileToPayloads(), formatEntryDate(), ImagePayload (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (46): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent, deletePasskey() (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (29): LANG_LABEL, LANG_ORDER, BookLabels, BookMeta, buildBookHtml(), Chapter, cleanTitle(), collectScriptureRefs() (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (17): checkEmphasisBudget(), checkKeyVerse(), checkNesting(), checkSectionNumbering(), checkSummaryIsNotHeadingEcho(), findNestingProblems(), findStructuralProblems(), StructuralProblem (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (21): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (13): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+5 more)

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
Cohesion: 0.39
Nodes (7): ALLOWED_STATUS, Ctx, DELETE(), gate(), GET(), PATCH(), PatchBody

### Community 14 - "Community 14"
Cohesion: 0.43
Nodes (6): extractTitleText(), FONT_SWAP, reassembleTranslatedHtml(), SplitTranslationDoc, swapFonts(), withLang()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **112 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `RequestBody` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildEpub()` connect `Community 3` to `Community 4`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 4` to `Community 3`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09375 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.055218855218855216 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10588235294117647 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11282051282051282 - nodes in this community are weakly interconnected._