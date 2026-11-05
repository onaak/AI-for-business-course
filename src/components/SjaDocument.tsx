// The signed SJA as a document (5 Nov 2026): one section per language, the Norwegian original first,
// then each crew language. Each section lists the lines, who confirmed digitally and when (the
// foreman, worker 1, worker 2 …) and blank lines for names and signatures on paper. No names are
// stored anywhere. Inline styles only, so the same markup works on screen, in print and as a
// downloaded file that opens on its own.
import type { CSSProperties } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bySection, isToday, usableText } from '../core/sjaText';
import { BANNER_EN, BANNER_NB, type Sja, type Template } from '../core/types';
import { LANG_NAMES } from '../core/util';
import { translate, workerT } from '../i18n';
import { docWords } from '../i18n/document';

const S: Record<string, CSSProperties> = {
  doc: { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: '#0f172a', lineHeight: 1.45, maxWidth: 820, margin: '0 auto', fontSize: 15 },
  banner: { background: '#fcd34d', fontWeight: 700, fontSize: 12, padding: '6px 10px', textAlign: 'center', borderRadius: 4 },
  h1: { fontSize: 24, margin: '16px 0 4px' },
  h2: { fontSize: 20, margin: '0 0 2px' },
  h3: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', margin: '14px 0 6px' },
  muted: { color: '#475569', fontSize: 13 },
  facts: { borderCollapse: 'collapse', margin: '8px 0', fontSize: 14 },
  factTh: { textAlign: 'left', padding: '2px 12px 2px 0', color: '#475569', fontWeight: 600, verticalAlign: 'top' },
  section: { breakBefore: 'page', pageBreakBefore: 'always', borderTop: '3px solid #0f172a', paddingTop: 14, marginTop: 28 },
  line: { padding: '6px 8px', borderBottom: '1px solid #e2e8f0' },
  today: { padding: '6px 8px', borderBottom: '1px solid #e2e8f0', borderLeft: '6px solid #f59e0b', background: '#fffbeb', fontWeight: 700 },
  tag: { display: 'inline-block', fontSize: 11, fontWeight: 700, border: '1px solid #f59e0b', borderRadius: 999, padding: '0 6px', marginLeft: 6, color: '#78350f' },
  crit: { display: 'inline-block', fontSize: 13, fontWeight: 700, marginLeft: 6, color: '#be123c' },
  oral: { fontStyle: 'italic', color: '#78350f' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 4 },
  th: { textAlign: 'left', borderBottom: '2px solid #0f172a', padding: '4px 6px' },
  td: { borderBottom: '1px solid #94a3b8', padding: '4px 6px', height: 30, verticalAlign: 'bottom' },
  footer: { color: '#64748b', fontSize: 12, marginTop: 10 },
};

/** Local date and time, the same on every device: 2026-11-05 07:42. */
export function fmtLocal(at: string): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The languages the document has a section for: Norwegian, then each crew language the tool supports. */
export function documentLangs(sja: Pick<Sja, 'languages' | 'lines'>): string[] {
  const crew = sja.languages.filter((l) => l !== 'nb' && sja.lines.some((x) => x.byLang[l]));
  return ['nb', ...crew];
}

