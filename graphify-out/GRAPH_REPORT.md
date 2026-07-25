# Graph Report - .  (2026-07-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 375 nodes · 722 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1d9d5c3e`
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
8. `setSessionCookie()` - 10 edges
9. `rpInfoFrom()` - 9 edges
10. `iconArt()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `verifyPasscode()`  [EXTRACTED]
  app/api/auth/passcode/route.ts → lib/auth/crypto.ts
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

## Communities (24 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (42): POST(), POST(), POST(), POST(), POST(), POST(), GET(), POST() (+34 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (32): LANG_LABEL, LANG_ORDER, BookLabels, BookMeta, buildBookHtml(), Chapter, cleanTitle(), collectScriptureRefs() (+24 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (18): announce(), BookPanel, EMPTY_META, fileToPayload(), formatEntryDate(), ImagePayload, imageToBase64(), Job (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (32): eslint, eslint-config-next, @eslint/eslintrc, devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @types/node (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (29): bumpAttempt(), clearAttempt(), clientIp(), POST(), ALLOWED_STATUS, Ctx, DELETE(), gate() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (26): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (20): cleanTranscript(), POST(), RequestBody, runAnthropic(), RunResult, stripFences(), UserContent, buildGenerationUserContent() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (16): bestTitle(), Body, Item, Parsed, parseItem(), POST(), detectLang(), importGroupKey() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (21): @anthropic-ai/sdk, jszip, next, node-html-parser, dependencies, @anthropic-ai/sdk, jszip, next (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (4): Phase, SetupScreen(), Status, apiFetch()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): AppleIcon(), size, GET(), GET(), Icon(), size, iconArt()

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (6): Body, POST(), ensureConfigured(), savePushSubscription(), sendPushToAll(), StoredSub

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (7): bodyKR, bodyLat, displayKR, displayLat, metadata, monoLat, viewport

### Community 13 - "Community 13"
Cohesion: 0.36
Nodes (6): extractTitleText(), FONT_SWAP, reassembleTranslatedHtml(), SplitTranslationDoc, swapFonts(), withLang()

### Community 14 - "Community 14"
Cohesion: 0.80
Nodes (3): hashPasscode(), scryptAsync, verifyPasscode()

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (4): Palette, Theme, themeHint(), THEMES

### Community 16 - "Community 16"
Cohesion: 0.50
Nodes (3): cspDirectives, nextConfig, securityHeaders

## Knowledge Gaps
- **106 isolated node(s):** `Status`, `Phase`, `LANG_LABEL`, `LANG_ORDER`, `Body` (+101 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 8` to `Community 3`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `buildEpub()` connect `Community 1` to `Community 8`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `jszip` connect `Community 8` to `Community 1`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **What connects `Status`, `Phase`, `LANG_LABEL` to the rest of the system?**
  _106 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11103896103896103 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08953900709219859 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07226890756302522 - nodes in this community are weakly interconnected._