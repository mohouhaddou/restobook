import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Activity, BarChart3, Bell, Bot, Boxes, CalendarDays, ClipboardList, Cpu, FileImage, FileText, HeartPulse, Languages, Layers3, LayoutDashboard, Menu, MessageSquareText, Moon, PanelLeftClose, PlaySquare, Plug, Search, Settings2, ShieldCheck, Sparkles, Sun, TerminalSquare, Video, WandSparkles, Workflow, X, UploadCloud, type LucideIcon } from 'lucide-react';
import { AI18nProvider, useAI18n } from './i18n';
import type { Job, Theme } from './types';
import { mockAIService } from './services/mockAIService';
import { GlobalProgressBar, NotificationCenter, SearchBar, SystemStatus } from './components/Widgets';
import { ErrorBoundary, LoadingState } from './components/States';
import { FloatingActionButton, NewJobWizard } from './components/Operations';
import * as Pages from './pages/Pages';
import AIPackageImportPage from '../ai-package-import/AIPackageImportPage';
import './ai-command-center.css';

interface NavigationGroup { label: string; items: readonly (readonly [string, string, LucideIcon])[]; }
const navGroups: readonly NavigationGroup[] = [
  { label: 'Pilotage', items: [['', 'Dashboard', LayoutDashboard], ['jobs', 'Jobs', ClipboardList], ['queue', 'Queue', Layers3], ['planning', 'Planning', CalendarDays]] },
  { label: 'Intelligence', items: [['editors', 'Éditeurs', Bot], ['providers', 'Providers', Boxes], ['models', 'Modèles', Cpu], ['workflows', 'Workflows', Workflow], ['scheduler', 'Scheduler', PlaySquare]] },
  { label: 'Contenu', items: [['imports', 'Imports', UploadCloud], ['publications', 'Publications', FileText], ['images', 'Images', FileImage], ['videos', 'Vidéos', Video], ['seo', 'SEO', Search], ['analytics', 'Analytics', BarChart3]] },
  { label: 'Bibliothèque', items: [['templates', 'Templates', WandSparkles], ['prompts', 'Prompts', MessageSquareText]] },
  { label: 'Système', items: [['logs', 'Logs', TerminalSquare], ['audit', 'Audit', ShieldCheck], ['health', 'Health', HeartPulse], ['settings', 'Settings', Settings2], ['plugins', 'Plugins', Plug]] }
];

