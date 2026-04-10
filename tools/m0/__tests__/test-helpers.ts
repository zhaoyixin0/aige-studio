/**
 * Shared test helpers for m0/m5 offline pipeline tests.
 *
 * These pipelines transform a private expert-data corpus (80+ Effect House
 * JSON files) into knowledge cards / presets. The corpus is NOT checked in,
 * so tests that need it are conditionally skipped when the directory is
 * missing. Developers with a local copy can opt in via env vars.
 *
 * ## Opt-in for local runs
 *
 * ```bash
 * # Windows (cmd)
 * set EXPERT_DATA_ROOT=C:\expert-data\json
 * set RUN_OFFLINE_PIPELINE_TESTS=1
 * npx vitest run tools/m0 tools/m5
 *
 * # Unix
 * EXPERT_DATA_ROOT=/path/to/expert-data/json \
 *   RUN_OFFLINE_PIPELINE_TESTS=1 \
 *   npx vitest run tools/m0 tools/m5
 * ```
 *
 * If `EXPERT_DATA_ROOT` is unset, the helper falls back to the historic
 * repo-relative path (`<repoRoot>/../expert-data/json`). When neither path
 * resolves to an existing directory with JSON files, affected `describe`
 * blocks are skipped (reported as skipped, not failing).
 */
import * as fs from 'fs';
import * as path from 'path';

const HELPER_DIR = __dirname;
const DEFAULT_REPO_RELATIVE = path.resolve(HELPER_DIR, '../../../../expert-data/json');

/**
 * Resolve the expert-data JSON directory.
 * Precedence: EXPERT_DATA_ROOT env var > repo-relative default.
 */
export function resolveExpertDataDir(): string {
  const fromEnv = process.env.EXPERT_DATA_ROOT;
  if (fromEnv && fromEnv.trim().length > 0) {
    return path.resolve(fromEnv);
  }
  return DEFAULT_REPO_RELATIVE;
}

/**
 * True when the configured expert-data directory exists and is a directory.
 * Accepts a single path or an array; all must exist.
 */
export function hasExpertData(pathOrPaths?: string | string[]): boolean {
  const paths = pathOrPaths === undefined
    ? [resolveExpertDataDir()]
    : Array.isArray(pathOrPaths)
      ? pathOrPaths
      : [pathOrPaths];
  for (const p of paths) {
    try {
      const stat = fs.statSync(p);
      if (!stat.isDirectory()) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Primary gate used by test files: returns true when offline pipeline tests
 * should run. Requires the data directory to exist. The RUN_OFFLINE_PIPELINE_TESTS
 * env var is informational — when it is set AND the data dir is missing we still
 * skip (no point crashing), but we log a helpful warning via the runner.
 */
export function canRunOfflinePipelineTests(): boolean {
  return hasExpertData();
}

/**
 * Absolute path to the expert-data directory. Use this in tests rather than
 * hardcoding paths.
 */
export const EXPERT_DATA_DIR = resolveExpertDataDir();
