// Two-key verification (specification 10.4; plan SC-04). The state is derived, never stored.
import type { DataPack, KeyState, Lang, ReviewerSession, VerificationState } from './types';
import { deriveStems } from './rules/glossary';

export const NO_KEY: KeyState = { given: false };

export function deriveState(keyLanguage: KeyState | undefined, keyTechnical: KeyState | undefined): VerificationState {
  const l = Boolean(keyLanguage?.given);
  const t = Boolean(keyTechnical?.given);
  if (l && t) return 'verified';
  if (l) return 'languageChecked';
  if (t) return 'technicallyChecked';
  return 'draft';
}

export function keyFrom(session: ReviewerSession, date: string): KeyState {
  return { given: true, role: session.role, outsideGroup: session.outsideGroup, date };
}

export type ItemRef =
  | { kind: 'line'; templateId: string; lineId: string }
  | { kind: 'term'; termId: string }
  | { kind: 'question'; templateId: string; questionId: string };

function findLine(pack: DataPack, ref: { templateId: string; lineId: string }) {
  return pack.templates.find((t) => t.templateId === ref.templateId)?.lines.find((l) => l.lineId === ref.lineId);
}
function findQuestion(pack: DataPack, ref: { templateId: string; questionId: string }) {
  return pack.templates.find((t) => t.templateId === ref.templateId)?.questions.find((q) => q.questionId === ref.questionId);
}

/** An approval sets exactly one key: the one that matches the reviewer's role (AC-20). */
export function approve(pack: DataPack, ref: ItemRef, session: ReviewerSession, date: string): void {
  const key = keyFrom(session, date);
  if (ref.kind === 'line') {
    const line = findLine(pack, ref);
    if (!line) return;
    if (session.role === 'technical') line.keyTechnical = key;
    else if (line.translations[session.lang]) line.translations[session.lang]!.keyLanguage = key;
  } else if (ref.kind === 'term') {
    const term = pack.glossary.find((t) => t.termId === ref.termId);
    if (!term) return;
    if (session.role === 'technical') term.keyTechnical = key;
    else if (term.byLang[session.lang]) term.byLang[session.lang]!.keyLanguage = key;
  } else {
    const q = findQuestion(pack, ref);
    if (!q) return;
    if (session.role === 'technical') q.keyTechnical = key;
    else if (q.byLang[session.lang]) q.byLang[session.lang]!.keyLanguage = key;
  }
}

/** Reject: withdraw the reviewer's own key (the item goes back towards Draft). */
export function reject(pack: DataPack, ref: ItemRef, session: ReviewerSession): void {
  if (ref.kind === 'line') {
    const line = findLine(pack, ref);
    if (!line) return;
    if (session.role === 'technical') line.keyTechnical = { ...NO_KEY };
    else if (line.translations[session.lang]) line.translations[session.lang]!.keyLanguage = { ...NO_KEY };
  } else if (ref.kind === 'term') {
    const term = pack.glossary.find((t) => t.termId === ref.termId);
    if (!term) return;
    if (session.role === 'technical') term.keyTechnical = { ...NO_KEY };
    else if (term.byLang[session.lang]) term.byLang[session.lang]!.keyLanguage = { ...NO_KEY };
  } else {
    const q = findQuestion(pack, ref);
    if (!q) return;
    if (session.role === 'technical') q.keyTechnical = { ...NO_KEY };
    else if (q.byLang[session.lang]) q.byLang[session.lang]!.keyLanguage = { ...NO_KEY };
  }
}

/** Editing the Norwegian source clears the technical key and every language key (SC-04). */
export function editSourceLine(pack: DataPack, ref: { templateId: string; lineId: string }, textNb: string): void {
  const line = findLine(pack, ref);
  if (!line || line.textNb === textNb) return;
  line.textNb = textNb;
  line.keyTechnical = { ...NO_KEY };
  for (const lang of Object.keys(line.translations) as Lang[]) {
    line.translations[lang]!.keyLanguage = { ...NO_KEY };
  }
}

/**
 * Editing a target text. A correction by the language reviewer of that language is
 * itself an approval: it sets that language's key and leaves the technical key.
 * An edit by anyone else clears that language's key (SC-04).
 */
export function editTargetLine(
  pack: DataPack,
  ref: { templateId: string; lineId: string },
  lang: Lang,
  text: string,
  session: ReviewerSession | null,
  date: string,
): void {
  const line = findLine(pack, ref);
  if (!line) return;
  const isLanguageReviewer = session?.role === 'language' && session.lang === lang;
  const current = line.translations[lang];
  if (current && current.text === text && !isLanguageReviewer) return;
  line.translations[lang] = {
    text,
    keyLanguage: isLanguageReviewer && session ? keyFrom(session, date) : { ...NO_KEY },
  };
}

