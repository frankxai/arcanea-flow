# arcanea-flow — Agent Instructions

Read `CLAUDE.md` first when present. This file is the cross-agent entry point.

## Repo Role

`arcanea-flow` contains Arcanea workflow primitives. Treat it as shared infrastructure used by other Arcanea systems.

## Work Pattern

1. Inspect package scripts and source layout before editing.
2. Preserve public package behavior and backward compatibility.
3. Prefer tests or narrow smoke checks for workflow changes.
4. Do not touch unrelated dirty/untracked files.

## Commands

```bash
pnpm test
pnpm build
git status
```

If package scripts differ from the registry, update the registry after verification.

