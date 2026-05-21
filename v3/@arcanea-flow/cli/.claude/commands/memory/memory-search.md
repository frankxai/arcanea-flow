# memory-search

Search through stored memory.

## Usage
```bash
npx arcanea-flow memory search [options]
```

## Options
- `--query <text>` - Search query
- `--pattern <regex>` - Pattern matching
- `--limit <n>` - Result limit

## Examples
```bash
# Search memory
npx arcanea-flow memory search --query "authentication"

# Pattern search
npx arcanea-flow memory search --pattern "api-.*"

# Limited results
npx arcanea-flow memory search --query "config" --limit 10
```
