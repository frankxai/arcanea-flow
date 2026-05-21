# swarm-spawn

Spawn agents in the swarm.

## Usage
```bash
npx arcanea-flow swarm spawn [options]
```

## Options
- `--type <type>` - Agent type
- `--count <n>` - Number to spawn
- `--capabilities <list>` - Agent capabilities

## Examples
```bash
npx arcanea-flow swarm spawn --type coder --count 3
npx arcanea-flow swarm spawn --type researcher --capabilities "web-search,analysis"
```