function Section({ sja, template, lang }: { sja: Sja; template?: Template; lang: string }) {
  const w = docWords(lang);
  const wt = workerT(lang);
  const nb = lang === 'nb';
  const sectionName = (s: string) => (nb ? translate('nb', `section.${s}`) : wt(`section_${s}` as never));
  const u = sja.understanding;
  // Workers who confirmed in this language; oral confirmations (no language) go in the Norwegian section.
  const confirmed = (u.confirmations ?? []).filter((c) => (nb ? c.lang === '' || c.lang === 'nb' : c.lang === lang));
  const jobType = template?.jobType[lang as 'nb'] ?? template?.jobType.nb ?? sja.templateId;
  const blankRows = 2;
  return (
    <section id={`sja-${lang}`} style={nb ? { marginTop: 18 } : S.section} lang={lang}>
      <p style={S.banner}>{nb ? BANNER_NB : wt('banner')}</p>
      <h2 style={{ ...S.h2, marginTop: 10 }}>
        {w.title} · {LANG_NAMES[lang]?.own ?? lang}
      </h2>
      <p style={S.muted}>{nb ? w.original : w.translated}</p>
      <p style={S.muted}>
        <span style={S.crit}>⚠</span> = {w.critical}
      </p>
      <table style={S.facts}>
        <tbody>
          <tr>
            <th style={S.factTh}>{w.job}</th>
            <td>{jobType}</td>
          </tr>
          <tr>
            <th style={S.factTh}>{w.date}</th>
            <td>{sja.header.date}</td>
          </tr>
          <tr>
            <th style={S.factTh}>{w.site}</th>
            <td>{sja.header.siteLabel || '–'}</td>
          </tr>
        </tbody>
      </table>

      {bySection(sja).map(({ section, lines }) => (
        <div key={section}>
          <h3 style={S.h3}>{sectionName(section)}</h3>
          {lines.map((l) => {
            const text = usableText(l, lang);
            return (
              <div key={l.lineId} style={isToday(l) ? S.today : S.line}>
                {text ? <span>{text}</span> : <span style={S.oral}>{wt('oralPoint')}</span>}
                {isToday(l) && <span style={S.tag}>{w.newToday}</span>}
                {l.critical && (
                  <span style={S.crit} title={w.critical} aria-label={w.critical}>
                    ⚠
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <h3 style={S.h3}>{w.confirmedTitle}</h3>
      <table style={S.table}>
        <tbody>
          {u.readAloud && (
            <tr>
              <td style={{ padding: '3px 6px' }}>{w.readAloud}</td>
              <td style={{ padding: '3px 6px' }}>{fmtLocal(u.readAloud.at)}</td>
            </tr>
          )}
          {sja.signoff && (
            <tr>
              <td style={{ padding: '3px 6px' }}>
                {w.foreman} ({sja.signoff.role})
              </td>
              <td style={{ padding: '3px 6px' }}>{fmtLocal(sja.signoff.at)}</td>
            </tr>
          )}
          {confirmed.map((c) => (
            <tr key={c.n}>
              <td style={{ padding: '3px 6px' }}>
                {w.worker.replace('{n}', String(c.n))}
                {c.oral ? ` (${w.orally})` : ''}
              </td>
              <td style={{ padding: '3px 6px' }}>{fmtLocal(c.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirmed.length === 0 && <p style={S.muted}>{w.noneConfirmed}</p>}

      <h3 style={S.h3}>{w.signTitle}</h3>
      <p style={S.muted}>{w.signHint}</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>{w.role}</th>
            <th style={S.th}>{w.name}</th>
            <th style={S.th}>{w.signature}</th>
            <th style={S.th}>{w.time}</th>
          </tr>
        </thead>
        <tbody>
          {nb && (
            <tr>
              <td style={S.td}>{w.foreman.split(',')[0]}</td>
              <td style={S.td} />
              <td style={S.td} />
              <td style={S.td} />
            </tr>
          )}
          {confirmed.map((c) => (
            <tr key={c.n}>
              <td style={S.td}>{w.worker.replace('{n}', String(c.n))}</td>
              <td style={S.td} />
              <td style={S.td} />
              <td style={S.td}>{fmtLocal(c.at)}</td>
            </tr>
          ))}
          {Array.from({ length: blankRows }, (_, i) => (
            <tr key={`blank-${i}`}>
              <td style={S.td} />
              <td style={S.td} />
              <td style={S.td} />
              <td style={S.td} />
            </tr>
          ))}
        </tbody>
      </table>
      <p style={S.footer}>{w.footer}</p>
    </section>
  );
}

/** The whole document: a short head in Norwegian, then one section per language. */
export function SjaDocument({ sja, template }: { sja: Sja; template?: Template }) {
  const langs = documentLangs(sja);
  const w = docWords('nb');
  const jobType = template?.jobType.nb ?? sja.templateId;
  return (
    <article style={S.doc} data-testid="sja-document">
      <h1 style={S.h1}>
        {w.title}: {jobType}
      </h1>
      <p style={S.muted}>
        {sja.header.date} · {sja.header.siteLabel || '–'} · {translate('nb', `status.${sja.status}`)}
      </p>
      <p style={{ ...S.muted, marginTop: 6 }}>
        {w.contents}:{' '}
        {langs.map((l, i) => (
          <span key={l}>
            {i > 0 ? ' · ' : ''}
            <a href={`#sja-${l}`}>{LANG_NAMES[l]?.own ?? l}</a>
          </span>
        ))}
      </p>
      {langs.map((l) => (
        <Section key={l} sja={sja} template={template} lang={l} />
      ))}
    </article>
  );
}

/** A standalone HTML file of the document: opens in any browser and prints, with no app needed. */
export function sjaDocumentHtml(sja: Sja, template?: Template): string {
  const body = renderToStaticMarkup(<SjaDocument sja={sja} template={template} />);
  const title = `SJA ${sja.header.date} ${template?.jobType.nb ?? sja.templateId}`;
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>body{margin:16px;background:#fff}@media print{body{margin:0}a{color:inherit;text-decoration:none}}</style>
</head>
<body>
<p style="font:600 12px system-ui,sans-serif;color:#475569">${BANNER_EN}</p>
${body}
</body>
</html>
`;
}
