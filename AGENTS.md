# AGENTS.md - Sermorizer

Read `CLAUDE.md` before writing code; it contains the product rules, trust
model, and quality gate for this repo.

## Graphify First

This repo commits a Graphify snapshot in `graphify-out/`. For codebase
questions, architecture work, impact analysis, and "where is X?" exploration,
consult Graphify before broad source browsing.

If `graphify` is not already on PATH, install it in a temp venv:

```bash
GRAPHIFY_VENV="${TMPDIR:-/tmp}/graphify-sermorizer-venv"
python3.14 -m venv "$GRAPHIFY_VENV"
"$GRAPHIFY_VENV/bin/python" -m pip install --upgrade pip graphifyy==0.9.26
export PATH="$GRAPHIFY_VENV/bin:$PATH"
```

Rules:

- Start with `graphify query "<question>"` when `graphify-out/graph.json`
  exists.
- Use `graphify explain "<node>"` for a focused concept and
  `graphify path "<A>" "<B>"` for relationships between two parts of the app.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or
  when query/path/explain do not return enough context.
- After modifying code, refresh the snapshot with:

```bash
graphify extract . --code-only --out .
graphify cluster-only . --graph graphify-out/graph.json --no-label
graphify tree --graph graphify-out/graph.json --output graphify-out/GRAPH_TREE.html --root . --label Sermorizer
```

Dirty `graphify-out/` files are expected after code changes; keep them in the
same commit when the graph changed.
