# Arcanea Ecosystem: Project Comparison

Three projects, three layers of the same vision — each solving a different problem in the Arcanea ecosystem.

## At a Glance

| Dimension | arcanea-flow | Claude-Arcanea | oh-my-arcanea |
|-----------|-------------|----------------|---------------|
| **Role** | Orchestration engine | Creative platform | Coding overlay |
| **Runtime** | Node.js 20+ | Node.js (Next.js 16) | Bun |
| **Scope** | Agent infra & coordination | Full-stack creative OS | Lightweight plugin/overlay |
| **Agents** | 54+ generic agent types | 38 creative-focused agents | 11 specialized agents |
| **Guardian integration** | Via swarm topology | Core identity (Ten Gates) | Guardian routing (10 Guardians) |
| **Primary user** | Platform builders | Creative universe builders | Developers in active sessions |
| **Status** | v1.0.0-alpha.1 | Active development | 161 releases, 2,961 commits |

## arcanea-flow

**Multi-agent swarm orchestration with Guardian intelligence.**

arcanea-flow is the coordination backbone. It provides the infrastructure for deploying, routing, and managing teams of AI agents working together on complex tasks.

### Key Characteristics

- **Monorepo** with 6 npm workspaces: `cli`, `shared`, `swarm`, `mcp`, `aidefence`, `embeddings`
- **26 CLI commands** with 140+ subcommands for agent lifecycle, swarm coordination, memory search, security scanning, and performance benchmarking
- **Swarm topologies**: hierarchical, mesh, ring, star, adaptive
- **Consensus protocols**: Raft, Byzantine fault tolerance, Gossip, CRDT
- **Memory**: Hybrid backend (SQLite + AgentDB) with HNSW-indexed vector search (150x-12,500x faster)
- **Intelligence**: RuVector layer with SONA self-optimizing neural architecture, Flash Attention, EWC++
- **Security**: Input validation (Zod), path traversal prevention, CVE remediation, AIDefence module

### Tech Stack

- TypeScript 5.0+, Node.js >=20, ES Modules
- agentdb, agentic-flow, @ruvector/sona, @ruvector/attention
- Vitest for testing
- MCP (Model Context Protocol) server integration

### When to Use

When you need the **infrastructure** to coordinate multiple AI agents at scale — swarm topologies, consensus, memory, and orchestration primitives.

---

## Claude-Arcanea (frankxai/arcanea)

**The creative civilization OS for creators who build universes.**

Claude-Arcanea is the main Arcanea platform — the creative vision that gives meaning to the entire ecosystem. It maps creativity to a mythological framework of Guardians, Godbeasts, and Ten Gates.

### Key Characteristics

- **Next.js 16 web application** with pnpm monorepo
- **77 AI skills** across creative domains
- **38 specialized agents** tuned for creative workflows
- **17 collections** of creative methodology and library content
- **MCP server** with 30+ tools for creative intelligence
- **arcanea-intelligence-os** package for AI orchestration
- **Ten Gates / Guardians / Godbeasts** mythology as the organizing framework

### Philosophy

> "Creativity is a practice, not a talent. It can be developed systematically."

Arcanea treats creative development as a structured discipline — Soulbook transformation, music production, storytelling, and conscious creator tools all live here.

### When to Use

When you want the **full creative platform** — the web UI, the mythology, the skills library, and the creative intelligence tools.

---

## oh-my-arcanea (frankxai/oh-my-arcanea)

**Arcanea overlay for oh-my-opencode — Guardian routing, hooks, and swarm-ready coding workflows.**

oh-my-arcanea is the bridge. It brings Arcanea's Guardian conventions into existing coding sessions without requiring developers to migrate their entire workflow. Built on top of oh-my-opencode.

### Key Characteristics

- **Bun runtime** (not Node.js) with TypeScript
- **10 Guardian routing system** mapping supernatural Guardians to development domains:
  - Lyssandria (Earth) — Architecture
  - Leyla (Water) — Creative workflow (default)
  - Draconia (Fire) — Testing & transformation
  - Maylinn (Heart) — User experience
  - Alera (Voice) — Documentation
  - Lyria (Sight) — Design & vision
  - Aiyami (Crown) — Performance optimization
  - Elara (Starweave) — Code refactoring
  - Ino (Unity) — Team collaboration
  - Shinkami (Void) — System orchestration
- **44 lifecycle hooks** across 39 directories
- **11 agents**: Sisyphus (automated workflows), Oracle (decision support), Atlas (system mapping), Prometheus (monitoring), and more
- **26 tools** distributed across 15 directories
- **3 built-in remote MCPs**: websearch, context7, grep_app
- **Plugin architecture** with OpenCode SDK integration

### When to Use

When you want **Arcanea conventions in your daily coding** — Guardian-based task routing, hooks, and agent workflows — without leaving your existing editor setup.

---

## How They Relate

```
Claude-Arcanea (arcanea)          — the creative vision and platform
        |
        |  uses
        v
arcanea-flow                      — the orchestration engine
        |
        |  powers
        v
oh-my-arcanea                     — the developer coding overlay
```

- **Claude-Arcanea** is the *what* and *why* — the creative intelligence platform with its mythology, skills, and agents
- **arcanea-flow** is the *how* — the infrastructure for agent coordination, swarm management, and distributed intelligence
- **oh-my-arcanea** is the *daily driver* — the lightweight overlay that brings it all into active coding sessions

### Choosing Between Them

| You want to... | Use |
|----------------|-----|
| Build or extend the Arcanea creative platform | Claude-Arcanea |
| Orchestrate multi-agent swarms with advanced coordination | arcanea-flow |
| Add Arcanea conventions to your coding workflow | oh-my-arcanea |
| All three together | Claude-Arcanea as the platform, arcanea-flow as the engine, oh-my-arcanea as the daily interface |
