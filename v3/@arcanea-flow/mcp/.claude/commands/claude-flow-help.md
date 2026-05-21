---
name: arcanea-flow-help
description: Show Claude-Flow commands and usage
---

# Claude-Flow Commands

## 🌊 Claude-Flow: Agent Orchestration Platform

Claude-Flow is the ultimate multi-terminal orchestration platform that revolutionizes how you work with Claude Code.

## Core Commands

### 🚀 System Management
- `./arcanea-flow start` - Start orchestration system
- `./arcanea-flow start --ui` - Start with interactive process management UI
- `./arcanea-flow status` - Check system status
- `./arcanea-flow monitor` - Real-time monitoring
- `./arcanea-flow stop` - Stop orchestration

### 🤖 Agent Management
- `./arcanea-flow agent spawn <type>` - Create new agent
- `./arcanea-flow agent list` - List active agents
- `./arcanea-flow agent info <id>` - Agent details
- `./arcanea-flow agent terminate <id>` - Stop agent

### 📋 Task Management
- `./arcanea-flow task create <type> "description"` - Create task
- `./arcanea-flow task list` - List all tasks
- `./arcanea-flow task status <id>` - Task status
- `./arcanea-flow task cancel <id>` - Cancel task
- `./arcanea-flow task workflow <file>` - Execute workflow

### 🧠 Memory Operations
- `./arcanea-flow memory store "key" "value"` - Store data
- `./arcanea-flow memory query "search"` - Search memory
- `./arcanea-flow memory stats` - Memory statistics
- `./arcanea-flow memory export <file>` - Export memory
- `./arcanea-flow memory import <file>` - Import memory

### ⚡ SPARC Development
- `./arcanea-flow sparc "task"` - Run SPARC orchestrator
- `./arcanea-flow sparc modes` - List all 17+ SPARC modes
- `./arcanea-flow sparc run <mode> "task"` - Run specific mode
- `./arcanea-flow sparc tdd "feature"` - TDD workflow
- `./arcanea-flow sparc info <mode>` - Mode details

### 🐝 Swarm Coordination
- `./arcanea-flow swarm "task" --strategy <type>` - Start swarm
- `./arcanea-flow swarm "task" --background` - Long-running swarm
- `./arcanea-flow swarm "task" --monitor` - With monitoring
- `./arcanea-flow swarm "task" --ui` - Interactive UI
- `./arcanea-flow swarm "task" --distributed` - Distributed coordination

### 🌍 MCP Integration
- `./arcanea-flow mcp status` - MCP server status
- `./arcanea-flow mcp tools` - List available tools
- `./arcanea-flow mcp config` - Show configuration
- `./arcanea-flow mcp logs` - View MCP logs

### 🤖 Claude Integration
- `./arcanea-flow claude spawn "task"` - Spawn Claude with enhanced guidance
- `./arcanea-flow claude batch <file>` - Execute workflow configuration

## 🌟 Quick Examples

### Initialize with SPARC:
```bash
npx -y arcanea-flow@latest init --sparc
```

### Start a development swarm:
```bash
./arcanea-flow swarm "Build REST API" --strategy development --monitor --review
```

### Run TDD workflow:
```bash
./arcanea-flow sparc tdd "user authentication"
```

### Store project context:
```bash
./arcanea-flow memory store "project_requirements" "e-commerce platform specs" --namespace project
```

### Spawn specialized agents:
```bash
./arcanea-flow agent spawn researcher --name "Senior Researcher" --priority 8
./arcanea-flow agent spawn developer --name "Lead Developer" --priority 9
```

## 🎯 Best Practices
- Use `./arcanea-flow` instead of `npx arcanea-flow` after initialization
- Store important context in memory for cross-session persistence
- Use swarm mode for complex tasks requiring multiple agents
- Enable monitoring for real-time progress tracking
- Use background mode for tasks > 30 minutes

## 📚 Resources
- Documentation: https://github.com/ruvnet/claude-code-flow/docs
- Examples: https://github.com/ruvnet/claude-code-flow/examples
- Issues: https://github.com/ruvnet/claude-code-flow/issues