/** A correction to a glossary term: new approved term, stems re-derived, old term kept as an accepted alternative. */
export function editGlossaryTerm(
  pack: DataPack,
  termId: string,
  lang: Lang,
  patch: { approved?: string; stems?: string[]; forbidden?: string[] },
  session: ReviewerSession | null,
  date: string,
): void {
  const term = pack.glossary.find((t) => t.termId === termId);
  const entry = term?.byLang[lang];
  if (!term || !entry) return;
  const isLanguageReviewer = session?.role === 'language' && session.lang === lang;
  if (patch.approved !== undefined && patch.approved !== entry.approved) {
    entry.approved = patch.approved;
    if (patch.stems === undefined) entry.stems = deriveStems(patch.approved);
  }
  if (patch.stems !== undefined) entry.stems = patch.stems;
  if (patch.forbidden !== undefined) entry.forbidden = patch.forbidden;
  entry.keyLanguage = isLanguageReviewer && session ? keyFrom(session, date) : { ...NO_KEY };
}

export function editQuestion(
  pack: DataPack,
  ref: { templateId: string; questionId: string },
  lang: Lang,
  patch: { text: string; options: string[] },
  session: ReviewerSession | null,
  date: string,
): void {
  const q = findQuestion(pack, ref);
  const entry = q?.byLang[lang];
  if (!q || !entry) return;
  const isLanguageReviewer = session?.role === 'language' && session.lang === lang;
  entry.text = patch.text;
  entry.options = patch.options;
  if (lang === 'nb') {
    // The Norwegian question is the source: every key goes.
    q.keyTechnical = { ...NO_KEY };
    for (const l of Object.keys(q.byLang) as Lang[]) q.byLang[l]!.keyLanguage = { ...NO_KEY };
  } else {
    entry.keyLanguage = isLanguageReviewer && session ? keyFrom(session, date) : { ...NO_KEY };
  }
}

export interface VerificationSummaryRow {
  kind: 'line' | 'term' | 'question';
  id: string;
  lang: Lang | '-';
  role: 'language' | 'technical';
  outsideGroup: boolean;
  date: string;
}

/** Who holds which key, by role, and whether they are outside the group (F-15). */
export function verificationSummary(pack: DataPack): { rows: VerificationSummaryRow[]; counts: Record<string, Record<VerificationState, number>> } {
  const rows: VerificationSummaryRow[] = [];
  const counts: Record<string, Record<VerificationState, number>> = {};
  const bump = (bucket: string, s: VerificationState) => {
    counts[bucket] ??= { draft: 0, languageChecked: 0, technicallyChecked: 0, verified: 0 };
    counts[bucket][s] += 1;
  };
  const push = (kind: VerificationSummaryRow['kind'], id: string, lang: Lang | '-', key: KeyState) => {
    if (key.given && key.role) rows.push({ kind, id, lang, role: key.role, outsideGroup: Boolean(key.outsideGroup), date: key.date ?? '' });
  };
  for (const t of pack.templates) {
    for (const l of t.lines) {
      push('line', `${t.templateId}/${l.lineId}`, '-', l.keyTechnical);
      for (const lang of pack.languages) {
        const tr = l.translations[lang];
        if (!tr) continue;
        push('line', `${t.templateId}/${l.lineId}`, lang, tr.keyLanguage);
        bump(`lines.${lang}`, deriveState(tr.keyLanguage, l.keyTechnical));
      }
    }
    for (const q of t.questions) {
      push('question', `${t.templateId}/${q.questionId}`, '-', q.keyTechnical);
      for (const lang of pack.languages) {
        const e = q.byLang[lang];
        if (!e) continue;
        push('question', `${t.templateId}/${q.questionId}`, lang, e.keyLanguage);
        bump(`questions.${lang}`, deriveState(e.keyLanguage, q.keyTechnical));
      }
    }
  }
  for (const term of pack.glossary) {
    push('term', term.termId, '-', term.keyTechnical);
    for (const lang of pack.languages) {
      const e = term.byLang[lang];
      if (!e) continue;
      push('term', term.termId, lang, e.keyLanguage);
      bump(`glossary.${lang}`, deriveState(e.keyLanguage, term.keyTechnical));
    }
  }
  return { rows, counts };
}
