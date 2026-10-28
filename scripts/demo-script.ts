// Scripted answers for the demo replay fixtures.
//
// IMPORTANT: nothing in this file is model output. These answers were written by
// the builder so that the prototype can be shown, and its automated tests run,
// without an API key. Fixtures generated from this file carry origin "scripted"
// and are labelled as such on screen and in every export. They are not evidence
// for any claim (C1–C6). Replace them by running with GATEWAY_MODE=record.
import type { P1Input, P2Input, P3Input, P4Input, P5Input, P6Input, P7Input } from '../src/core/schemas';
import type { Provider } from '../server/providers/types';

const p4 = new Map<string, { text: string; missingConcepts: string[] }>();
const p5 = new Map<string, string>();
const p6 = new Map<string, unknown>();

const SAME = { negation: 'same', obligation: 'same', numbers: 'same', direction: 'same', condition: 'same', omission: 'same', addition: 'same', object: 'same' } as const;
type Verdict = 'same' | { differs: (keyof typeof SAME)[]; nb: string; en: string };

function verdict(v: Verdict) {
  if (v === 'same') return { checks: SAME, category: 'NONE', explanationNb: '', explanationEn: '' };
  const checks = { ...SAME } as Record<string, string>;
  for (const k of v.differs) checks[k] = 'different';
  const onlyOA = v.differs.every((k) => k === 'omission' || k === 'addition');
  return { checks, category: onlyOA ? 'OMISSION_ADDITION' : 'MEANING_SHIFT', explanationNb: v.nb, explanationEn: v.en };
}

/** A scripted translation with its back-translation and comparison. */
function T(source: string, lang: string, attempt: number, target: string, back: string, v: Verdict = 'same', missingConcepts: string[] = []) {
  p4.set(`${lang}|${attempt}|${source}`, { text: target, missingConcepts });
  B(source, lang, target, back, v);
}
/** A scripted back-translation and comparison for a given pair (test bench). */
function B(source: string, lang: string, target: string, back: string, v: Verdict = 'same') {
  p5.set(`${lang}|${target}`, back);
  p6.set(`${source}|${back}`, verdict(v));
}

// ---------- jd-01: lifting, happy path ----------
const S1 = 'Sperr av faresonen rundt løftet, også gangveien ved inngangen.';
const S2 = 'Ikke løft over gangveien mens personer oppholder seg der.';
const S3 = 'Bruk to styretau fordi lasten er lang.';
T(S1, 'pl', 0, 'Wygrodź strefę niebezpieczną wokół miejsca podnoszenia, również chodnik przy wejściu.', 'Sperr av faresonen rundt løftestedet, også gangveien ved inngangen.');
T(S1, 'lt', 0, 'Aptverkite pavojaus vietą aplink kėlimo vietą, taip pat pėsčiųjų taką prie įėjimo.', 'Sperr av farestedet rundt løftestedet, også gangveien ved inngangen.');
T(S1, 'lt', 1, 'Aptverkite pavojingą zoną aplink kėlimo vietą, taip pat pėsčiųjų taką prie įėjimo.', 'Sperr av faresonen rundt løftestedet, også gangveien ved inngangen.');
T(S1, 'en', 0, 'Cordon off the danger zone around the lift, including the walkway by the entrance.', 'Sperr av faresonen rundt løftet, inkludert gangveien ved inngangen.');
T(S2, 'pl', 0, 'Nie podnoś ładunku nad chodnikiem, gdy przebywają tam ludzie.', 'Ikke løft last over gangveien når det oppholder seg folk der.');
T(S2, 'lt', 0, 'Nekelkite krovinio virš pėsčiųjų tako, kol ten yra žmonių.', 'Ikke løft last over gangveien mens det er folk der.');
T(S2, 'en', 0, 'Do not lift over the walkway while people are there.', 'Ikke løft over gangveien mens det er folk der.');
T(S3, 'pl', 0, 'Użyj dwóch lin kierunkowych, ponieważ ładunek jest długi.', 'Bruk to styretau fordi lasten er lang.');
T(S3, 'lt', 0, 'Naudokite dvi kreipiamąsias virves, nes krovinys ilgas.', 'Bruk to styretau, fordi lasten er lang.');
T(S3, 'en', 0, 'Use two tag lines because the load is long.', 'Bruk to styreliner fordi lasten er lang.');

