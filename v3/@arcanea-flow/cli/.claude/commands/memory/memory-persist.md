# memory-persist

Persist memory across sessions.

## Usage
```bash
npx arcanea-flow memory persist [options]
```

## Options
- `--export <file>` - Export to file
- `--import <file>` - Import from file
- `--compress` - Compress memory data

## Examples
```bash
# Export memory
npx arcanea-flow memory persist --export memory-backup.json

# Import memory
npx arcanea-flow memory persist --import memory-backup.json

# Compressed export
npx arcanea-flow memory persist --export memory.gz --compress
```
