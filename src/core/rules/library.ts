// The rules library (B1–B5): the lines the SJA templates are built from, with their tags,
// risk level, public source and verification state, and how often each was misunderstood
// or not followed on site. An extract used in the templates; not a complete list of rules.
import type { DataPack, HazardList, Product, RiskLevel, Tag, Template, TemplateLine, VerificationState } from '../types';
import { deriveState } from '../verification';

export interface RuleRow {
  key: string;
  templateId: string;
  jobType: Template['jobType'];
  line: TemplateLine;
  tags: Tag[];
  riskLevel: RiskLevel | null;
  /** Product name, for a line that comes with a product (K1). */
  product: Product | null;
  source: { label: string; url?: string; firm: boolean; detail?: string } | null;
  /** Verification state per target language. */
  states: Record<string, VerificationState>;
  misunderstood: number;
  notFollowed: number;
}

export interface RuleFilter {
  tags: Tag[];
  templateId: string | 'all';
  risk: RiskLevel | 'all';
  verification: 'all' | 'verified' | 'notVerified';
  search: string;
  onlyFromSite: boolean;
}

export const EMPTY_FILTER: RuleFilter = { tags: [], templateId: 'all', risk: 'all', verification: 'all', search: '', onlyFromSite: false };

function sourceOf(h: HazardList | undefined, ref: string | null): RuleRow['source'] {
  const entry = h?.entries.find((e) => e.hazardId === ref);
  if (!entry) return null;
  if (entry.sourceId === 'FIRMA') return { label: 'Firmapraksis (ingen offentlig kilde)', firm: true, detail: entry.sourceDetail };
  const src = h?.sources.find((s) => s.sourceId === entry.sourceId);
  const title = src?.title.split(',')[0] ?? entry.sourceId;
  return { label: entry.paragraph ? `${title} ${entry.paragraph}` : `${src?.title ?? entry.sourceId}: ${entry.sourceDetail}`, url: entry.url ?? src?.url, firm: false, detail: entry.sourceDetail };
}

/** Every rule line of every template. Lines that only hold a value from step 1 are left out: they are not rules. */
export function ruleRows(
  pack: DataPack,
  hazards: HazardList[],
  counts: { misunderstood: Record<string, Record<string, number>>; notFollowed: Record<string, Record<string, number>> } = { misunderstood: {}, notFollowed: {} },
): RuleRow[] {
  const rows: RuleRow[] = [];
  for (const t of pack.templates) {
    const h = hazards.find((x) => x.templateId === t.templateId);
    for (const line of t.lines) {
      if (line.parameterRefs.length > 0 && !line.sourceRef) continue;
      const states: Record<string, VerificationState> = {};
      for (const lang of pack.languages) states[lang] = deriveState(line.translations[lang]?.keyLanguage, line.keyTechnical);
      rows.push({
        key: `${t.templateId}/${line.lineId}`,
        templateId: t.templateId,
        jobType: t.jobType,
        line,
        tags: line.tags ?? [],
        riskLevel: line.riskLevel ?? null,
        product: line.onlyWithProduct ? (t.products?.find((p) => p.productId === line.onlyWithProduct) ?? null) : null,
        source: sourceOf(h, line.sourceRef),
        states,
        misunderstood: counts.misunderstood[t.templateId]?.[line.lineId] ?? 0,
        notFollowed: counts.notFollowed[t.templateId]?.[line.lineId] ?? 0,
      });
    }
  }
  return rows;
}

const RISK_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2 };

export function filterRules(rows: RuleRow[], f: RuleFilter): RuleRow[] {
  const q = f.search.trim().toLowerCase();
  return rows
    .filter((r) => f.templateId === 'all' || r.templateId === f.templateId)
    .filter((r) => f.risk === 'all' || r.riskLevel === f.risk)
    .filter((r) => f.tags.length === 0 || f.tags.every((tag) => r.tags.includes(tag)))
    .filter((r) => f.verification === 'all' || (f.verification === 'verified' ? Object.values(r.states).some((s) => s === 'verified') : !Object.values(r.states).some((s) => s === 'verified')))
    .filter((r) => !f.onlyFromSite || r.misunderstood + r.notFollowed > 0)
    .filter((r) => !q || r.line.textNb.toLowerCase().includes(q) || (r.source?.label.toLowerCase().includes(q) ?? false) || Object.values(r.line.translations).some((x) => x?.text.toLowerCase().includes(q)))
    .sort((a, b) => b.misunderstood + b.notFollowed - (a.misunderstood + a.notFollowed) || (RISK_ORDER[a.riskLevel ?? ''] ?? 3) - (RISK_ORDER[b.riskLevel ?? ''] ?? 3));
}

/** The tags that occur in the rows, in the fixed order, so empty tags are not offered as filters. */
export function usedTags(rows: RuleRow[], order: Tag[]): Tag[] {
  const seen = new Set(rows.flatMap((r) => r.tags));
  return order.filter((t) => seen.has(t));
}

/** CSV of the filtered list (B5), for a manager to keep or attach in the firm's HSE system. */
export function rulesCsv(rows: RuleRow[], labels: { tag: (t: Tag) => string; risk: (r: RiskLevel) => string; lang: 'nb' | 'en'; banner: string }): string {
  const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['Jobbtype', 'Regel / tiltak (norsk)', 'Kategorier', 'Risiko', 'Sikkerhetskritisk', 'Kilde', 'Lenke', 'Misforstått på byggeplassen', 'Ikke fulgt på byggeplassen', ...Object.keys(rows[0]?.states ?? {}).map((l) => `Verifisert ${l}`)];
  const lines = rows.map((r) =>
    [
      r.jobType[labels.lang] ?? r.jobType.nb ?? r.templateId,
      r.line.textNb,
      r.tags.map(labels.tag).join('; '),
      r.riskLevel ? labels.risk(r.riskLevel) : '',
      r.line.critical ? 'ja' : '',
      r.source?.label ?? 'Uten kilde',
      r.source?.url ?? '',
      String(r.misunderstood),
      String(r.notFollowed),
      ...Object.values(r.states).map((s) => (s === 'verified' ? 'ja' : 'nei')),
    ]
      .map(q)
      .join(','),
  );
  return [q(labels.banner), head.map(q).join(','), ...lines].join('\n') + '\n';
}
