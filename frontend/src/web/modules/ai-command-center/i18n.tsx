import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale } from './types';

const messages = {
  fr: { commandCenter: 'AI Command Center', overview: 'Vue d’ensemble', newJob: 'Nouveau Job IA', search: 'Rechercher partout…', systemOnline: 'Système opérationnel', jobs: 'Jobs', queue: 'File d’attente', planning: 'Planning', editors: 'Éditeurs', providers: 'Providers', workflows: 'Workflows', publications: 'Publications', health: 'Santé système' },
  en: { commandCenter: 'AI Command Center', overview: 'Overview', newJob: 'New AI Job', search: 'Search everywhere…', systemOnline: 'System operational', jobs: 'Jobs', queue: 'Queue', planning: 'Planning', editors: 'Editors', providers: 'Providers', workflows: 'Workflows', publications: 'Publications', health: 'System health' },
  ar: { commandCenter: 'مركز قيادة الذكاء الاصطناعي', overview: 'نظرة عامة', newJob: 'مهمة ذكاء جديدة', search: 'ابحث في كل مكان…', systemOnline: 'النظام يعمل', jobs: 'المهام', queue: 'قائمة الانتظار', planning: 'التخطيط', editors: 'المحررون', providers: 'المزودون', workflows: 'سير العمل', publications: 'المنشورات', health: 'صحة النظام' }
} as const;

type MessageKey = keyof typeof messages.fr;
interface I18nValue { locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string; }
const I18nContext = createContext<I18nValue | null>(null);

export function AI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('fr');
  const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey) => messages[locale][key] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useAI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useAI18n must be used inside AI18nProvider');
  return value;
}