// ---------- jd-02: work at height, AI suggestion and flags ----------
const A = 'Utsparingen i dekket ved trappa skal dekkes til og merkes.';
const Bq = 'Sperr av fortauet under stillaset før arbeidet starter.';
const Bplain = 'Sperr av fortauet under stillaset før dere begynner.';
const C = 'Alle som går opp på stillaset skal ha fått opplæring.';
T(A, 'pl', 0, 'Otwór w stropie przy schodach należy zakryć i oznakować.', 'Åpningen i dekket ved trappa skal dekkes til og merkes.');
T(A, 'lt', 0, 'Skylė perdangoje prie laiptų turi būti uždengta ir pažymėta.', 'Hullet i dekket ved trappa skal dekkes til og merkes.');
T(A, 'lt', 1, 'Kiaurymė perdangoje prie laiptų turi būti uždengta ir pažymėta.', 'Hullet i dekket ved trappa skal dekkes til og merkes.');
T(A, 'lt', 2, 'Skylė grindyse prie laiptų turi būti uždengta ir pažymėta.', 'Hullet i gulvet ved trappa skal dekkes til og merkes.');
T(Bq, 'pl', 0, 'Wygrodź chodnik pod rusztowaniem po rozpoczęciu pracy.', 'Sperr av fortauet under stillaset etter at arbeidet har startet.', {
  differs: ['condition'],
  nb: 'Originalen sier «før arbeidet starter». Tilbakeoversettelsen sier «etter at arbeidet har startet».',
  en: 'The original says "before work starts". The back-translation says "after work has started".',
});
T(Bq, 'lt', 0, 'Aptverkite šaligatvį po pastoliais prieš pradedant darbą.', 'Sperr av fortauet under stillaset før arbeidet starter.');
T(Bplain, 'pl', 0, 'Wygrodź chodnik pod rusztowaniem, zanim zaczniecie.', 'Sperr av fortauet under stillaset før dere begynner.');
T(Bplain, 'lt', 0, 'Aptverkite šaligatvį po pastoliais prieš pradėdami.', 'Sperr av fortauet under stillaset før dere begynner.');
T(C, 'pl', 0, 'Każdy, kto wchodzi na rusztowanie, powinien przejść szkolenie.', 'Alle som går opp på stillaset bør ha fått opplæring.', {
  differs: ['obligation'],
  nb: 'Originalen sier «skal». Tilbakeoversettelsen sier «bør».',
  en: 'The original says "must". The back-translation says "should".',
});
T(C, 'lt', 0, 'Visi, kurie lipa ant pastolių, turi būti apmokyti.', 'Alle som går opp på stillaset skal være opplært.');

// ---------- jd-03: slang ----------
const D = 'Sperr av faresonen rundt løftet og hold porten stengt under løftet.';
T(D, 'pl', 0, 'Wygrodź strefę niebezpieczną wokół miejsca podnoszenia i trzymaj bramę zamkniętą podczas podnoszenia.', 'Sperr av faresonen rundt løftestedet og hold porten stengt under løftet.');
T(D, 'lt', 0, 'Aptverkite pavojingą zoną aplink kėlimo vietą ir laikykite vartus uždarytus kėlimo metu.', 'Sperr av faresonen rundt løftestedet og hold porten stengt under løftet.');

// ---------- jd-04: ambiguous line, missing glossary term ----------
const E = 'Bruk sele ved behov.';
const Efix = 'Bruk fallsikringssele festet til forankringspunkt hele tiden du er utenfor stillaset.';
const F = 'Vinsjen skal ha lastbrems og være festet til bærende konstruksjon.';
T(Efix, 'pl', 0, 'Przez cały czas, gdy jesteś poza rusztowaniem, używaj szelek bezpieczeństwa przypiętych do punktu kotwiczenia.', Efix);
T(Efix, 'lt', 0, 'Visą laiką, kol esate už pastolių ribų, naudokite viso kūno saugos diržus, pritvirtintus prie tvirtinimo taško.', Efix);
T(F, 'pl', 0, 'Wciągarka musi mieć hamulec ładunku i być przymocowana do konstrukcji nośnej.', F, 'same', ['vinsj']);
T(F, 'lt', 0, 'Gervė turi turėti krovinio stabdį ir būti pritvirtinta prie laikančiosios konstrukcijos.', F, 'same', ['vinsj']);

