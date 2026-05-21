# CLI Commands Migration Guide

> Migrating from V2 CLI (25 commands) to V3 CLI (7 commands)

## Overview

V3 CLI is streamlined with 7 core commands. Many V2 commands need migration or have been consolidated.

## Command Coverage

| Status | V2 Commands | V3 Commands |
|--------|-------------|-------------|
| ✅ Implemented | 7 | 7 |
| ❌ Missing | 18 | - |
| **Total** | 25 | 7 |

## Implemented Commands ✅

### agent
```bash
# V2
npx arcanea-flow agent spawn --type coder --name my-coder
npx arcanea-flow agent list --detailed
npx arcanea-flow agent info <agentId>
npx arcanea-flow agent terminate <agentId>

# V3 (same)
npx arcanea-flow agent spawn --type coder --id my-coder
npx arcanea-flow agent list --detailed
npx arcanea-flow agent status <agentId>
npx arcanea-flow agent terminate <agentId>
```

### memory
```bash
# V2
npx arcanea-flow memory store --namespace default --content "data"
npx arcanea-flow memory query --search "keyword" --limit 10
npx arcanea-flow memory list --namespace default

# V3 (enhanced)
npx arcanea-flow memory store --type episodic --content "data"
npx arcanea-flow memory search --query "keyword" --search-type hybrid
npx arcanea-flow memory list --type all --sort-by relevance
```

### swarm
```bash
# V2
npx arcanea-flow swarm --strategy auto --max-agents 5

# V3 (enhanced)
npx arcanea-flow swarm init --topology hierarchical-mesh --max-agents 15
npx arcanea-flow swarm status --include-metrics
npx arcanea-flow swarm scale --target 10 --strategy gradual
```

### hooks
```bash
# V2
npx arcanea-flow hooks pre-edit --file src/app.ts
npx arcanea-flow hooks post-edit --file src/app.ts --success true

# V3 (enhanced with learning)
npx arcanea-flow hooks pre-edit src/app.ts
npx arcanea-flow hooks post-edit src/app.ts --success true
npx arcanea-flow hooks route "implement feature X"
npx arcanea-flow hooks explain "implement feature X"
npx arcanea-flow hooks pretrain
npx arcanea-flow hooks metrics
```

### mcp
```bash
# V2
npx arcanea-flow mcp start --port 3000 --transport stdio
npx arcanea-flow mcp stop
npx arcanea-flow mcp status

# V3 (same)
npx arcanea-flow mcp start --port 3000 --transport stdio
npx arcanea-flow mcp stop
npx arcanea-flow mcp status
```

### config
```bash
# V2
npx arcanea-flow config get orchestrator
npx arcanea-flow config set orchestrator.maxAgents 10

# V3
npx arcanea-flow config load --scope project
npx arcanea-flow config save --create-backup
npx arcanea-flow config validate --strict
```

### migrate
```bash
# V3 only
npx arcanea-flow migrate status
npx arcanea-flow migrate run --target all --backup
npx arcanea-flow migrate verify
npx arcanea-flow migrate rollback --backup-id <id>
```

## Missing Commands ❌

### Priority 1 - HIGH

#### init
```bash
# V2
npx arcanea-flow init
npx arcanea-flow init --minimal
npx arcanea-flow init --flow-nexus

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/init.ts
export const initCommand = {
  command: 'init',
  description: 'Initialize Claude Code integration files',
  options: [
    { flags: '-f, --force', description: 'Overwrite existing files' },
    { flags: '-m, --minimal', description: 'Create minimal configuration' },
    { flags: '--flow-nexus', description: 'Initialize with Flow Nexus' }
  ],
  action: async (options) => {
    await createClaudeFlowConfig(options);
    await createDefaultAgents(options);
    if (!options.minimal) {
      await createHooksConfig(options);
      await createWorkflowTemplates(options);
    }
  }
};
```

#### start
```bash
# V2
npx arcanea-flow start
npx arcanea-flow start --daemon
npx arcanea-flow start --port 3000

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/start.ts
export const startCommand = {
  command: 'start',
  description: 'Start the orchestration system',
  options: [
    { flags: '-d, --daemon', description: 'Run as daemon' },
    { flags: '-p, --port <port>', description: 'MCP server port' }
  ],
  action: async (options) => {
    const swarm = await initializeV3Swarm();
    await swarm.spawnAllAgents();
    if (options.port) {
      await startMCPServer({ port: options.port });
    }
  }
};
```

