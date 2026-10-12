import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BANNER_EN, BANNER_NB } from '../core/types';
import { LangOverride, useT, useUiLang } from '../i18n';
import { useApp } from '../state/stores';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
const variants: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500',
  secondary: 'bg-white text-slate-900 border border-slate-400 hover:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
  danger: 'bg-white text-rose-800 border border-rose-400 hover:bg-rose-50 disabled:text-slate-400 disabled:border-slate-200',
  success: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500',
  ghost: 'text-blue-800 underline underline-offset-2 hover:bg-blue-50 disabled:text-slate-400',
};

/** Tap targets are at least 44 px high (8.4). */
export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-left text-base font-semibold disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '', tone = 'plain' }: { children: ReactNode; className?: string; tone?: 'plain' | 'red' | 'amber' | 'green' | 'blue' | 'quiet' }) {
  const tones = {
    plain: 'bg-white border-slate-200',
    red: 'bg-white border-rose-500 border-l-8',
    amber: 'bg-white border-amber-500 border-l-8',
    green: 'bg-white border-emerald-600 border-l-8',
    blue: 'bg-blue-50 border-blue-200',
    quiet: 'bg-slate-50 border-slate-200',
  };
  return <section className={`print-plain rounded-xl border p-4 shadow-sm ${tones[tone]} ${className}`}>{children}</section>;
}

/** `wrap`: for a chip that holds a sentence, so it cannot push the page wider than a phone. */
export function Chip({ children, tone = 'slate', title, wrap = false }: { children: ReactNode; tone?: 'slate' | 'red' | 'amber' | 'green' | 'blue' | 'violet'; title?: string; wrap?: boolean }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    red: 'bg-rose-50 text-rose-900 border-rose-400',
    amber: 'bg-amber-50 text-amber-900 border-amber-500',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-500',
    blue: 'bg-blue-50 text-blue-900 border-blue-400',
    violet: 'bg-violet-50 text-violet-900 border-violet-400',
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold ${wrap ? 'rounded-lg' : 'whitespace-nowrap rounded-full'} ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-600">{hint}</span>}
      {error && <span className="mt-1 block text-sm font-semibold text-rose-800" data-field-error>{error}</span>}
    </label>
  );
}

export const inputClass = 'block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 py-2 text-base';

export type IconName = 'flag' | 'warn' | 'check' | 'info' | 'voice' | 'clock' | 'x' | 'person' | 'lock' | 'chevron' | 'eye' | 'arrow' | 'doc';

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const paths: Record<string, ReactNode> = {
    flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
    warn: <path d="M12 9v4m0 4h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    info: <path d="M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
    voice: <path d="M4 5h16v11H9l-5 4V5Zm4 4h8M8 12.5h5" />,
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
    person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
    lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6v-9Z" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    doc: <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6" />,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`inline-block shrink-0 ${className}`}>
      {paths[name]}
    </svg>
  );
}

/** Fixed on every screen, record and export (F-16, AC-26). */
export function Banner({ lang }: { lang?: 'nb' | 'en' | 'both' }) {
  const appLang = useUiLang();
  const which = lang ?? appLang;
  return (
    <div role="note" data-testid="prototype-banner" className="bg-amber-300 px-3 py-1.5 text-center text-xs font-bold leading-snug text-slate-950 sm:text-sm">
      {which === 'both' ? (
        <>
          {BANNER_NB} <span className="font-semibold">/ {BANNER_EN}</span>
        </>
      ) : which === 'nb' ? (
        BANNER_NB
      ) : (
        BANNER_EN
      )}
    </div>
  );
}

/** The banner as it appears at the top of every printed page. */
function PrintBanner() {
  const lang = useUiLang();
  return <div className="print-banner">{lang === 'nb' ? BANNER_NB : BANNER_EN}</div>;
}