// ---------- jd-10: painting, Russian glossary flag (added 26 Oct 2026) ----------
const PV1 = 'Sett opp mekanisk ventilasjon før lakkeringen starter, fordi rommet bare har ett lite vindu.';
const PV2 = 'Bare de som har opplæring i isocyanater, skal blande og påføre lakken.';
T(PV1, 'ru', 0, 'Перед началом лакирования установите механическую вытяжку, потому что в помещении только одно маленькое окно.', 'Sett opp mekanisk avtrekk før lakkeringen starter, fordi rommet bare har ett lite vindu.');
T(PV1, 'ru', 1, 'Перед началом лакирования установите механическую вентиляцию, потому что в помещении только одно маленькое окно.', PV1);
T(PV1, 'lt', 0, 'Prieš pradėdami lakuoti įrenkite mechaninį vėdinimą, nes patalpoje yra tik vienas mažas langas.', PV1);
T(PV2, 'ru', 0, 'Смешивать и наносить лак должны только те, кто прошёл обучение по работе с изоцианатами.', PV2);
T(PV2, 'lt', 0, 'Lakas maišyti ir tepti turi tik tie, kurie apmokyti dirbti su izocianatais.', PV2);

// ---------- jd-11: concrete (added 26 Oct 2026) ----------
const CV1 = 'Betongbilen rygger inn over fortauet. Sperr av fortauet, og la signalgiveren dirigere bilen.';
T(CV1, 'ru', 0, 'Бетоновоз заезжает задним ходом через тротуар. Оградите тротуар, и пусть сигнальщик руководит машиной.', CV1);
T(CV1, 'pl', 0, 'Betonowóz wjeżdża tyłem przez chodnik. Wygrodź chodnik i niech sygnalista kieruje samochodem.', CV1);

