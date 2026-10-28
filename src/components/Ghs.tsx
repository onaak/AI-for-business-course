// GHS hazard pictograms (CLP), drawn here as simplified symbols: a red diamond with a
// black symbol. They do not depend on language, which is why workers see them next to the
// lines that come from a product's safety data sheet (K3). Simplified drawings, not the
// official artwork: good enough to recognise, not for labelling a real product.
import type { Ghs } from '../core/types';

export const GHS_NAMES: Record<Ghs, Record<string, string>> = {
  GHS01: { nb: 'Eksplosiv', en: 'Explosive', pl: 'Wybuchowe', lt: 'Sprogus', ru: 'Взрывоопасно' },
  GHS02: { nb: 'Brannfarlig', en: 'Flammable', pl: 'Łatwopalne', lt: 'Degus', ru: 'Огнеопасно' },
  GHS03: { nb: 'Oksiderende', en: 'Oxidising', pl: 'Utleniające', lt: 'Oksiduojantis', ru: 'Окислитель' },
  GHS04: { nb: 'Gass under trykk', en: 'Gas under pressure', pl: 'Gaz pod ciśnieniem', lt: 'Suslėgtosios dujos', ru: 'Газ под давлением' },
  GHS05: { nb: 'Etsende', en: 'Corrosive', pl: 'Żrące', lt: 'Ėsdinantis', ru: 'Разъедающее' },
  GHS06: { nb: 'Giftig', en: 'Toxic', pl: 'Toksyczne', lt: 'Toksiškas', ru: 'Токсично' },
  GHS07: { nb: 'Helseskadelig, irriterende', en: 'Harmful, irritant', pl: 'Szkodliwe, drażniące', lt: 'Kenksmingas, dirginantis', ru: 'Вредно, раздражает' },
  GHS08: { nb: 'Alvorlig helsefare', en: 'Serious health hazard', pl: 'Poważne zagrożenie dla zdrowia', lt: 'Labai pavojingas sveikatai', ru: 'Серьёзная опасность для здоровья' },
  GHS09: { nb: 'Miljøfare', en: 'Hazardous to the environment', pl: 'Niebezpieczne dla środowiska', lt: 'Pavojingas aplinkai', ru: 'Опасно для окружающей среды' },
};

function Symbol({ code }: { code: Ghs }) {
  switch (code) {
    case 'GHS02': // flame over a bar
      return (
        <g fill="#000">
          <path d="M50 22c3 9 12 13 12 25 0 4-1 7-3 9 1-5-1-9-4-12 0 6-3 9-6 11 1-4-1-8-4-10-1 6-6 8-6 14 0 3 1 5 3 7-6-2-10-7-10-14 0-11 11-15 13-24 1 4 2 6 5 8 1-6 0-11 0-14z" />
          <rect x="31" y="64" width="38" height="5" />
        </g>
      );
    case 'GHS05': // drops falling onto a surface and a hand
      return (
        <g fill="#000">
          <path d="M33 26h10l-2 10h-6z" />
          <path d="M57 26h10l-2 10h-6z" />
          <path d="M38 40c2 4 3 6 3 8a3 3 0 0 1-6 0c0-2 1-4 3-8z" />
          <path d="M62 40c2 4 3 6 3 8a3 3 0 0 1-6 0c0-2 1-4 3-8z" />
          <path d="M28 60h20l-3 5h-14z" />
          <path d="M53 58c4 0 12 2 18 6v6H53z" />
        </g>
      );
    case 'GHS07': // exclamation mark
      return (
        <g fill="#000">
          <path d="M45 24h10l-2 30h-6z" />
          <circle cx="50" cy="63" r="5" />
        </g>
      );
    case 'GHS08': // person with a star burst on the chest
      return (
        <g fill="#000">
          <circle cx="50" cy="26" r="6" />
          <path d="M38 36h24l4 34H34z" />
          <path fill="#fff" d="M50 44l2.5 6 6.5.5-5 4 1.6 6.3L50 57.5l-5.6 3.3 1.6-6.3-5-4 6.5-.5z" />
        </g>
      );
    default:
      return (
        <text x="50" y="56" textAnchor="middle" fontSize="13" fontWeight="700" fill="#000">
          {code}
        </text>
      );
  }
}

/** One pictogram. `lang` picks the accessible name (worker screens use the worker's language). */
export function GhsIcon({ code, lang = 'nb', size = 40 }: { code: Ghs; lang?: string; size?: number }) {
  const name = GHS_NAMES[code][lang] ?? GHS_NAMES[code].en;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${code}: ${name}`} className="shrink-0" data-testid={`ghs-${code}`}>
      <title>{`${code}: ${name}`}</title>
      <rect x="15" y="15" width="70" height="70" transform="rotate(45 50 50)" fill="#fff" stroke="#dc2626" strokeWidth="7" />
      <Symbol code={code} />
    </svg>
  );
}

export function GhsRow({ codes, lang = 'nb', size = 40, labels = false }: { codes: Ghs[]; lang?: string; size?: number; labels?: boolean }) {
  if (!codes.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid="ghs-row">
      {codes.map((c) => (
        <span key={c} className="inline-flex items-center gap-1">
          <GhsIcon code={c} lang={lang} size={size} />
          {labels && <span className="text-xs font-semibold text-slate-800">{GHS_NAMES[c][lang] ?? GHS_NAMES[c].en}</span>}
        </span>
      ))}
    </span>
  );
}
