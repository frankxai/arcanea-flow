/**
 * Arcanea Orchestrator bridge command.
 * Delegates worktree-centric execution flows from Arcanea Flow to ao.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

type FlowAoRunMode = 'dry-run' | 'delegated';

type FlowAoTrace = {
  schemaVersion: 1;
  kind: 'arcanea-flow.ao-run';
  runId: string;
  timestamp: string;
  finishedAt: string;
  durationMs: number;
  mode: FlowAoRunMode;
  repo: {
    id: string;
    path: string;
  };
  ao: {
    entry: string;
    args: string[];
    commandPreview: string;
  };
  execution: {
    ok: boolean;
    exitCode: number;
  };
  output?: {
    stdout: string;
    stderr: string;
  };
};

function getAoEntryCandidates(cwd: string): string[] {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const here = dirname(fileURLToPath(import.meta.url));

  return [
    process.env.ARCANEA_ORCHESTRATOR_ENTRY || '',
    resolve(cwd, '..', 'arcanea-orchestrator', 'packages', 'cli', 'dist', 'index.js'),
    resolve(cwd, '..', '..', 'arcanea-orchestrator', 'packages', 'cli', 'dist', 'index.js'),
    join(home, 'Arcanea', 'arcanea-orchestrator', 'packages', 'cli', 'dist', 'index.js'),
    resolve(here, '..', '..', '..', '..', '..', '..', 'arcanea-orchestrator', 'packages', 'cli', 'dist', 'index.js'),
  ].filter(Boolean);
}

function resolveAoEntry(cwd: string): string | null {
  for (const candidate of getAoEntryCandidates(cwd)) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function getArcaneaRoot(cwd: string): string {
  const explicit = process.env.ARCANEA_HOME || process.env.ARCANEA_ROOT;
  if (explicit) return explicit;

  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) {
    return join(home, 'Arcanea');
  }

  return cwd;
}

function getTracePath(cwd: string): string {
  const root = getArcaneaRoot(cwd);
  return join(root, '.arcanea', 'runtime', 'flow-runs.jsonl');
}

function ensureTraceDir(tracePath: string): void {
  mkdirSync(dirname(tracePath), { recursive: true });
}

function summarize(value: string): string {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0) || '';
}

function inferRepoId(cwd: string): string {
  return basename(cwd) || 'unknown-repo';
}

function writeTrace(tracePath: string, trace: FlowAoTrace): void {
  ensureTraceDir(tracePath);
  appendFileSync(tracePath, `${JSON.stringify(trace)}\n`, 'utf8');
}

function emitJson(trace: FlowAoTrace): void {
  process.stdout.write(`${JSON.stringify(trace, null, 2)}\n`);
}

export const aoCommand: Command = {
  name: 'ao',
  aliases: ['bridge', 'delegate'],
  description: 'Delegate worktree-heavy multi-agent execution to Arcanea Orchestrator',
  options: [
    {
      name: 'dry-run',
      description: 'Show the ao command that would run without executing it',
      type: 'boolean',
      default: false,
    },
    {
      name: 'json',
      description: 'Emit a machine-readable Arcanea Flow run envelope',
      type: 'boolean',
      default: false,
    },
  ],
  examples: [
    { command: 'arcanea-flow ao status', description: 'Show Arcanea Orchestrator session status' },
    { command: 'arcanea-flow ao start arcanea-code', description: 'Start ao against the arcanea-code project' },
    { command: 'arcanea-flow ao --json status', description: 'Emit machine-readable status delegation output' },
    { command: 'arcanea-flow ao spawn 123', description: 'Hand off issue 123 spawning to ao' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const startedAt = Date.now();
    const args = ctx.args.length > 0 ? ctx.args : ['--help'];
    const aoEntry = resolveAoEntry(ctx.cwd);
    const wantsJson = Boolean(ctx.flags.json);
    const tracePath = getTracePath(ctx.cwd);

    if (!aoEntry) {
      const errorTrace: FlowAoTrace = {
        schemaVersion: 1,
        kind: 'arcanea-flow.ao-run',
        runId: randomUUID(),
        timestamp: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        mode: 'delegated',
        repo: {
          id: inferRepoId(ctx.cwd),
          path: ctx.cwd,
        },
        ao: {
          entry: '',
          args,
          commandPreview: 'ao entrypoint unavailable',
        },
        execution: {
          ok: false,
          exitCode: 1,
        },
        output: {
          stdout: '',
          stderr: 'Arcanea Orchestrator is not available.',
        },
      };
      writeTrace(tracePath, errorTrace);
      if (wantsJson) {
        emitJson(errorTrace);
      } else {
        output.printError('Arcanea Orchestrator is not available.');
        output.writeln(output.dim('Expected a built ao entrypoint at ~/Arcanea/arcanea-orchestrator/packages/cli/dist/index.js'));
        output.writeln(output.dim('Build it with: pnpm --dir ~/Arcanea/arcanea-orchestrator run build:bootstrap'));
      }
      return { success: false, exitCode: 1 };
    }

    const commandPreview = `node ${aoEntry} ${args.join(' ')}`.trim();
    const dryRun = (ctx.flags['dry-run'] || ctx.flags.dryRun) as boolean;
    const runId = randomUUID();
    if (dryRun) {
      const trace: FlowAoTrace = {
        schemaVersion: 1,
        kind: 'arcanea-flow.ao-run',
        runId,
        timestamp: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        mode: 'dry-run',
        repo: {
          id: inferRepoId(ctx.cwd),
          path: ctx.cwd,
        },
        ao: {
          entry: aoEntry,
          args,
          commandPreview,
        },
        execution: {
          ok: true,
          exitCode: 0,
        },
      };
      writeTrace(tracePath, trace);
      if (wantsJson) {
        emitJson(trace);
      } else {
        output.printInfo(`Would run: ${commandPreview}`);
      }
      return { success: true, data: trace };
    }

    if (!wantsJson) {
      output.printInfo(`Delegating to Arcanea Orchestrator: ${args.join(' ')}`);
    }

    const child = spawnSync(process.execPath, [aoEntry, ...args], {
      cwd: ctx.cwd,
      stdio: wantsJson ? 'pipe' : 'inherit',
      encoding: wantsJson ? 'utf8' : undefined,
      env: { ...process.env },
      windowsHide: true,
    });

    const trace: FlowAoTrace = {
      schemaVersion: 1,
      kind: 'arcanea-flow.ao-run',
      runId,
      timestamp: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      mode: 'delegated',
      repo: {
        id: inferRepoId(ctx.cwd),
        path: ctx.cwd,
      },
      ao: {
        entry: aoEntry,
        args,
        commandPreview,
      },
      execution: {
        ok: (child.status ?? 1) === 0,
        exitCode: child.status ?? 1,
      },
      output: wantsJson
        ? {
            stdout: summarize(String(child.stdout || '')),
            stderr: summarize(String(child.stderr || '')),
          }
        : undefined,
    };

    writeTrace(tracePath, trace);

    if (wantsJson) {
      emitJson(trace);
    }

    return {
      success: (child.status ?? 1) === 0,
      exitCode: child.status ?? 1,
      data: trace,
    };
  },
};

export default aoCommand;
