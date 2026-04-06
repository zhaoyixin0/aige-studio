import type { ParameterMeta } from '@/data/parameter-registry';
import type { GuiParamCardProps } from '@/ui/chat/gui-param-card';
import { ParamRow, TombstoneCard, categoryLabel } from '@/ui/chat/gui-param-card';
import { CardShell, Section } from './card-shell';
import { useResolvedParams } from './use-resolved-params';

/* ------------------------------------------------------------------ */
/*  Sub-group definitions                                              */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { title: '核心规则', ids: ['game_mechanics_001', 'game_mechanics_002', 'game_mechanics_003'] },
  { title: '移动与物理', ids: ['game_mechanics_008', 'game_mechanics_011', 'game_mechanics_014', 'game_mechanics_016'] },
  { title: '生成与难度', ids: ['game_mechanics_005', 'game_mechanics_006', 'game_mechanics_007'] },
] as const;

const KNOWN_IDS: ReadonlySet<string> = new Set(SECTIONS.flatMap((s) => s.ids));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GameMechanicsCard({
  category,
  paramIds,
  title,
  isActive,
  values = {},
  onParamChange,
}: GuiParamCardProps) {
  const { resolvedParams, byId } = useResolvedParams(paramIds);

  if (resolvedParams.length === 0) return null;

  const displayTitle = title ?? categoryLabel(category);

  if (!isActive) {
    return <TombstoneCard title={displayTitle} params={resolvedParams} values={values} />;
  }

  const otherParams = resolvedParams.filter((p) => !KNOWN_IDS.has(p.id));

  return (
    <div data-testid="game-mechanics-card">
      <CardShell icon="🎮" title={displayTitle}>
        {SECTIONS.map((s) => {
          const params = s.ids.map((id) => byId.get(id)).filter((p): p is ParameterMeta => p !== undefined);
          if (params.length === 0) return null;
          return (
            <Section key={s.title} title={s.title}>
              {params.map((p) => (
                <ParamRow key={p.id} param={p} value={values[p.id]} onParamChange={onParamChange} />
              ))}
            </Section>
          );
        })}
        {otherParams.length > 0 && (
          <Section title="其他">
            {otherParams.map((p) => (
              <ParamRow key={p.id} param={p} value={values[p.id]} onParamChange={onParamChange} />
            ))}
          </Section>
        )}
      </CardShell>
    </div>
  );
}
