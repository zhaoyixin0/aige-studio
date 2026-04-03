/**
 * Build-time script: generates src/data/parameter-data.ts from Excel.
 *
 * Usage:
 *   npx tsx tools/registry/import-excel.ts <path-to-xlsx>
 */

import XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDependencyName } from '../../src/utils/registry-match';

// ---------------------------------------------------------------------------
// Column mappings
// ---------------------------------------------------------------------------

const GAME_TYPE_MAP: Record<string, string> = {
  '接住游戏': 'catch',
  '躲避游戏': 'dodge',
  '点击游戏': 'tap',
  '射击游戏': 'shooting',
  '答题游戏': 'quiz',
  '幸运转盘': 'random-wheel',
  '表情挑战': 'expression',
  '跑酷游戏': 'runner',
  '节奏游戏': 'rhythm',
  '平台跳跃': 'platformer',
  '赛车游戏': 'racing',
};

const CATEGORY_MAP: Record<string, string> = {
  '-': 'abstract',
  '游戏机制': 'game_mechanics',
  '游戏对象': 'game_objects',
  '视觉音效': 'visual_audio',
};

const EXPOSURE_MAP: Record<string, string> = {
  '组合映射': 'composite',
  '直接暴露': 'direct',
  '不暴露': 'hidden',
};

const CONTROL_TYPE_MAP: Record<string, string> = {
  'Toggle': 'toggle',
  'Slider': 'slider',
  'Segmented': 'segmented',
  'Stepper': 'stepper',
  'Asset Picker': 'asset_picker',
  'InputField': 'input_field',
};

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

function parseDefaultValue(
  raw: unknown,
  controlType: string,
): string | number | boolean {
  if (raw === undefined || raw === null || raw === '') return '';

  const str = String(raw).trim();

  // Toggle boolean mapping
  if (controlType === 'toggle') {
    if (str === '开启') return true;
    if (str === '关闭') return false;
    // "显示" / "隐藏" pattern for visual toggles
    if (str === '显示') return true;
    if (str === '隐藏') return false;
  }

  // Try numeric
  const num = Number(str);
  if (!Number.isNaN(num) && str !== '') return num;

  return str;
}

function parseGameTypes(raw: unknown): readonly string[] {
  if (raw === undefined || raw === null || raw === '') return ['ALL'];
  const str = String(raw).trim();
  if (str === 'ALL' || str === '全部') return ['ALL'];

  const parts = str.split(/[、,，\/]/).map((s) => s.trim()).filter(Boolean);
  const mapped = parts.map((p) => GAME_TYPE_MAP[p] ?? p);
  return mapped;
}

function parseOptions(raw: unknown): readonly string[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const str = String(raw).trim();
  if (!str) return undefined;
  return str.split(/[\/]/).map((s) => s.trim()).filter(Boolean);
}

function parseLayer(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (str === 'L1' || str === 'L2' || str === 'L3') return str;
  return 'L2'; // fallback
}

// ---------------------------------------------------------------------------
// Row interface
// ---------------------------------------------------------------------------

interface RawRow {
  name: string;
  gameTypes: readonly string[];
  category: string;
  mvp: string;
  exposure: string;
  options: readonly string[] | undefined;
  controlType: string;
  hasDependency: string;
  defaultValue: string | number | boolean;
  dependsOnParamName: string;
  dependsOnCondition: string;
  layer: string;
  associatedL1: string;
  description: string;
}

