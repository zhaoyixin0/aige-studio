// tools/m5/cli.ts
// CLI pipeline: read expert JSONs → classify → build IR → synthesize → validate → output.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectFormat } from './detector.ts';
import { buildIR } from './ir-builder.ts';
import { synthesize } from './synthesizer.ts';
import type { ExpertFormat } from './types.ts';
import type { PresetTemplate } from '@/engine/systems/recipe-runner/types.ts';

export interface IndexEntry {
  readonly source: string;
  readonly presetId: string;
  readonly gameType: string;
  readonly confidence: number;
}

export interface PipelineResult {
  readonly totalFiles: number;
  readonly classified: {
    readonly knowledge: number;
    readonly sequence: number;
    readonly utility: number;
  };
  readonly presets: readonly PresetTemplate[];
  readonly index: readonly IndexEntry[];
  readonly skippedUtility: number;
}

/**
 * Run the full M5 expert data ingest pipeline.
 * Reads all .json files from the given directory, classifies them,
 * builds IRs, synthesizes presets, and returns the results.
 */
export function runPipeline(inputDir: string): PipelineResult {
  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith('.json'));
  const counts: Record<ExpertFormat, number> = { knowledge: 0, sequence: 0, utility: 0 };
  const presets: PresetTemplate[] = [];
  const index: IndexEntry[] = [];
  let skippedUtility = 0;

  for (const filename of files) {
    const filePath = path.join(inputDir, filename);
    const raw = fs.readFileSync(filePath, 'utf-8');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      counts.utility++;
      skippedUtility++;
      continue;
    }

    const format = detectFormat(data);
    counts[format]++;

    if (format === 'utility') {
      skippedUtility++;
      continue;
    }

    const ir = buildIR(filename, data);
    if (!ir) {
      skippedUtility++;
      continue;
    }

    const preset = synthesize(ir);
    presets.push(preset);

    const confTag = preset.tags.find((t) => t.startsWith('confidence:'));
    const confidence = confTag ? parseFloat(confTag.split(':')[1]) : 0;

    index.push({
      source: filename,
      presetId: preset.id,
      gameType: preset.gameType ?? 'unknown',
      confidence,
    });
  }

  return {
    totalFiles: files.length,
    classified: counts,
    presets,
    index,
    skippedUtility,
  };
}

/**
 * Write pipeline results to disk.
 */
export function writePipelineOutput(
  result: PipelineResult,
  outputDir: string,
): void {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const preset of result.presets) {
    const filename = `${preset.id}.preset.json`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(preset, null, 2), 'utf-8');
  }

  const indexPath = path.join(outputDir, 'expert-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(result.index, null, 2), 'utf-8');
}

// CLI entry point
if (process.argv[1] && process.argv[1].includes('cli')) {
  const inputDir = process.argv[2] ?? path.resolve(__dirname, '../../../../expert-data/json');
  const outputDir = process.argv[3] ?? 'src/knowledge/recipes-runner/experts';

  const result = runPipeline(inputDir);

  console.log(`Processed ${result.totalFiles} files:`);
  console.log(`  Knowledge: ${result.classified.knowledge}`);
  console.log(`  Sequence:  ${result.classified.sequence}`);
  console.log(`  Utility:   ${result.classified.utility} (skipped)`);
  console.log(`  Presets generated: ${result.presets.length}`);

  const drafts = result.presets.filter((p) => p.tags.includes('draft'));
  console.log(`  Draft (confidence < 0.6): ${drafts.length}`);
  console.log(`  Production-ready: ${result.presets.length - drafts.length}`);

  writePipelineOutput(result, outputDir);
  console.log(`\nOutput written to ${outputDir}/`);
}
