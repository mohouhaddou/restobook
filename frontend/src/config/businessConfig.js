/**
 * Ifilino — Configuration centralisée des catégories et types de commerces.
 *
 * Pour ajouter un nouveau type : ajouter une entrée dans `types[]` de la bonne catégorie.
 * Pour ajouter une catégorie : ajouter un objet dans CATEGORIES.
 * Tout le reste (marketplace, dashboards, thèmes) se met à jour automatiquement.
 */

export const CATEGORIES = [
  {
    id:     'restauration',
    label:  'Restauration',
    icon:   '🍽️',
    module: 'resto',
    types: [
      { id:'restaurant',  label:'Restaurant',    icon:'🍽️', color:'#F97316', dark:'#EA580C', secondary:'#FDBA74', light:'#FFF7ED', lightBorder:'#FED7AA', glow:'rgba(249,115,22,.4)'  },
      { id:'cafe',        label:'Café',           icon:'☕',  color:'#0369A1', dark:'#0284C7', secondary:'#7DD3FC', light:'#F0F9FF', lightBorder:'#BAE6FD', glow:'rgba(3,105,161,.4)'   },
      { id:'snack',       label:'Snack',          icon:'🥙',  color:'#F59E0B', dark:'#D97706', secondary:'#FCD34D', light:'#FFFBEB', lightBorder:'#FDE68A', glow:'rgba(245,158,11,.4)'  },
      { id:'fast_food',   label:'Fast-food',      icon:'🍔',  color:'#EA580C', dark:'#C2410C', secondary:'#FB923C', light:'#FFF7ED', lightBorder:'#FDBA74', glow:'rgba(234,88,12,.4)'   },
      { id:'boulangerie', label:'Boulangerie',    icon:'🥖',  color:'#D97706', dark:'#B45309', secondary:'#FCD34D', light:'#FFFBEB', lightBorder:'#FDE68A', glow:'rgba(217,119,6,.4)'   },
      { id:'patisserie',  label:'Pâtisserie',     icon:'🍰',  color:'#EC4899', dark:'#DB2777', secondary:'#F9A8D4', light:'#FDF2F8', lightBorder:'#FBCFE8', glow:'rgba(236,72,153,.4)'  },
      { id:'glacier',     label:'Glacier',        icon:'🍦',  color:'#06B6D4', dark:'#0891B2', secondary:'#67E8F9', light:'#ECFEFF', lightBorder:'#A5F3FC', glow:'rgba(6,182,212,.4)'   },
      { id:'salon_the',   label:'Salon de thé',   icon:'🫖',  color:'#0F766E', dark:'#0D9488', secondary:'#5EEAD4', light:'#F0FDFA', lightBorder:'#99F6E4', glow:'rgba(15,118,110,.4)'  },
      { id:'dark_kitchen',label:'Dark Kitchen',   icon:'📦',  color:'#7C3AED', dark:'#6D28D9', secondary:'#C4B5FD', light:'#F5F3FF', lightBorder:'#DDD6FE', glow:'rgba(124,58,237,.4)'  },
      { id:'autre',       label:'Autre',          icon:'🏬',  color:'#64748B', dark:'#475569', secondary:'#CBD5E1', light:'#F8FAFC', lightBorder:'#E2E8F0', glow:'rgba(100,116,139,.4)' },
    ],
  },
  {
    id:     'pharmacie',
    label:  'Pharmacies',
    icon:   '💊',
    module: 'pharmacie',
    types: [
      { id:'pharmacie',          label:'Pharmacie',           icon:'💊',  color:'#16A34A', dark:'#15803D', secondary:'#86EFAC', light:'#F0FDF4', lightBorder:'#BBF7D0', glow:'rgba(22,163,74,.4)'   },
      { id:'pharmacie_de_garde', label:'Pharmacie de garde',  icon:'🚑',  color:'#DC2626', dark:'#B91C1C', secondary:'#FCA5A5', light:'#FEF2F2', lightBorder:'#FECACA', glow:'rgba(220,38,38,.4)'   },
      { id:'parapharmacie',      label:'Parapharmacie',       icon:'🩺',  color:'#22C55E', dark:'#16A34A', secondary:'#86EFAC', light:'#F0FDF4', lightBorder:'#BBF7D0', glow:'rgba(34,197,94,.4)'   },
    ],
  },
  {
    id:     'proximite',
    label:  'Commerces de proximité',
    icon:   '🏪',
    module: 'hanout', // valeur interne conservée pour compatibilité DB
    types: [
      { id:'epicerie',       label:'Épicerie',       icon:'🛒',  color:'#10B981', dark:'#059669', secondary:'#6EE7B7', light:'#F0FDF4', lightBorder:'#A7F3D0', glow:'rgba(16,185,129,.4)'  },
      { id:'boucherie',      label:'Boucherie',      icon:'🥩',  color:'#DC2626', dark:'#B91C1C', secondary:'#FCA5A5', light:'#FEF2F2', lightBorder:'#FECACA', glow:'rgba(220,38,38,.4)'   },
      { id:'droguerie',      label:'Droguerie',      icon:'🧴',  color:'#6366F1', dark:'#4F46E5', secondary:'#A5B4FC', light:'#EEF2FF', lightBorder:'#C7D2FE', glow:'rgba(99,102,241,.4)'  },
      { id:'primeur',        label:'Primeur',        icon:'🥬',  color:'#65A30D', dark:'#4D7C0F', secondary:'#BEF264', light:'#F7FEE7', lightBorder:'#D9F99D', glow:'rgba(101,163,13,.4)'  },
      { id:'quincaillerie',  label:'Quincaillerie',  icon:'🔩',  color:'#6B7280', dark:'#4B5563', secondary:'#9CA3AF', light:'#F9FAFB', lightBorder:'#E5E7EB', glow:'rgba(107,114,128,.4)' },
      { id:'supermarche',    label:'Supérette',      icon:'🛍️', color:'#2563EB', dark:'#1D4ED8', secondary:'#93C5FD', light:'#EFF6FF', lightBorder:'#BFDBFE', glow:'rgba(37,99,235,.4)'   },
      { id:'hanout',         label:'Commerce',       icon:'🏪',  color:'#10B981', dark:'#059669', secondary:'#6EE7B7', light:'#F0FDF4', lightBorder:'#A7F3D0', glow:'rgba(16,185,129,.4)'  },
      { id:'autre',          label:'Autre',          icon:'🏬',  color:'#64748B', dark:'#475569', secondary:'#CBD5E1', light:'#F8FAFC', lightBorder:'#E2E8F0', glow:'rgba(100,116,139,.4)' },
    ],
  },
];

