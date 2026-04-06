import type { ParameterMeta } from '@/data/parameter-registry';
import type { GuiParamCardProps } from '@/ui/chat/gui-param-card';
import { ParamRow, TombstoneCard, categoryLabel } from '@/ui/chat/gui-param-card';
import { CardShell, Section } from './card-shell';
import { useResolvedParams } from './use-resolved-params';

/* ------------------------------------------------------------------ */
/*  Sub-group definitions                                              */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { title: '视觉风格', ids: ['visual_audio_003', 'visual_audio_006', 'visual_audio_009'] },
  { title: '界面', ids: ['visual_audio_001', 'visual_audio_004', 'visual_audio_005', 'visual_audio_010'] },
  { title: '结果页', ids: ['visual_audio_002', 'visual_audio_011', 'visual_audio_012', 'visual_audio_013', 'visual_audio_014'] },
  { title: '音效', ids: ['visual_audio_007', 'visual_audio_008'] },
  { title: '特效', ids: ['visual_audio_015', 'visual_audio_016', 'visual_audio_017', 'visual_audio_020'] },
] as const;

const KNOWN_IDS: ReadonlySet<string> = new Set(SECTIONS.flatMap((s) => s.ids));

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function VisualAudioCard({
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
    <div data-testid="visual-audio-card">
      <CardShell icon="🎨" title={displayTitle}>
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
