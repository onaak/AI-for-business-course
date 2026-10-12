// Lithuanian worker-facing strings.
// DRAFT: written by the builder. No native Lithuanian speaker has checked this table.
import type { workerEn } from './en';

export const workerLt: Record<keyof typeof workerEn, string> = {
  banner: 'Studentų prototipas. Sintetinis turinys. Tai nėra galiojanti SJA. Nenaudoti tikram darbui planuoti ar atlikti.',
  readFirst: 'Pirmiausia perskaitykite. Tada savo žodžiais paaiškinsite brigadininkui ir atsakysite į vieną klausimą.',
  newToday: 'Nauja arba pakeista šiandien',
  wholeSja: 'Visa SJA',
  section_steps: 'Darbo etapai',
  section_hazards: 'Pavojai',
  section_controls: 'Ką darome, kad būtų saugu',
  section_ppe: 'Asmeninės apsaugos priemonės',
  section_stop: 'Kada stabdome darbą',
  section_emergency: 'Nelaimės atveju',
  important: 'Svarbu saugai',
  oralPoint: 'Šį punktą jums paaiškins brigadininkas.',
  readDone: 'Perskaičiau. Toliau.',
  explainTitle: 'Savo žodžiais paaiškinkite brigadininkui:',
  explainHazard: 'Kas šiandien šiame darbe pavojingiausia?',
  explainMeasure: 'Ką darome, kad būtų saugu?',
  explainHint: 'Tai ne egzaminas. Jei kas nors neaišku, brigadininkas paaiškins dar kartą.',
  oneQuestion: 'Vienas klausimas',
  questionOf: '{n} klausimas iš {total}',
  correct: 'Teisingai.',
  talkToForeman: 'Prieš pradėdami darbą, aptarkite šį punktą su brigadininku.',
  next: 'Toliau',
  done: 'Baigta. Ačiū.',
  passOn: 'Perduokite įrenginį kitam žmogui.',
  passBack: 'Grąžinkite telefoną brigadininkui.',
  nextWorker: 'Kitas darbuotojas',
};
