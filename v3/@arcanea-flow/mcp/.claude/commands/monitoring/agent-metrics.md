# agent-metrics

View agent performance metrics.

## Usage
```bash
npx arcanea-flow agent metrics [options]
```

## Options
- `--agent-id <id>` - Specific agent
- `--period <time>` - Time period
- `--format <type>` - Output format

## Examples
```bash
# All agents metrics
npx arcanea-flow agent metrics

# Specific agent
npx arcanea-flow agent metrics --agent-id agent-001

# Last hour
npx arcanea-flow agent metrics --period 1h
```