// ---------- test bench (T6): scripted back-translations for the pair fixtures ----------
export interface ScriptedPair {
  source: string;
  lang: string;
  target: string;
}
const diff = (differs: (keyof typeof SAME)[], nb: string, en: string): Verdict => ({ differs, nb, en });
const BENCH: Record<string, [string, Verdict]> = {
  // Polish seeded errors
  'Zagrożenie: dźwig przewraca się z powodu słabego podłoża lub zbyt ciężkiego ładunku.': ['Fare: kranen velter på grunn av svakt underlag eller for tung last.', 'same'],
  'Tam, gdzie nie ma balustrady ochronnej, używaj pasa bezpieczeństwa przypiętego do zatwierdzonego punktu kotwiczenia.': ['Bruk sikkerhetsbelte festet til godkjent forankringspunkt der rekkverk mangler.', diff(['object'], 'Originalen sier «fallsikringssele». Tilbakeoversettelsen sier «sikkerhetsbelte».', 'The original says "fall-arrest harness". The back-translation says "safety belt".')],
  'Sprawdź przed użyciem, czy liny i szekle nie są uszkodzone.': ['Kontroller tau og sjakler for skader før bruk.', diff(['object'], 'Originalen sier «løftestropper». Tilbakeoversettelsen sier «tau».', 'The original says "lifting slings". The back-translation says "ropes".')],
  'Wygrodź miejsce wokół podnoszenia.': ['Sperr av stedet rundt løftet.', 'same'],
  'Podczas pracy muszą być obecne co najmniej 3 osoby.': ['Minst 3 personer skal være til stede under arbeidet.', diff(['numbers'], 'Originalen sier «minst 2 personer». Tilbakeoversettelsen sier «minst 3 personer».', 'The original says "at least 2 people". The back-translation says "at least 3 people".')],
  'Każdy może przebywać pod podwieszonym ładunkiem.': ['Alle kan oppholde seg under hengende last.', diff(['negation'], 'Originalen sier «ingen skal». Tilbakeoversettelsen sier «alle kan».', 'The original says "nobody may". The back-translation says "anyone may".')],
  'Hełm ochronny z paskiem podbródkowym można nosić przez cały czas.': ['Hjelm med hakestropp kan brukes hele tiden.', diff(['obligation'], 'Originalen sier «skal brukes». Tilbakeoversettelsen sier «kan brukes».', 'The original says "must be worn". The back-translation says "may be worn".')],
  'Drabina może być używana i musi być zabezpieczona przed poślizgiem.': ['Stige kan brukes og skal sikres mot å gli.', diff(['condition', 'omission'], 'Originalen sier «bare til kortvarig arbeid». Det mangler i tilbakeoversettelsen.', 'The original says "only for short work". That is missing from the back-translation.')],
  'Wygrodź teren nad miejscem pracy.': ['Sperr av området over arbeidsstedet.', diff(['direction'], 'Originalen sier «under arbeidsstedet». Tilbakeoversettelsen sier «over arbeidsstedet».', 'The original says "below the work area". The back-translation says "above the work area".')],
  'Ubezpiecz narzędzia i materiały tak, aby nie mogły spaść.': ['Sikre verktøy og materialer slik at de ikke kan falle ned.', 'same'],
  // Lithuanian seeded errors
  'Kur nėra apsauginių turėklų, naudokite juosmens diržą, pritvirtintą prie patvirtinto tvirtinimo taško.': ['Bruk hoftebelte festet til godkjent forankringspunkt der rekkverk mangler.', diff(['object'], 'Originalen sier «fallsikringssele». Tilbakeoversettelsen sier «hoftebelte».', 'The original says "fall-arrest harness". The back-translation says "waist belt".')],
  'Prieš naudodami patikrinkite, ar tvirtinimo diržai ir apkabos nepažeisti.': ['Kontroller lastestropper og sjakler for skader før bruk.', 'same'],
  'Aptverkite vietą aplink kėlimą.': ['Sperr av stedet rundt løftet.', 'same'],
  'Pavojus: keltuvas apvirsta dėl silpno pagrindo arba per sunkaus krovinio.': ['Fare: heisen velter på grunn av svakt underlag eller for tung last.', diff(['object'], 'Originalen sier «kranen». Tilbakeoversettelsen sier «heisen».', 'The original says "the crane". The back-translation says "the hoist".')],
  'Darbo metu turi būti ne mažiau kaip 3 asmenys.': ['Minst 3 personer skal være til stede under arbeidet.', diff(['numbers'], 'Originalen sier «minst 2 personer». Tilbakeoversettelsen sier «minst 3 personer».', 'The original says "at least 2 people". The back-translation says "at least 3 people".')],
  'Kiekvienas gali būti po pakabintu kroviniu.': ['Alle kan være under hengende last.', diff(['negation'], 'Originalen sier «ingen skal». Tilbakeoversettelsen sier «alle kan».', 'The original says "nobody may". The back-translation says "anyone may".')],
  'Apsauginį šalmą su pasmakrės dirželiu galima dėvėti visą laiką.': ['Hjelm med hakestropp kan brukes hele tiden.', diff(['obligation'], 'Originalen sier «skal brukes». Tilbakeoversettelsen sier «kan brukes».', 'The original says "must be worn". The back-translation says "may be worn".')],
  'Kopėčios gali būti naudojamos ir turi būti apsaugotos nuo slydimo.': ['Stige kan brukes og skal sikres mot å gli.', diff(['condition', 'omission'], 'Originalen sier «bare til kortvarig arbeid». Det mangler i tilbakeoversettelsen.', 'The original says "only for short work". That is missing from the back-translation.')],
  'Aptverkite zoną virš darbo vietos.': ['Sperr av området over arbeidsstedet.', diff(['direction'], 'Originalen sier «under arbeidsstedet». Tilbakeoversettelsen sier «over arbeidsstedet».', 'The original says "below the work area". The back-translation says "above the work area".')],
  'Apdrauskite įrankius ir medžiagas, kad jie negalėtų nukristi.': ['Sikre verktøy og materialer slik at de ikke kan falle ned.', 'same'],
  // Russian seeded errors (added 26 Oct 2026)
  'Там, где нет защитного ограждения, используйте предохранительный пояс, пристёгнутый к утверждённой точке крепления.': ['Bruk sikkerhetsbelte festet til godkjent forankringspunkt der rekkverk mangler.', diff(['object'], 'Originalen sier «fallsikringssele». Tilbakeoversettelsen sier «sikkerhetsbelte».', 'The original says "fall-arrest harness". The back-translation says "safety belt".')],
  'Перед использованием проверьте стяжные ремни и скобы на повреждения.': ['Kontroller spennbånd og sjakler for skader før bruk.', diff(['object'], 'Originalen sier «løftestropper». Tilbakeoversettelsen sier «spennbånd».', 'The original says "lifting slings". The back-translation says "lashing straps".')],
  'Оградите место вокруг подъёма.': ['Sperr av stedet rundt løftet.', 'same'],
  'Опасность: подъёмник опрокидывается из-за слабого основания или слишком тяжёлого груза.': ['Fare: heisen velter på grunn av svakt underlag eller for tung last.', diff(['object'], 'Originalen sier «kranen». Tilbakeoversettelsen sier «heisen».', 'The original says "the crane". The back-translation says "the hoist".')],
  'Во время работы должны присутствовать не менее 3 человек.': ['Minst 3 personer skal være til stede under arbeidet.', diff(['numbers'], 'Originalen sier «minst 2 personer». Tilbakeoversettelsen sier «minst 3 personer».', 'The original says "at least 2 people". The back-translation says "at least 3 people".')],
  'Каждый может находиться под подвешенным грузом.': ['Alle kan oppholde seg under hengende last.', diff(['negation'], 'Originalen sier «ingen skal». Tilbakeoversettelsen sier «alle kan».', 'The original says "nobody may". The back-translation says "anyone may".')],
  'Защитную каску с подбородочным ремнём можно носить всё время.': ['Hjelm med hakestropp kan brukes hele tiden.', diff(['obligation'], 'Originalen sier «skal brukes». Tilbakeoversettelsen sier «kan brukes».', 'The original says "must be worn". The back-translation says "may be worn".')],
  'Приставную лестницу можно использовать, и она должна быть защищена от скольжения.': ['Stige kan brukes og skal sikres mot å gli.', diff(['condition', 'omission'], 'Originalen sier «bare til kortvarig arbeid». Det mangler i tilbakeoversettelsen.', 'The original says "only for short work". That is missing from the back-translation.')],
  'Оградите зону над рабочим местом.': ['Sperr av området over arbeidsstedet.', diff(['direction'], 'Originalen sier «under arbeidsstedet». Tilbakeoversettelsen sier «over arbeidsstedet».', 'The original says "below the work area". The back-translation says "above the work area".')],
  'Застрахуйте инструменты и материалы так, чтобы они не могли упасть.': ['Sikre verktøy og materialer slik at de ikke kan falle ned.', 'same'],
};