function CommandCenter() {
  const { locale, setLocale } = useAI18n();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const [theme, setTheme] = useState<Theme>('dark');
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notices, setNotices] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [search, setSearch] = useState('');
  const [createdJobs, setCreatedJobs] = useState<Job[]>([]);

  useEffect(() => { setMobileNav(false); document.querySelector<HTMLElement>('.ai-main')?.focus(); }, [location.pathname]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('.ai-search input')?.focus(); }
      if (event.key === 'Escape') { setWizard(false); setNotices(false); setMobileNav(false); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const searchResults = useMemo(() => search.trim() ? navGroups.flatMap((group) => group.items).filter((item) => item[1].toLowerCase().includes(search.toLowerCase())) : [], [search]);
  const createJob = async (input: Parameters<typeof mockAIService.createJob>[0]) => { const job = await mockAIService.createJob(input); setCreatedJobs((current) => [job, ...current]); };

  return <div className={`ai-command-center ai-theme--${theme}${collapsed ? ' ai-sidebar-collapsed' : ''}`} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <a href="#ai-main" className="ai-skip-link">Aller au contenu</a><GlobalProgressBar />
    <aside className={`ai-sidebar${mobileNav ? ' is-open' : ''}`}>
      <div className="ai-brand"><span><Sparkles /></span><div><strong>iFilino</strong><small>AI Command</small></div><button className="ai-icon-button ai-sidebar-close" onClick={() => setMobileNav(false)} aria-label="Fermer la navigation"><X /></button></div>
      <nav aria-label="Navigation AI Command Center">{navGroups.map((group) => <div className="ai-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([path, label, Icon]) => <NavLink end={path === ''} key={path} to={`/dashboard/ai${path ? `/${path}` : ''}`} title={label}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}</div>)}</nav>
      <div className="ai-sidebar-footer"><SystemStatus /><button className="ai-collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Déployer la navigation' : 'Réduire la navigation'}><PanelLeftClose /><span>Réduire</span></button></div>
    </aside>
    {mobileNav && <button className="ai-nav-scrim" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}
    <div className="ai-shell">
      <header className="ai-topbar"><button className="ai-icon-button ai-mobile-menu" onClick={() => setMobileNav(true)} aria-label="Ouvrir la navigation"><Menu /></button><SearchBar value={search} onChange={setSearch} /><div className="ai-topbar-actions"><label className="ai-language"><Languages /><span className="visually-hidden">Langue</span><select value={locale} onChange={(event) => setLocale(event.target.value as 'fr' | 'en' | 'ar')}><option value="fr">FR</option><option value="en">EN</option><option value="ar">AR</option></select></label><button className="ai-icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}>{theme === 'dark' ? <Sun /> : <Moon />}</button><button className="ai-icon-button ai-notice-button" onClick={() => setNotices(!notices)} aria-label="Notifications"><Bell /><span>3</span></button><div className="ai-avatar" title="Nadia B.">NB</div></div>{searchResults.length > 0 && <div className="ai-search-results">{searchResults.map(([path, label, Icon]) => <NavLink key={path} to={`/dashboard/ai${path ? `/${path}` : ''}`} onClick={() => setSearch('')}><Icon />{label}</NavLink>)}</div>}</header>
      <main id="ai-main" className="ai-main" tabIndex={-1}>
        {createdJobs.length > 0 && <div className="ai-toast" role="status"><CheckIcon />Job {createdJobs[0].id} créé avec succès.</div>}
        <ErrorBoundary><AnimatePresence mode="wait"><motion.div key={location.pathname} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={{ duration: 0.2 }}><Suspense fallback={<LoadingState />}>
          <Routes>
            <Route index element={<Pages.DashboardPage onNewJob={() => setWizard(true)} />} /><Route path="jobs" element={<Pages.JobsPage />} /><Route path="queue" element={<Pages.QueuePage />} /><Route path="planning" element={<Pages.PlanningPage />} />
            <Route path="editors" element={<Pages.EditorsPage />} /><Route path="providers" element={<Pages.ProvidersPage />} /><Route path="models" element={<Pages.ModelsPage />} /><Route path="workflows" element={<Pages.WorkflowsPage />} /><Route path="scheduler" element={<Pages.SchedulerPage />} />
            <Route path="imports" element={<AIPackageImportPage />} /><Route path="publications" element={<Pages.PublicationsPage />} /><Route path="images" element={<Pages.ImagesPage />} /><Route path="videos" element={<Pages.VideosPage />} /><Route path="seo" element={<Pages.SeoPage />} /><Route path="analytics" element={<Pages.AnalyticsPage />} />
            <Route path="templates" element={<Pages.TemplatesPage />} /><Route path="prompts" element={<Pages.PromptsPage />} /><Route path="logs" element={<Pages.LogsPage />} /><Route path="audit" element={<Pages.AuditPage />} /><Route path="health" element={<Pages.HealthPage />} /><Route path="settings" element={<Pages.SettingsPage />} /><Route path="plugins" element={<Pages.PluginsPage />} />
            <Route path="*" element={<Navigate to="/dashboard/ai" replace />} />
          </Routes>
        </Suspense></motion.div></AnimatePresence></ErrorBoundary>
      </main>
    </div>
    <NotificationCenter open={notices} onClose={() => setNotices(false)} /><FloatingActionButton onClick={() => setWizard(true)} /><NewJobWizard open={wizard} onClose={() => setWizard(false)} onCreate={createJob} />
  </div>;
}

function CheckIcon() { return <Activity aria-hidden="true" />; }
export default function AICommandCenter() { return <AI18nProvider><CommandCenter /></AI18nProvider>; }