export function LangToggle() {
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-400" role="group" aria-label="Språk / Language">
      {(['nb', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`min-h-11 min-w-12 px-3 text-sm font-bold ${lang === l ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}`}
        >
          {l === 'nb' ? 'NO' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export function ModeChip() {
  const config = useApp((s) => s.config);
  const t = useT();
  if (!config) return null;
  if (config.mode === 'replay') {
    return (
      <Chip tone="violet" title={t('mode.replayTitle')}>
        {t('mode.replay')}
        {config.fixtures.recorded === 0 ? ` · ${t('mode.scripted')}` : ''}
      </Chip>
    );
  }
  return <Chip tone={config.configured ? 'green' : 'red'}>{config.mode === 'record' ? t('mode.record') : t('mode.live')}{config.configured ? '' : ` · ${t('mode.noKey')}`}</Chip>;
}

function LayoutInner({ children, title, wide, back, english }: { children: ReactNode; title?: string; wide: boolean; back: boolean; english: boolean }) {
  const t = useT();
  const loc = useLocation();
  return (
    <div className="min-h-screen">
      <div className="screen-chrome sticky top-0 z-30">
        <Banner />
        <header className="no-print flex items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {back && loc.pathname !== '/' && (
              <Link to="/" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-blue-800 underline">
                {t('nav.home')}
              </Link>
            )}
            <span className="truncate text-base font-bold">{title ?? 'SJA Forstått'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline-flex">
              <ModeChip />
            </span>
            {english ? <Chip tone="slate">English only</Chip> : <LangToggle />}
          </div>
        </header>
      </div>
      <table className="print-frame">
        <thead>
          <tr>
            <td>
              <PrintBanner />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <main className={`mx-auto px-3 py-4 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>{children}</main>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** `english`: a screen for the group or for reviewers, shown in English whatever the foreman toggle says. */
export function Layout({ children, title, wide = false, back = true, english = false }: { children: ReactNode; title?: string; wide?: boolean; back?: boolean; english?: boolean }) {
  const inner = (
    <LayoutInner title={title} wide={wide} back={back} english={english}>
      {children}
    </LayoutInner>
  );
  return english ? <LangOverride.Provider value="en">{inner}</LangOverride.Provider> : inner;
}

export function Notice({ tone = 'blue', children }: { tone?: 'blue' | 'amber' | 'red' | 'green' | 'violet'; children: ReactNode }) {
  const tones = {
    blue: 'border-blue-300 bg-blue-50 text-blue-950',
    amber: 'border-amber-400 bg-amber-50 text-amber-950',
    red: 'border-rose-400 bg-rose-50 text-rose-950',
    green: 'border-emerald-400 bg-emerald-50 text-emerald-950',
    violet: 'border-violet-300 bg-violet-50 text-violet-950',
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

/**
 * The next action of a screen, kept in view at the bottom of the window so the user
 * never has to scroll to find out what to do next. `note` says why the action is not
 * available yet, or what it leads to.
 */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="no-print sticky bottom-0 z-20 -mx-3 border-t border-slate-300 bg-white/95 px-3 pb-3 pt-2 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] backdrop-blur" data-testid="action-bar">
      {note && <div className="mb-2 text-sm text-slate-800">{note}</div>}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** A section that opens on a tap. Always printed in full, whether open or not. */
export function Collapsible({ title, summary, children, defaultOpen = false, testid }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; testid?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="print-plain rounded-xl border border-slate-200 bg-white shadow-sm" data-testid={testid}>
      <h2>
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left" data-testid={testid ? `${testid}-toggle` : undefined}>
          <span className="min-w-0">
            <span className="block text-lg font-bold">{title}</span>
            {summary && <span className="block text-sm font-normal text-slate-700">{summary}</span>}
          </span>
          <Icon name="chevron" className={`no-print h-5 w-5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      <div className={`px-4 pb-4 ${open ? '' : 'hidden print:block'}`}>{children}</div>
    </section>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-base font-semibold text-slate-800">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="rounded-lg border-2 border-rose-500 bg-rose-50 p-3 text-rose-950">
      <p className="flex items-start gap-2 font-semibold">
        <Icon name="warn" /> <span>{message}</span>
      </p>
      {onRetry && (
        <Button variant="danger" className="mt-2" onClick={onRetry}>
          {retryLabel ?? 'Retry'}
        </Button>
      )}
    </div>
  );
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