/** Register the bench pairs. A control back-translates to its own source; a seeded error uses the table above. */
export function registerBenchPairs(pairs: ScriptedPair[]) {
  for (const p of pairs) {
    const scripted = BENCH[p.target];
    if (scripted) B(p.source, p.lang, p.target, scripted[0], scripted[1]);
    else B(p.source, p.lang, p.target, p.source, 'same');
  }
}

// ---------- P1, P2, P3 ----------
const P1: Record<string, unknown> = {
  'Vi skal løfte 6 bunter med takstoler opp på taket. Løftet går over gangveien ved inngangen, og lasten er lang og tar vind.|': {
    specifics: [
      { text: 'Løft av 6 bunter takstoler opp på taket.', status: 'clear' },
      { text: 'Løftet går over gangveien ved inngangen.', status: 'clear' },
      { text: 'Lasten er lang og utsatt for vind.', status: 'clear' },
    ],
    questions: [],
  },
  'Vi skal skifte takrenner på østsiden. Det er en utsparing i dekket ved trappa, og stillaset står ut mot fortauet.|': {
    specifics: [
      { text: 'Skifte av takrenner på østsiden.', status: 'clear' },
      { text: 'Det er en utsparing i dekket ved trappa.', status: 'clear' },
      { text: 'Stillaset står ut mot fortauet.', status: 'clear' },
    ],
    questions: [],
  },
  'Skal heise opp noen paller m gips t 3 etg, bruker trucken. Litt trangt ved porten, må kanskje ta det over gjerdet?? fikser stroppa selv|': {
    specifics: [
      { text: 'Løft av paller med gipsplater til 3. etasje.', status: 'clear' },
      { text: 'Trang plass ved porten.', status: 'clear' },
      { text: 'Uklart om lasten skal løftes over gjerdet eller tas gjennom porten.', status: 'unclear' },
      { text: 'Uklart hvem som kontrollerer løftestroppene før bruk.', status: 'unclear' },
    ],
    questions: [
      { question: 'Skal lasten løftes over gjerdet, eller tas den gjennom porten?', options: ['Over gjerdet', 'Gjennom porten'] },
      { question: 'Hva betyr «fikser stroppa selv»? Hvem kontrollerer løftestroppene før bruk?', options: ['Anhukeren kontrollerer løftestroppene før bruk', 'De er ikke kontrollert ennå'] },
    ],
  },
  'Skal heise opp noen paller m gips t 3 etg, bruker trucken. Litt trangt ved porten, må kanskje ta det over gjerdet?? fikser stroppa selv|Gjennom porten;Anhukeren kontrollerer løftestroppene før bruk': {
    specifics: [
      { text: 'Løft av paller med gipsplater til 3. etasje.', status: 'clear' },
      { text: 'Trang plass ved porten. Lasten tas gjennom porten, ikke over gjerdet.', status: 'clear' },
      { text: 'Anhukeren kontrollerer løftestroppene før bruk.', status: 'clear' },
    ],
    questions: [],
  },
  'Vi skal lakkere gulvet i en leilighet med 2-komponent lakk. Rommet har bare ett lite vindu.|': {
    specifics: [
      { text: 'Lakkering av gulv i en leilighet med 2-komponent lakk.', status: 'clear' },
      { text: 'Rommet har bare ett lite vindu.', status: 'clear' },
    ],
    questions: [],
  },
  'Vi skal støpe en vegg på 3 meter med pumpe. Betongbilen må rygge inn fra veien, over fortauet.|': {
    specifics: [
      { text: 'Støp av en vegg på 3 meter med betongpumpe.', status: 'clear' },
      { text: 'Betongbilen rygger inn fra veien, over fortauet.', status: 'clear' },
    ],
    questions: [],
  },
  'Vi skal montere takvinduer. Noen må ut på taket utenfor stillaset. Vi heiser vinduene opp med en vinsj.|': {
    specifics: [
      { text: 'Montering av takvinduer.', status: 'clear' },
      { text: 'Arbeid på taket utenfor stillaset.', status: 'clear' },
      { text: 'Vinduene heises opp med vinsj.', status: 'clear' },
    ],
    questions: [],
  },
};

