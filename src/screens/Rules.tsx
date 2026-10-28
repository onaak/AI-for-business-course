// "Regler og tiltak" (B3–B5): the lines the SJA templates are built from, filterable by
// category, job type, risk level and verification state, with their source and how often
// each was misunderstood or not followed on site (counted from the log on this device).
// An extract used in the templates, not a complete list of rules (B4).
import { useMemo, useState } from 'react';
import { GhsRow } from '../components/Ghs';
import { CriticalMark, VerificationChip } from '../components/sja';
import { Button, Card, Chip, download, Icon, inputClass, Layout, Notice } from '../components/ui';
import { feedbackEvents, misunderstandingCounts } from '../core/metrics';
import { EMPTY_FILTER, filterRules, ruleRows, rulesCsv, usedTags, type RuleFilter } from '../core/rules/library';
import { BANNER_EN, BANNER_NB, TAGS, type RiskLevel, type Tag } from '../core/types';
import { LANG_NAMES } from '../core/util';
import { useT, useUiLang } from '../i18n';
import { useApp, useLog, useSjas } from '../state/stores';

const RISK_TONE: Record<RiskLevel, 'red' | 'amber' | 'green'> = { red: 'red', yellow: 'amber', green: 'green' };

export function RiskChip({ level }: { level: RiskLevel }) {
  const t = useT();
  return (
    <Chip tone={RISK_TONE[level]}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${level === 'red' ? 'bg-rose-600' : level === 'yellow' ? 'bg-amber-500' : 'bg-emerald-600'}`} /> {t(`risk.${level}`)}
    </Chip>
  );
}

export default function RulesLibrary() {
  const t = useT();
  const ui = useUiLang();
  const pack = useApp((s) => s.pack);
  const hazards = useApp((s) => s.hazards);
  const sjas = useSjas((s) => s.sjas);
  const all = useLog((s) => s.events);
  const events = useMemo(() => feedbackEvents(all, sjas), [all, sjas]);
  const [f, setF] = useState<RuleFilter>(EMPTY_FILTER);

  const rows = useMemo(
    () => (pack ? ruleRows(pack, hazards, { misunderstood: misunderstandingCounts(events), notFollowed: misunderstandingCounts(events, 'rule_not_followed') }) : []),
    [pack, hazards, events],
  );
  const shown = useMemo(() => filterRules(rows, f), [rows, f]);
  const tags = usedTags(rows, TAGS);
  const checked = hazards.map((h) => h.checkedAt).filter(Boolean).sort()[0];
  if (!pack) return <Layout title={t('rules.title')}>{t('common.loading')}</Layout>;

  const toggleTag = (tag: Tag) => setF((x) => ({ ...x, tags: x.tags.includes(tag) ? x.tags.filter((y) => y !== tag) : [...x.tags, tag] }));
  const exportCsv = () =>
    download(
      `regler-og-tiltak-${new Date().toISOString().slice(0, 10)}.csv`,
      rulesCsv(shown, { tag: (x) => t(`tag.${x}`), risk: (r) => t(`risk.${r}`), lang: ui, banner: ui === 'nb' ? BANNER_NB : BANNER_EN }),
      'text/csv;charset=utf-8',
    );

  return (
    <Layout title={t('rules.title')} wide>
      <div className="space-y-4" data-testid="rules">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{t('rules.title')}</h1>
          <Notice tone="amber">
            <span data-testid="rules-disclaimer">
              <strong>{t('rules.disclaimer')}</strong> {checked ? t('rules.checkedAt', { date: checked }) : ''}
            </span>
          </Notice>
          <p className="text-sm text-slate-700">{t('rules.intro')}</p>
        </header>

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('rules.tags')}>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={f.tags.includes(tag)}
                onClick={() => toggleTag(tag)}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${f.tags.includes(tag) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-400 bg-white text-slate-900'}`}
                data-testid={`rules-tag-${tag}`}
              >
                {t(`tag.${tag}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('rules.jobType')}</span>
              <select className={inputClass} value={f.templateId} onChange={(e) => setF((x) => ({ ...x, templateId: e.target.value }))} data-testid="rules-job">
                <option value="all">{t('rules.all')}</option>
                {pack.templates.map((tpl) => (
                  <option key={tpl.templateId} value={tpl.templateId}>
                    {tpl.jobType[ui] ?? tpl.jobType.nb}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('rules.risk')}</span>
              <select className={inputClass} value={f.risk} onChange={(e) => setF((x) => ({ ...x, risk: e.target.value as RuleFilter['risk'] }))} data-testid="rules-risk">
                <option value="all">{t('rules.all')}</option>
                {(['red', 'yellow', 'green'] as const).map((r) => (
                  <option key={r} value={r}>
                    {t(`risk.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('rules.verification')}</span>
              <select className={inputClass} value={f.verification} onChange={(e) => setF((x) => ({ ...x, verification: e.target.value as RuleFilter['verification'] }))} data-testid="rules-verif">
                <option value="all">{t('rules.all')}</option>
                <option value="verified">{t('rules.verifiedSome')}</option>
                <option value="notVerified">{t('rules.notVerified')}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('rules.search')}</span>
              <input className={inputClass} type="search" value={f.search} onChange={(e) => setF((x) => ({ ...x, search: e.target.value }))} data-testid="rules-search" />
            </label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={f.onlyFromSite} onChange={(e) => setF((x) => ({ ...x, onlyFromSite: e.target.checked }))} data-testid="rules-site" />
            <span className="text-sm font-semibold">{t('rules.onlySite')}</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold" data-testid="rules-count">
              {t('rules.count', { n: shown.length, total: rows.length })}
            </span>
            <Button onClick={exportCsv} data-testid="rules-csv">
              <Icon name="doc" /> {t('rules.csv')}
            </Button>
            <Button onClick={() => window.print()}>{t('rec.print')}</Button>
            {(f.tags.length > 0 || f.templateId !== 'all' || f.risk !== 'all' || f.verification !== 'all' || f.search || f.onlyFromSite) && (
              <Button variant="ghost" onClick={() => setF(EMPTY_FILTER)}>
                {t('rules.reset')}
              </Button>
            )}
          </div>
        </Card>

        <ul className="space-y-2" data-testid="rules-list">
          {shown.map((r) => (
            <li key={r.key} className="rounded-xl border border-slate-300 bg-white p-3" data-testid={`rule-${r.key}`}>
              <p className="text-base">{r.line.textNb}</p>
              {r.product && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  <GhsRow codes={r.product.ghs} lang={ui} size={28} /> {r.product.name[ui] ?? r.product.name.nb}
                </p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-2">
                <Chip tone="blue">{r.jobType[ui] ?? r.jobType.nb}</Chip>
                {r.riskLevel && <RiskChip level={r.riskLevel} />}
                {r.line.critical && <CriticalMark />}
                {r.tags.map((tag) => (
                  <Chip key={tag}>{t(`tag.${tag}`)}</Chip>
                ))}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold">{t('line.source')}:</span>{' '}
                {r.source ? (
                  r.source.url ? (
                    <a className="underline" href={r.source.url} target="_blank" rel="noreferrer" title={r.source.detail}>
                      {r.source.label}
                    </a>
                  ) : (
                    <span title={r.source.detail}>{r.source.label}</span>
                  )
                ) : (
                  t('line.unsourced')
                )}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                {Object.entries(r.states).map(([lang, st]) => (
                  <span key={lang} className="inline-flex items-center gap-1">
                    <span className="text-slate-600">{LANG_NAMES[lang]?.[ui] ?? lang}:</span> <VerificationChip state={st} />
                  </span>
                ))}
              </p>
              {(r.misunderstood > 0 || r.notFollowed > 0) && (
                <p className="mt-2 flex flex-wrap gap-2" data-testid="rule-site-counts">
                  {r.misunderstood > 0 && <Chip tone="amber">{t('rules.misunderstood', { n: r.misunderstood })}</Chip>}
                  {r.notFollowed > 0 && <Chip tone="red">{t('rules.notFollowed', { n: r.notFollowed })}</Chip>}
                </p>
              )}
            </li>
          ))}
        </ul>
        {shown.length === 0 && <Notice>{t('rules.none')}</Notice>}
      </div>
    </Layout>
  );
}
