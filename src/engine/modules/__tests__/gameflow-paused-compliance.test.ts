import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULES_DIR = join(process.cwd(), 'src/engine/modules');

// Modules intentionally exempt — explicit no-ops or event-driven modules
// where update() is a stub or doesn't drive any per-frame state.
const ALLOWLIST = new Set<string>([
  'feedback/game-flow.ts',
  'feedback/result-screen.ts',
  'feedback/sound-fx.ts',
  'mechanic/branch-state-machine.ts',
  'mechanic/checkpoint.ts',
  'mechanic/dialogue-system.ts',
  'mechanic/dress-up-engine.ts',
  'mechanic/enemy-drop.ts',
  'mechanic/equipment-slot.ts',
  'mechanic/health.ts',
  'mechanic/inventory.ts',
  'mechanic/lives.ts',
  'mechanic/match-engine.ts',
  'mechanic/static-platform.ts',
]);

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'base-module.ts') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

function hasGameflowPausedCheck(content: string): boolean {
  // Find update() method definition (signature like: update(dt: number) or update(_dt: number))
  const updateMatch = content.match(/\bupdate\s*\(\s*[_a-zA-Z0-9]*\s*:\s*number\s*\)\s*:\s*void\s*\{([\s\S]*?)\n\s{2}\}/);
  if (!updateMatch) return false;

  // Check the first ~25 lines of the method body for gameflowPaused
  const body = updateMatch[1].split('\n').slice(0, 25).join('\n');
  return /this\.gameflowPaused/.test(body);
}

function hasUpdateMethod(content: string): boolean {
  return /\bupdate\s*\(\s*[_a-zA-Z0-9]*\s*:\s*number\s*\)\s*:\s*void/.test(content);
}

describe('gameflowPaused compliance audit', () => {
  it('all non-allowlisted modules with update() include gameflowPaused check', () => {
    const files = findTsFiles(MODULES_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(MODULES_DIR, file).replace(/\\/g, '/');
      if (ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, 'utf-8');
      if (!hasUpdateMethod(content)) continue;

      if (!hasGameflowPausedCheck(content)) {
        violations.push(rel);
      }
    }

    expect(
      violations,
      `Modules missing gameflowPaused check (add to ALLOWLIST or add 'if (this.gameflowPaused) return;' to update()):\n  ${violations.join('\n  ')}`,
    ).toEqual([]);
  });

  it('ALLOWLIST entries all exist as files', () => {
    for (const allowed of ALLOWLIST) {
      const filePath = join(MODULES_DIR, allowed);
      expect(() => statSync(filePath), `Allowlist entry ${allowed} should exist`).not.toThrow();
    }
  });
});
