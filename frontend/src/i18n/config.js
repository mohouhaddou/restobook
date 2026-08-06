import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import commonFr from './locales/fr/common.json';
import authFr from './locales/fr/auth.json';
import marketplaceFr from './locales/fr/marketplace.json';
import ordersFr from './locales/fr/orders.json';
import dashboardFr from './locales/fr/dashboard.json';
import settingsFr from './locales/fr/settings.json';
import validationFr from './locales/fr/validation.json';
import notificationsFr from './locales/fr/notifications.json';
import checkoutFr from './locales/fr/checkout.json';
import paymentsFr from './locales/fr/payments.json';
import deliveryFr from './locales/fr/delivery.json';
import businessFr from './locales/fr/business.json';
import playFr from './locales/fr/play.json';
import gaminghubFr from './locales/fr/gaminghub.json';
import adsFr from './locales/fr/ads.json';
import portalsFr from './locales/fr/portals.json';
import commonAr from './locales/ar/common.json';
import authAr from './locales/ar/auth.json';
import marketplaceAr from './locales/ar/marketplace.json';
import ordersAr from './locales/ar/orders.json';
import dashboardAr from './locales/ar/dashboard.json';
import settingsAr from './locales/ar/settings.json';
import validationAr from './locales/ar/validation.json';
import notificationsAr from './locales/ar/notifications.json';
import checkoutAr from './locales/ar/checkout.json';
import paymentsAr from './locales/ar/payments.json';
import deliveryAr from './locales/ar/delivery.json';
import businessAr from './locales/ar/business.json';
import playAr from './locales/ar/play.json';
import gaminghubAr from './locales/ar/gaminghub.json';
import adsAr from './locales/ar/ads.json';
import portalsAr from './locales/ar/portals.json';
import commonEn from './locales/en/common.json';
import authEn from './locales/en/auth.json';
import marketplaceEn from './locales/en/marketplace.json';
import ordersEn from './locales/en/orders.json';
import dashboardEn from './locales/en/dashboard.json';
import settingsEn from './locales/en/settings.json';
import validationEn from './locales/en/validation.json';
import notificationsEn from './locales/en/notifications.json';
import checkoutEn from './locales/en/checkout.json';
import paymentsEn from './locales/en/payments.json';
import deliveryEn from './locales/en/delivery.json';
import businessEn from './locales/en/business.json';
import playEn from './locales/en/play.json';
import gaminghubEn from './locales/en/gaminghub.json';
import adsEn from './locales/en/ads.json';
import portalsEn from './locales/en/portals.json';

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
export const LANGUAGE_STORAGE_KEY = 'ifilino_language';

export const LANGUAGE_OPTIONS = [
  { code: 'ar', nativeName: 'العربية', label: 'Arabic', dir: 'rtl', locale: 'ar-MA' },
  { code: 'fr', nativeName: 'Français', label: 'French', dir: 'ltr', locale: 'fr-MA' },
  { code: 'en', nativeName: 'English', label: 'English', dir: 'ltr', locale: 'en-MA' },
];

const resources = {
  fr: { ...commonFr, ...authFr, ...marketplaceFr, ...ordersFr, ...dashboardFr, ...settingsFr, ...validationFr, ...notificationsFr, ...checkoutFr, ...paymentsFr, ...deliveryFr, ...businessFr, ...playFr, ...gaminghubFr, ...adsFr, ...portalsFr },
  ar: { ...commonAr, ...authAr, ...marketplaceAr, ...ordersAr, ...dashboardAr, ...settingsAr, ...validationAr, ...notificationsAr, ...checkoutAr, ...paymentsAr, ...deliveryAr, ...businessAr, ...playAr, ...gaminghubAr, ...adsAr, ...portalsAr },
  en: { ...commonEn, ...authEn, ...marketplaceEn, ...ordersEn, ...dashboardEn, ...settingsEn, ...validationEn, ...notificationsEn, ...checkoutEn, ...paymentsEn, ...deliveryEn, ...businessEn, ...playEn, ...gaminghubEn, ...adsEn, ...portalsEn },
};

const I18nContext = createContext(null);
const missingKeys = new Set();

