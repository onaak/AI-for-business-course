// Wording of the SJA document (5 Nov 2026): one section per language, so each section reads
// on its own in the language it is written in. DRAFT: written by the builder; the Polish,
// Lithuanian and Russian lines have not been checked by native speakers.
export type DocLang = 'nb' | 'en' | 'pl' | 'lt' | 'ru';

export interface DocWords {
  title: string;
  original: string;
  translated: string;
  job: string;
  date: string;
  site: string;
  newToday: string;
  critical: string;
  confirmedTitle: string;
  readAloud: string;
  foreman: string;
  worker: string;
  orally: string;
  noneConfirmed: string;
  signTitle: string;
  signHint: string;
  role: string;
  name: string;
  signature: string;
  time: string;
  contents: string;
  footer: string;
}

export const DOC_WORDS: Record<DocLang, DocWords> = {
  nb: {
    title: 'Sikker jobbanalyse (SJA)',
    original: 'Originalen, på norsk.',
    translated: '',
    job: 'Jobb',
    date: 'Dato',
    site: 'Sted',
    newToday: 'Nytt i dag',
    critical: 'Sikkerhetskritisk',
    confirmedTitle: 'Bekreftet digitalt',
    readAloud: 'SJA-en lest høyt for laget',
    foreman: 'Bas, signert',
    worker: 'Arbeider {n}',
    orally: 'muntlig til basen',
    noneConfirmed: 'Ingen arbeider har bekreftet på dette språket.',
    signTitle: 'Navn og underskrift',
    signHint: 'Skrives for hånd. Verktøyet lagrer ingen navn.',
    role: 'Rolle',
    name: 'Navn',
    signature: 'Underskrift',
    time: 'Tid',
    contents: 'Innhold',
    footer: 'Laget med SJA Forstått.',
  },
  en: {
    title: 'Safe job analysis (SJA)',
    original: '',
    translated: 'Translated from Norwegian. If in doubt, the Norwegian text applies.',
    job: 'Job',
    date: 'Date',
    site: 'Site',
    newToday: 'New today',
    critical: 'Safety-critical',
    confirmedTitle: 'Confirmed digitally',
    readAloud: 'SJA read aloud to the crew',
    foreman: 'Foreman, signed',
    worker: 'Worker {n}',
    orally: 'orally to the foreman',
    noneConfirmed: 'No worker confirmed in this language.',
    signTitle: 'Name and signature',
    signHint: 'Written by hand. The tool stores no names.',
    role: 'Role',
    name: 'Name',
    signature: 'Signature',
    time: 'Time',
    contents: 'Contents',
    footer: 'Made with SJA Forstått.',
  },
  pl: {
    title: 'Analiza bezpieczeństwa pracy (SJA)',
    original: '',
    translated: 'Przetłumaczono z norweskiego. W razie wątpliwości obowiązuje tekst norweski.',
    job: 'Praca',
    date: 'Data',
    site: 'Miejsce',
    newToday: 'Nowe dzisiaj',
    critical: 'Ważne dla bezpieczeństwa',
    confirmedTitle: 'Potwierdzone cyfrowo',
    readAloud: 'SJA odczytana na głos zespołowi',
    foreman: 'Brygadzista, podpisał',
    worker: 'Pracownik {n}',
    orally: 'ustnie brygadziście',
    noneConfirmed: 'Żaden pracownik nie potwierdził w tym języku.',
    signTitle: 'Imię i nazwisko oraz podpis',
    signHint: 'Wpisuje się ręcznie. Narzędzie nie zapisuje nazwisk.',
    role: 'Rola',
    name: 'Imię i nazwisko',
    signature: 'Podpis',
    time: 'Godzina',
    contents: 'Spis treści',
    footer: 'Przygotowano w SJA Forstått.',
  },
  lt: {
    title: 'Saugaus darbo analizė (SJA)',
    original: '',
    translated: 'Išversta iš norvegų kalbos. Kilus abejonių, galioja norvegiškas tekstas.',
    job: 'Darbas',
    date: 'Data',
    site: 'Vieta',
    newToday: 'Nauja šiandien',
    critical: 'Svarbu saugai',
    confirmedTitle: 'Patvirtinta skaitmeniniu būdu',
    readAloud: 'SJA garsiai perskaityta brigadai',
    foreman: 'Brigadininkas, pasirašė',
    worker: 'Darbuotojas {n}',
    orally: 'žodžiu brigadininkui',
    noneConfirmed: 'Nė vienas darbuotojas nepatvirtino šia kalba.',
    signTitle: 'Vardas, pavardė ir parašas',
    signHint: 'Įrašoma ranka. Įrankis vardų neišsaugo.',
    role: 'Vaidmuo',
    name: 'Vardas, pavardė',
    signature: 'Parašas',
    time: 'Laikas',
    contents: 'Turinys',
    footer: 'Parengta su SJA Forstått.',
  },
  ru: {
    title: 'Анализ безопасности работ (SJA)',
    original: '',
    translated: 'Переведено с норвежского. В случае сомнений действует норвежский текст.',
    job: 'Работа',
    date: 'Дата',
    site: 'Место',
    newToday: 'Новое сегодня',
    critical: 'Важно для безопасности',
    confirmedTitle: 'Подтверждено в цифровом виде',
    readAloud: 'SJA зачитан бригаде вслух',
    foreman: 'Бригадир, подписал',
    worker: 'Работник {n}',
    orally: 'устно бригадиру',
    noneConfirmed: 'Ни один работник не подтвердил на этом языке.',
    signTitle: 'Имя и подпись',
    signHint: 'Заполняется от руки. Инструмент не сохраняет имена.',
    role: 'Роль',
    name: 'Имя',
    signature: 'Подпись',
    time: 'Время',
    contents: 'Содержание',
    footer: 'Подготовлено в SJA Forstått.',
  },
};

export const docWords = (lang: string): DocWords => DOC_WORDS[(lang in DOC_WORDS ? lang : 'en') as DocLang];