#### status
```bash
# V2
npx arcanea-flow status
npx arcanea-flow status --watch
npx arcanea-flow status --json
npx arcanea-flow status --health-check

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/status.ts
export const statusCommand = {
  command: 'status',
  description: 'Show enhanced system status',
  options: [
    { flags: '-w, --watch', description: 'Watch mode' },
    { flags: '-i, --interval <seconds>', description: 'Update interval' },
    { flags: '--json', description: 'Output in JSON format' },
    { flags: '--health-check', description: 'Perform health checks' }
  ],
  action: async (options) => {
    const status = await getSystemStatus();
    if (options.healthCheck) {
      status.health = await performHealthChecks();
    }
    if (options.watch) {
      await watchStatus(status, options.interval);
    } else {
      displayStatus(status, options.json);
    }
  }
};
```

#### task
```bash
# V2
npx arcanea-flow task create --type implementation --description "Build feature"
npx arcanea-flow task list --status running
npx arcanea-flow task status <taskId>
npx arcanea-flow task cancel <taskId>
npx arcanea-flow task assign <taskId> --agent <agentId>

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/task.ts
export const taskCommand = {
  command: 'task',
  description: 'Manage tasks',
  subcommands: [
    {
      command: 'create',
      options: [
        { flags: '-t, --type <type>', description: 'Task type' },
        { flags: '-d, --description <desc>', description: 'Task description' },
        { flags: '-p, --priority <priority>', description: 'Task priority' },
        { flags: '-a, --assign <agentId>', description: 'Assign to agent' }
      ]
    },
    { command: 'list', options: [{ flags: '-s, --status <status>' }] },
    { command: 'status', args: '<taskId>' },
    { command: 'cancel', args: '<taskId>' },
    { command: 'assign', args: '<taskId>', options: [{ flags: '--agent <agentId>' }] }
  ]
};
```

#### session
```bash
# V2
npx arcanea-flow session list
npx arcanea-flow session save --description "Checkpoint"
npx arcanea-flow session restore <sessionId>
npx arcanea-flow session delete <sessionId>
npx arcanea-flow session export --include-memory
npx arcanea-flow session import <file>

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/session.ts
export const sessionCommand = {
  command: 'session',
  description: 'Manage Claude-Flow sessions',
  subcommands: [
    { command: 'list', options: [{ flags: '-a, --active' }] },
    { command: 'save', options: [{ flags: '-d, --description <desc>' }] },
    { command: 'restore', args: '<sessionId>' },
    { command: 'delete', args: '<sessionId>' },
    { command: 'export', options: [{ flags: '--include-memory' }] },
    { command: 'import', args: '<file>' }
  ]
};
```

### Priority 2 - MEDIUM

#### hive
```bash
# V2
npx arcanea-flow hive --topology mesh --consensus quorum --max-agents 8
npx arcanea-flow hive-mind init
npx arcanea-flow hive-mind status
npx arcanea-flow hive-mind spawn --type queen
npx arcanea-flow hive-mind task --description "Task"
npx arcanea-flow hive-mind wizard
npx arcanea-flow hive-mind pause
npx arcanea-flow hive-mind resume
npx arcanea-flow hive-mind stop

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/hive.ts
export const hiveCommand = {
  command: 'hive',
  description: 'Hive Mind multi-agent coordination',
  options: [
    { flags: '--topology <type>', description: 'Topology: mesh, hierarchical, ring, star' },
    { flags: '--consensus <type>', description: 'Consensus: quorum, unanimous, weighted' },
    { flags: '--max-agents <n>', description: 'Maximum agents' }
  ],
  subcommands: [
    { command: 'init' },
    { command: 'status' },
    { command: 'spawn', options: [{ flags: '-t, --type <type>' }] },
    { command: 'task', options: [{ flags: '-d, --description <desc>' }] },
    { command: 'wizard' },
    { command: 'pause' },
    { command: 'resume' },
    { command: 'stop' }
  ]
};
```

