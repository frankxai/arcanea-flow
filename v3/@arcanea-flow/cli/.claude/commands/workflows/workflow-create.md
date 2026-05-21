# workflow-create

Create reusable workflow templates.

## Usage
```bash
npx arcanea-flow workflow create [options]
```

## Options
- `--name <name>` - Workflow name
- `--from-history` - Create from history
- `--interactive` - Interactive creation

## Examples
```bash
# Create workflow
npx arcanea-flow workflow create --name "deploy-api"

# From history
npx arcanea-flow workflow create --name "test-suite" --from-history

# Interactive mode
npx arcanea-flow workflow create --interactive
```
