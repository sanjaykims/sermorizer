---
trigger: always_on
description: Mandatory Graphify-first rule for Sermorizer development and architecture work.
---

# Graphify First

This project has a Graphify knowledge graph at `graphify-out/`.

Mandatory rule for future development: Codex, Claude, Antigravity, and any
other coding agent must use Graphify before broad source exploration or making
a development plan. Start from the graph for codebase questions, architecture
work, impact analysis, "where is X?" exploration, and any non-trivial repo
change. Only skip this if `graphify-out/graph.json` is absent/broken or the
user explicitly says not to use Graphify.

Rules:

- For codebase or architecture questions, first run a focused `graphify query
  "<question>"` or the MCP `query_graph` equivalent when
  `graphify-out/graph.json` exists.
- Use `graphify explain "<node>"` / `get_node` for a focused concept and
  `graphify path "<A>" "<B>"` / `shortest_path` for relationships.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain do not surface enough context.
- After modifying code files, refresh the graph with `graphify extract .
  --code-only --out .`, `graphify cluster-only . --graph
  graphify-out/graph.json --no-label`, and `graphify tree --graph
  graphify-out/graph.json --output graphify-out/GRAPH_TREE.html --root .
  --label Sermorizer`.
