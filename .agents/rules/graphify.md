---
trigger: always_on
description: Consult the Graphify knowledge graph at graphify-out/ for codebase and architecture questions.
---

# Graphify First

This project has a Graphify knowledge graph at `graphify-out/`.

Rules:

- For codebase or architecture questions, when `graphify-out/graph.json`
  exists, first run `graphify query "<question>"` or the MCP `query_graph`
  equivalent.
- Use `graphify explain "<node>"` / `get_node` for a focused concept and
  `graphify path "<A>" "<B>"` / `shortest_path` for relationships.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain do not surface enough context.
- After modifying code files, refresh the graph with `graphify extract .
  --code-only --out .`, `graphify cluster-only . --graph
  graphify-out/graph.json --no-label`, and `graphify tree --graph
  graphify-out/graph.json --output graphify-out/GRAPH_TREE.html --root .
  --label Sermorizer`.
