import { Component, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Layout, Notice } from './components/ui';
import './index.css';
import Baseline from './screens/Baseline';
import Bench from './screens/Bench';
import Foreman from './screens/Foreman';
import Home from './screens/Home';
import Review from './screens/Review';
import { RunRecordScreen, RunsList } from './screens/Runs';
import { StandaloneQuestions, WorkerKiosk } from './screens/Worker';
import { useApp, useFieldMode } from './state/stores';
import { useT } from './i18n';
import RulesLibrary from './screens/Rules';
import { SummaryScreen } from './screens/Summary';

/** Pages for the project group only. In field mode (V1) they cannot be opened, not even by typing the address. */
function LabOnly({ children }: { children: ReactNode }) {
  const field = useFieldMode();
  const t = useT();
  if (!field) return <>{children}</>;
  return (
    <Layout>
      <div className="space-y-3" data-testid="field-blocked">
        <Notice tone="amber">{t('field.blocked')}</Notice>
        <a href="/" className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">
          {t('nav.home')}
        </a>
      </div>
    </Layout>
  );
}

function App() {
  const load = useApp((s) => s.load);
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    document.documentElement.lang = lang === 'nb' ? 'nb' : 'en';
  }, [lang]);
  // Every screen opens at its top, whatever the scroll position of the screen before it.
  const { pathname, search } = useLocation();
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, and React treats an effect's return value as its clean-up.
    window.scrollTo({ top: 0 });
  }, [pathname, search]);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/foreman/:sjaId" element={<Foreman />} />
      <Route path="/worker/questions/:templateId" element={<LabOnly><StandaloneQuestions /></LabOnly>} />
      <Route path="/worker/:sjaId" element={<WorkerKiosk />} />
      {/* The reviewer address stays open in field mode (V2); it is just not linked from Home. */}
      <Route path="/review" element={<Review />} />
      <Route path="/rules" element={<RulesLibrary />} />
      <Route path="/bench" element={<LabOnly><Bench /></LabOnly>} />
      <Route path="/runs" element={<LabOnly><RunsList /></LabOnly>} />
      <Route path="/runs/:runId" element={<RunRecordScreen />} />
      <Route path="/runs/:runId/summary" element={<SummaryScreen />} />
      <Route path="/baseline" element={<LabOnly><Baseline /></LabOnly>} />
      <Route path="*" element={<Layout><Notice tone="amber">Page not found.</Notice></Layout>} />
    </Routes>
  );
}

/**
 * If a screen fails to draw, reload by itself (up to three times a minute) (most such failures come from the
 * development server swapping code under the page). If it fails again straight after a
 * reload, stop and offer the buttons, so the page cannot reload in a loop.
 */
const RELOAD_KEY = 'sja-forstatt-auto-reloads';
const MAX_AUTO_RELOADS = 3;
/** Reloads in the last minute. More than a few in a row means the screen is really broken: stop, so it cannot loop. */
function recentReloads(): number[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(RELOAD_KEY) ?? '[]') as number[];
    return list.filter((at) => Date.now() - at < 60000);
  } catch {
    return [];
  }
}
function reloadedJustNow(): boolean {
  return recentReloads().length >= MAX_AUTO_RELOADS;
}

class ScreenError extends Component<{ children: ReactNode }, { error: Error | null; reloading: boolean }> {
  state = { error: null as Error | null, reloading: false };
  static getDerivedStateFromError(error: Error) {
    return { error, reloading: !reloadedJustNow() };
  }
  componentDidCatch(error: Error) {
    console.error('Screen failed to draw:', error);
    if (this.state.reloading) {
      try {
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify([...recentReloads(), Date.now()]));
      } catch {
        /* storage blocked: reload anyway */
      }
      window.location.reload();
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.reloading) {
      return <p style={{ maxWidth: 560, margin: '40px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>Reloading …</p>;
    }
    return (
      <div style={{ maxWidth: 560, margin: '40px auto', padding: 16, fontFamily: 'system-ui, sans-serif' }} role="alert">
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>This screen could not be shown.</h1>
        <p style={{ marginTop: 8 }}>It still failed after three automatic reloads. Nothing you saved is lost. Try Reload, or go back to Home.</p>
        <p style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>{this.state.error.message}</p>
        <p style={{ marginTop: 16, display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 8, background: '#1d4ed8', color: 'white', fontWeight: 600 }}>
            Reload
          </button>
          <a href="/" style={{ padding: '10px 16px', fontWeight: 600, color: '#1e40af', textDecoration: 'underline' }}>
            Home
          </a>
        </p>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <ScreenError>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ScreenError>,
);