// Traduction indépendante du contexte global — pour les pages dont la langue est pilotée par la
// route (/kids/:lang/...) plutôt que par la préférence de site globale (voir pages/kids/i18n.js).
// Mêmes ressources/interpolation que `t()` ci-dessous, sans dépendre du Provider.
export function translate(language, key, params) {
  const lang = normalizeLanguage(language);
  const value = resources[lang]?.[key] ?? resources[DEFAULT_LANGUAGE]?.[key];
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn('[i18n] missing key', { language: lang, key });
    return import.meta.env.PROD ? '' : '[' + key + ']';
  }
  return interpolate(value, params);
}

export function normalizeLanguage(value) {
  const lang = String(value || '').toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

export function isRtlLanguage(lang) {
  return normalizeLanguage(lang) === 'ar';
}

export function getStoredLanguage() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored ? normalizeLanguage(stored) : null;
  } catch {
    return null;
  }
}

function getBrowserLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  return normalizeLanguage(navigator.languages?.[0] || navigator.language || DEFAULT_LANGUAGE);
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (
    params[key] === undefined || params[key] === null ? '' : String(params[key])
  ));
}

export function I18nProvider({ children }) {
  const auth = useAuth?.();
  const customerAuth = useCustomerAuth?.();
  const profileLanguage = auth?.user?.preferred_language || customerAuth?.user?.preferred_language;
  const [language, setLanguageState] = useState(() => (
    normalizeLanguage(profileLanguage || getStoredLanguage() || getBrowserLanguage())
  ));

  useEffect(() => {
    const next = normalizeLanguage(profileLanguage || getStoredLanguage() || language);
    if (next !== language) setLanguageState(next);
  }, [profileLanguage]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = isRtlLanguage(language) ? 'rtl' : 'ltr';
    document.body?.setAttribute('dir', isRtlLanguage(language) ? 'rtl' : 'ltr');
  }, [language]);

  const persistProfileLanguage = useCallback(async (next) => {
    const body = JSON.stringify({ preferred_language: next });
    if (auth?.token && auth?.user) {
      const res = await fetch(API('/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        auth.updateUser?.(data.user || { preferred_language: next });
      }
      return;
    }
    if (customerAuth?.token && customerAuth?.user) {
      const res = await fetch(API('/marketplace/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAuth.token}` },
        body,
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        customerAuth.updateCustomer?.(data.user || { preferred_language: next });
      }
    }
  }, [auth?.token, auth?.user, auth?.updateUser, customerAuth?.token, customerAuth?.user, customerAuth?.updateCustomer]);

  const setLanguage = useCallback(async (value) => {
    const next = normalizeLanguage(value);
    setLanguageState(next);
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch {}
    persistProfileLanguage(next).catch(() => {});
  }, [persistProfileLanguage]);

  const t = useCallback((key, params) => {
    const value = resources[language]?.[key] ?? resources[DEFAULT_LANGUAGE]?.[key];
    if (value === undefined) {
      const marker = String(language) + ':' + String(key);
      if (import.meta.env.DEV && !missingKeys.has(marker)) {
        missingKeys.add(marker);
        console.warn('[i18n] missing key', { language, key });
      }
      return import.meta.env.PROD ? '' : '[' + key + ']';
    }
    return interpolate(value, params);
  }, [language]);

  const formatters = useMemo(() => {
    const locale = LANGUAGE_OPTIONS.find(item => item.code === language)?.locale || 'fr-MA';
    return {
      date: (value, options) => new Intl.DateTimeFormat(locale, options || { dateStyle: 'medium' }).format(new Date(value)),
      time: (value, options) => new Intl.DateTimeFormat(locale, options || { timeStyle: 'short' }).format(new Date(value)),
      number: (value, options) => new Intl.NumberFormat(locale, options).format(Number(value || 0)),
      currency: (value, currency = 'MAD') => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value || 0)),
      percent: (value, options) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, ...(options || {}) }).format(Number(value || 0)),
      distance: (value, unit = 'kilometer') => new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(Number(value || 0)),
    };
  }, [language]);

  const value = useMemo(() => ({
    language,
    dir: isRtlLanguage(language) ? 'rtl' : 'ltr',
    options: LANGUAGE_OPTIONS,
    setLanguage,
    t,
    formatDate: formatters.date,
    formatTime: formatters.time,
    formatNumber: formatters.number,
    formatCurrency: formatters.currency,
    formatPercent: formatters.percent,
    formatDistance: formatters.distance,
  }), [language, setLanguage, t, formatters]);

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