const P2: Record<string, unknown> = {
  'Løft av 6 bunter takstoler opp på taket.': {
    operations: [
      { op: 'modify', lineId: 'l-12', text: S1, hazardRef: 'lh-02' },
      { op: 'add', text: S2, section: 'controls', afterLineId: 'l-11', hazardRef: 'lh-06', critical: true },
      { op: 'add', text: S3, section: 'controls', afterLineId: 'l-14', hazardRef: 'lh-05', critical: true },
    ],
  },
  'Skifte av takrenner på østsiden.': {
    operations: [
      { op: 'add', text: A, section: 'controls', afterLineId: 'h-09', hazardRef: null, critical: true },
      { op: 'modify', lineId: 'h-10', text: Bq, hazardRef: 'hh-04' },
      { op: 'add', text: C, section: 'controls', afterLineId: 'h-12', hazardRef: 'hh-10', critical: false },
    ],
  },
  'Løft av paller med gipsplater til 3. etasje.': { operations: [{ op: 'modify', lineId: 'l-12', text: D, hazardRef: 'lh-02' }] },
  'Lakkering av gulv i en leilighet med 2-komponent lakk.': {
    operations: [
      { op: 'add', text: PV1, section: 'controls', afterLineId: 'p-10', hazardRef: 'pd-08', critical: true },
      { op: 'add', text: PV2, section: 'controls', afterLineId: 'p-24', hazardRef: 'pd-14', critical: true },
    ],
  },
  'Støp av en vegg på 3 meter med betongpumpe.': {
    operations: [{ op: 'add', text: CV1, section: 'controls', afterLineId: 'c-13', hazardRef: 'cd-07', critical: true }],
  },
  'Montering av takvinduer.': {
    operations: [
      { op: 'add', text: E, section: 'controls', afterLineId: 'h-09', hazardRef: 'hh-06', critical: true },
      { op: 'add', text: F, section: 'controls', afterLineId: 'h-11', hazardRef: null, critical: true },
    ],
  },
};