// ── Lookups pré-calculés ────────────────────────────────────────────────────

/** Toutes les configs de type, indexées par id */
export const TYPE_CONFIG = {};
/** Catégorie parente, indexée par module interne */
export const CATEGORY_BY_MODULE = {};
/** Catégorie parente, indexée par id */
export const CATEGORY_BY_ID = {};

for (const cat of CATEGORIES) {
  CATEGORY_BY_MODULE[cat.module] = cat;
  CATEGORY_BY_ID[cat.id] = cat;
  for (const t of cat.types) {
    TYPE_CONFIG[t.id] = { ...t, category: cat };
  }
}

const FALLBACK_TYPE = {
  id: 'autre', label: 'Commerce', icon: '🏬',
  color: '#64748B', dark: '#475569', secondary: '#CBD5E1',
  light: '#F8FAFC', lightBorder: '#E2E8F0', glow: 'rgba(100,116,139,.4)',
  category: null,
};

/** Renvoie la config complète d'un type (jamais null). */
export function getTypeConfig(typeId) {
  return TYPE_CONFIG[typeId] || FALLBACK_TYPE;
}

/** Renvoie la catégorie d'un module interne (resto, hanout, pharmacie…). */
export function getCategoryByModule(module) {
  return CATEGORY_BY_MODULE[module] || null;
}

/** Renvoie le thème visuel prêt à l'emploi pour un type de commerce. */
export function getTheme(typeId) {
  const t = getTypeConfig(typeId);
  return {
    primary:     t.color,
    secondary:   t.secondary,
    dark:        t.dark,
    light:       t.light,
    lightBorder: t.lightBorder,
    glow:        t.glow,
    icon:        t.icon,
    gradient:    `linear-gradient(135deg, ${t.color}, ${t.dark})`,
  };
}

/** Label lisible d'un type de commerce. */
export function getTypeLabel(typeId) {
  return TYPE_CONFIG[typeId]?.label || typeId;
}

/** Label lisible d'une catégorie par son module interne. */
export function getCategoryLabel(module) {
  return CATEGORY_BY_MODULE[module]?.label || module;
}
