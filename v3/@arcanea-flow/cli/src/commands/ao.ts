/**
 * Arcanea Orchestrator bridge command.
 * Delegates worktree-centric execution flows from Arcanea Flow to ao.
 */

import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import type { Command, CommandContext, CommandResult } from '../types.js';
import { output } from '../output.js';

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
  ],
  examples: [
    { command: 'arcanea-flow ao status', description: 'Show Arcanea Orchestrator session status' },
    { command: 'arcanea-flow ao start arcanea-code', description: 'Start ao against the arcanea-code project' },
    { command: 'arcanea-flow ao spawn 123', description: 'Hand off issue 123 spawning to ao' },
  ],
  action: async (ctx: CommandContext): Promise<CommandResult> => {
    const args = ctx.args.length > 0 ? ctx.args : ['--help'];
    const aoEntry = resolveAoEntry(ctx.cwd);

    if (!aoEntry) {
      output.printError('Arcanea Orchestrator is not available.');
      output.writeln(output.dim('Expected a built ao entrypoint at ~/Arcanea/arcanea-orchestrator/packages/cli/dist/index.js'));
      output.writeln(output.dim('Build it with: pnpm --dir ~/Arcanea/arcanea-orchestrator run build:bootstrap'));
      return { success: false, exitCode: 1 };
    }

    const commandPreview = `node ${aoEntry} ${args.join(' ')}`.trim();
    const dryRun = (ctx.flags['dry-run'] || ctx.flags.dryRun) as boolean;
    if (dryRun) {
      output.printInfo(`Would run: ${commandPreview}`);
      return { success: true, data: { command: commandPreview, aoEntry } };
    }

    output.printInfo(`Delegating to Arcanea Orchestrator: ${args.join(' ')}`);

    const child = spawnSync(process.execPath, [aoEntry, ...args], {
      cwd: ctx.cwd,
      stdio: 'inherit',
      env: { ...process.env },
      windowsHide: true,
    });

    return {
      success: (child.status ?? 1) === 0,
      exitCode: child.status ?? 1,
      data: { aoEntry, delegatedArgs: args },
    };
  },
};

export default aoCommand;