interface ParameterEntry {
  id: string;
  name: string;
  layer: string;
  category: string;
  mvp: string;
  exposure: string;
  controlType: string;
  gameTypes: readonly string[];
  defaultValue: string | number | boolean;
  options?: readonly string[];
  dependsOn?: { paramId: string; condition: string };
  associatedL1?: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const excelPath =
    process.argv[2];
  if (!excelPath) {
    process.stderr.write(
      'Usage: npx tsx tools/registry/import-excel.ts <path-to-xlsx>\n'
    );
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header row
  const dataRows = rows.slice(1).filter((row) => {
    // Skip empty rows
    return row.length > 0 && row[0] !== undefined && String(row[0]).trim() !== '';
  });

  // Phase 1: Parse all rows
  const rawRows: RawRow[] = dataRows.map((row) => ({
    name: String(row[0] ?? '').trim(),
    gameTypes: parseGameTypes(row[1]),
    category: CATEGORY_MAP[String(row[2] ?? '-').trim()] ?? 'game_mechanics',
    mvp: String(row[3] ?? 'P0').trim(),
    exposure: EXPOSURE_MAP[String(row[4] ?? '').trim()] ?? 'direct',
    options: parseOptions(row[5]),
    controlType:
      CONTROL_TYPE_MAP[String(row[6] ?? '').trim()] ?? 'segmented',
    hasDependency: String(row[7] ?? '').trim(),
    defaultValue: parseDefaultValue(
      row[8],
      CONTROL_TYPE_MAP[String(row[6] ?? '').trim()] ?? 'segmented',
    ),
    dependsOnParamName: String(row[9] ?? '').trim(),
    dependsOnCondition: String(row[10] ?? '').trim(),
    layer: parseLayer(row[11]),
    associatedL1: String(row[12] ?? '').trim(),
    description: String(row[13] ?? '').trim(),
  }));

  // Phase 2: Assign IDs (sequential per category)
  const categoryCounters: Record<string, number> = {};
  const entries: ParameterEntry[] = [];
  const nameToId = new Map<string, string>();

  for (const raw of rawRows) {
    const prefix =
      raw.category === 'abstract' ? 'l1' : raw.category;
    categoryCounters[prefix] = (categoryCounters[prefix] ?? 0) + 1;
    const seq = String(categoryCounters[prefix]).padStart(3, '0');
    const id = `${prefix}_${seq}`;

    nameToId.set(raw.name, id);

    entries.push({
      id,
      name: raw.name,
      layer: raw.layer,
      category: raw.category,
      mvp: raw.mvp,
      exposure: raw.exposure,
      controlType: raw.controlType,
      gameTypes: raw.gameTypes,
      defaultValue: raw.defaultValue,
      options: raw.options,
      associatedL1: raw.associatedL1 || undefined,
      description: raw.description,
    });
  }

  // Phase 3: Resolve dependencies (conservative match — no substring/includes)
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const depName = raw.dependsOnParamName;
    const depCondition = raw.dependsOnCondition;

    if (!depName || depName === '-' || depName === '无') continue;

    const rowNum = i + 2; // +1 for 0-index, +1 for header row
    const { id: paramId, ambiguity } = resolveDependencyName(nameToId, depName);

    if (!paramId) {
      process.stderr.write(
        `WARN: Row ${rowNum} param "${depName}" — no match found for dependency, skipping${ambiguity ? ` (${ambiguity})` : ''}\n`,
      );
      continue;
    }

    if (depCondition && depCondition !== '-') {
      entries[i].dependsOn = { paramId, condition: depCondition };
    }
  }

  // Phase 4: Generate output
  const lines: string[] = [];
  lines.push(
    '// Auto-generated from Game Parameters.xlsx — DO NOT EDIT MANUALLY',
  );
  lines.push('// Re-generate with: npm run gen:registry');
  lines.push("import type { ParameterMeta } from './parameter-registry';");
  lines.push('');
  lines.push('export const PARAMETER_DATA: readonly ParameterMeta[] = [');

  for (const entry of entries) {
    const parts: string[] = [];
    parts.push(`id: ${JSON.stringify(entry.id)}`);
    parts.push(`name: ${JSON.stringify(entry.name)}`);
    parts.push(`layer: ${JSON.stringify(entry.layer)}`);
    parts.push(`category: ${JSON.stringify(entry.category)}`);
    parts.push(`mvp: ${JSON.stringify(entry.mvp)}`);
    parts.push(`exposure: ${JSON.stringify(entry.exposure)}`);
    parts.push(`controlType: ${JSON.stringify(entry.controlType)}`);
    parts.push(`gameTypes: ${JSON.stringify(entry.gameTypes)}`);
    parts.push(`defaultValue: ${JSON.stringify(entry.defaultValue)}`);

    if (entry.options !== undefined) {
      parts.push(`options: ${JSON.stringify(entry.options)}`);
    }

    if (entry.dependsOn !== undefined) {
      parts.push(
        `dependsOn: ${JSON.stringify(entry.dependsOn)}`,
      );
    }

    if (entry.associatedL1 !== undefined) {
      parts.push(`associatedL1: ${JSON.stringify(entry.associatedL1)}`);
    }

    parts.push(`description: ${JSON.stringify(entry.description)}`);

    lines.push(`  { ${parts.join(', ')} },`);
  }

  lines.push('] as const;');
  lines.push('');

  const outputPath = resolve(
    import.meta.dirname ?? process.cwd(),
    '../../src/data/parameter-data.ts',
  );
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  // Use stderr for diagnostics so stdout stays clean
  process.stderr.write(
    `Generated ${entries.length} parameters → ${outputPath}\n`,
  );
}

main();