#### sparc
```bash
# V2
npx arcanea-flow sparc modes
npx arcanea-flow sparc info <mode>
npx arcanea-flow sparc run --mode specification
npx arcanea-flow sparc tdd --sequential
npx arcanea-flow sparc workflow --dry-run

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/sparc.ts
export const sparcCommand = {
  command: 'sparc',
  description: 'SPARC methodology commands',
  subcommands: [
    { command: 'modes', description: 'List SPARC modes' },
    { command: 'info', args: '<mode>' },
    { command: 'run', options: [{ flags: '-m, --mode <mode>' }] },
    { command: 'tdd', options: [{ flags: '--sequential' }] },
    { command: 'workflow', options: [{ flags: '--dry-run' }] }
  ]
};
```

#### monitor
```bash
# V2
npx arcanea-flow monitor
npx arcanea-flow monitor --interval 2
npx arcanea-flow monitor --compact
npx arcanea-flow monitor --focus agents

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/monitor.ts
export const monitorCommand = {
  command: 'monitor',
  description: 'Start live monitoring dashboard',
  options: [
    { flags: '-i, --interval <seconds>', description: 'Update interval' },
    { flags: '-c, --compact', description: 'Compact view' },
    { flags: '--focus <component>', description: 'Focus on component' }
  ],
  action: async (options) => {
    const dashboard = createDashboard(options);
    await dashboard.start();
  }
};
```

#### github
```bash
# V2
npx arcanea-flow github init
npx arcanea-flow github gh-coordinator
npx arcanea-flow github pr-manager
npx arcanea-flow github issue-tracker
npx arcanea-flow github release-manager
npx arcanea-flow github repo-architect
npx arcanea-flow github sync-coordinator

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/github.ts
export const githubCommand = {
  command: 'github',
  description: 'GitHub workflow automation',
  subcommands: [
    { command: 'init' },
    { command: 'gh-coordinator' },
    { command: 'pr-manager' },
    { command: 'issue-tracker' },
    { command: 'release-manager' },
    { command: 'repo-architect' },
    { command: 'sync-coordinator' }
  ],
  options: [
    { flags: '--auto-approve', description: 'Auto-approve permissions' },
    { flags: '--dry-run', description: 'Preview only' }
  ]
};
```

### Priority 3 - LOW

#### neural
```bash
# V2
npx arcanea-flow neural init
npx arcanea-flow neural init --force --target .claude/agents/neural

# V3: Replaced by hooks pretrain
npx arcanea-flow hooks pretrain
```

#### goal
```bash
# V2
npx arcanea-flow goal init

# V3: Replaced by hooks system
npx arcanea-flow hooks pretrain --include-goap
```

#### claude
```bash
# V2
npx arcanea-flow claude spawn --tools View,Edit,Bash --mode full

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/claude.ts
export const claudeCommand = {
  command: 'claude',
  description: 'Spawn Claude instances',
  subcommands: [
    {
      command: 'spawn',
      options: [
        { flags: '-t, --tools <tools>', description: 'Allowed tools' },
        { flags: '-m, --mode <mode>', description: 'Dev mode' },
        { flags: '--parallel', description: 'Enable parallel execution' }
      ]
    }
  ]
};
```

#### workflow
```bash
# V2
npx arcanea-flow workflow create --name "my-workflow"
npx arcanea-flow workflow execute <workflow>
npx arcanea-flow workflow list

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/workflow.ts
```

#### repl
```bash
# V2
npx arcanea-flow repl

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/repl.ts
export const replCommand = {
  command: 'repl',
  description: 'Start interactive REPL mode',
  action: async () => {
    const rl = createInterface({ input: stdin, output: stdout });
    // REPL loop
  }
};
```

#### version
```bash
# V2
npx arcanea-flow version
npx arcanea-flow version --short

# V3 Migration needed:
# Add version flag to CLI root
```

#### completion
```bash
# V2
npx arcanea-flow completion bash
npx arcanea-flow completion --install

# V3 Migration needed:
# Add to v3/@arcanea-flow/cli/src/commands/completion.ts
```

## Implementation Plan

### Phase 1 (Week 1-2): Core Commands
1. `init` - Project initialization
2. `start` - System startup
3. `status` - System status
4. `task` - Task management
5. `session` - Session management

### Phase 2 (Week 3-4): Feature Commands
1. `hive` - Hive-mind mode
2. `sparc` - SPARC methodology
3. `monitor` - Live dashboard
4. `github` - GitHub integration

### Phase 3 (Week 5-6): Utilities
1. `workflow` - Workflow management
2. `claude` - Claude spawning
3. `repl` - Interactive mode
4. `version` - Version info
5. `completion` - Shell completion
