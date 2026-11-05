// D4 Supported-language check (plan SC-03): a language is supported if the data
// pack lists it, which requires a glossary column for it. Reviewers affect the
// verification state, not support.
import type { DataPack, Flag } from '../types';
import { LANG_NAMES, makeFlag } from '../util';

export function isSupported(lang: string, pack: DataPack): boolean {
  if (lang === 'nb') return false;
  if (!pack.languages.includes(lang as never)) return false;
  return pack.glossary.some((t) => Boolean(t.byLang[lang as keyof typeof t.byLang]));
}

export function unsupportedFlag(lang: string, lineId = '*'): Flag {
  const name = LANG_NAMES[lang] ?? { nb: lang, en: lang };
  return makeFlag({
    lineId,
    lang,
    type: 'UNSUPPORTED_LANGUAGE',
    severity: 'red',
    raisedBy: 'D4',
    nb: `${name.nb} støttes ikke. Det lages ingen tekst til arbeiderne på dette språket. Tolk kreves.`,
    en: `${name.en} is not supported. No worker-facing text is produced in this language. Interpreter required.`,
  });
}
