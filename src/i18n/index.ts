// All interface strings live in this folder, one table per language, so that a
// native speaker can check them in one pass (8.4).
import { createContext, useCallback, useContext } from 'react';
import { useApp } from '../state/stores';
import { en, workerEn } from './en';
import { workerLt } from './lt';
import { nb } from './nb';
import { workerPl } from './pl';
import { workerRu } from './ru';

export type Key = keyof typeof nb;
export type UiLang = 'nb' | 'en';
const tables: Record<UiLang, Record<Key, string>> = { nb, en };

export function translate(lang: UiLang, key: Key | string, vars?: Record<string, string | number>): string {
  let s = (tables[lang] as Record<string, string>)[key] ?? (nb as Record<string, string>)[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Screens for the group and for reviewers are in English only; they set this override. */
export const LangOverride = createContext<UiLang | null>(null);

export function useUiLang(): UiLang {
  const stored = useApp((s) => s.lang);
  // The clean view keeps the NO/EN choice (decided 26 Oct): English help lines then show as in the full view.
  return useContext(LangOverride) ?? stored;
}

/** Foreman-facing strings: Norwegian with an English toggle. */
export function useT() {
  const lang = useUiLang();
  return useCallback((key: Key | string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}

export type WorkerKey = keyof typeof workerEn;
const workerTables: Record<string, Record<WorkerKey, string>> = { en: workerEn, pl: workerPl, lt: workerLt, ru: workerRu };

/** Worker-facing strings: the worker's language only. */
export function workerT(lang: string) {
  const table = workerTables[lang] ?? workerEn;
  return (key: WorkerKey, vars?: Record<string, string | number>) => {
    let s = table[key];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