const P3: Record<string, Record<string, unknown>> = {
  [S1]: { status: 'clear' },
  [S2]: { status: 'clear' },
  [S3]: { status: 'clear' },
  [A]: { status: 'clear' },
  [Bq]: { status: 'clear', plain: Bplain },
  [Bplain]: { status: 'clear' },
  [C]: { status: 'clear' },
  [D]: { status: 'clear' },
  [E]: {
    status: 'ambiguous',
    category: 'undefined_condition',
    reasonNb: '«Ved behov» sier ikke når selen skal brukes. Arbeideren kan ikke vite om det gjelder ham.',
    reasonEn: '"If needed" does not say when the harness must be used. The worker cannot tell whether it applies to him.',
    suggestion: Efix,
  },
  [Efix]: { status: 'clear' },
  [F]: { status: 'clear' },
  [PV1]: { status: 'clear' },
  [PV2]: { status: 'clear' },
  [CV1]: { status: 'clear' },
  'Sikre området før løft.': {
    status: 'ambiguous',
    category: 'unclear_actor',
    reasonNb: 'Teksten sier ikke hvordan området skal sikres, hvem som gjør det, eller hvor stort området er.',
    reasonEn: 'The text does not say how the area is to be secured, who does it, or how large the area is.',
    suggestion: 'Anhukeren sperrer av faresonen rundt løftet med sperrebånd før løftet starter.',
  },
};

// ---------- P7: written explanations (U2, U4). Keyed by language and the two texts. ----------
export interface WrittenSample {
  lang: string;
  hazard: string;
  measure: string;
  translation: { hazard: string; measure: string };
}
const p7 = new Map<string, unknown>();
export const p7Key = (lang: string, hazard: string, measure: string) => `${lang}|${hazard}|${measure}`;
export function registerWrittenAnswers(samples: WrittenSample[]) {
  for (const w of samples) {
    p7.set(p7Key(w.lang, w.hazard, w.measure), {
      items: [
        { key: 'hazard', textNb: w.translation.hazard, unreadable: false },
        { key: 'measure', textNb: w.translation.measure, unreadable: false },
      ],
    });
  }
}

export const SCRIPTED_MODEL = 'scripted-demo (no model was called)';

export function scriptedAnswer(task: string, input: unknown): string {
  const miss = (key: string) => new Error(`demo-script: no scripted answer for ${task} "${key}"`);
  if (task === 'P1') {
    const i = input as P1Input;
    const key = `${i.freeText}|${i.answers.map((a) => a.answer).join(';')}`;
    if (!P1[key]) throw miss(key);
    return JSON.stringify(P1[key]);
  }
  if (task === 'P2') {
    const key = (input as P2Input).specifics[0] ?? '';
    if (!P2[key]) throw miss(key);
    return JSON.stringify(P2[key]);
  }
  if (task === 'P3') {
    const i = input as P3Input;
    return JSON.stringify({
      lines: i.lines.map((l) => {
        if (!P3[l.text]) throw miss(l.text);
        return { lineId: l.lineId, ...P3[l.text] };
      }),
    });
  }
  if (task === 'P4') {
    const i = input as P4Input;
    const key = `${i.targetLang}|${i.attempt}|${i.text}`;
    const hit = p4.get(key);
    if (!hit) throw miss(key);
    return JSON.stringify({ text: hit.text, termsUsed: i.glossary.map((g) => g.approved), missingConcepts: hit.missingConcepts });
  }
  if (task === 'P5') {
    const i = input as P5Input;
    const hit = p5.get(`${i.lang}|${i.text}`);
    if (!hit) throw miss(`${i.lang}|${i.text}`);
    return JSON.stringify({ text: hit });
  }
  if (task === 'P7') {
    const i = input as P7Input;
    const text = (k: string) => i.items.find((x) => x.key === k)?.text ?? '';
    const key = p7Key(i.lang, text('hazard'), text('measure'));
    const hit = p7.get(key);
    if (!hit) throw miss(key);
    return JSON.stringify(hit);
  }
  const i = input as P6Input;
  const hit = p6.get(`${i.source}|${i.backTranslation}`);
  if (!hit) throw miss(`${i.source}|${i.backTranslation}`);
  return JSON.stringify(hit);
}

/** Not a model. Used only by `npm run fixtures:demo` to write replay fixtures with origin "scripted". */
export const scriptedProvider: Provider = {
  name: 'scripted',
  async complete(req) {
    return scriptedAnswer(String(req.task), req.input);
  },
};

export const DEMO = { S1, S2, S3, A, Bq, Bplain, C, D, E, Efix, F, PV1, PV2, CV1 };
