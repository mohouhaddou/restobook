import React from 'react';
import { ROLE_LABELS } from '../../auth/permissions';

const STATUS_MAP = {
  confirmed:  { cls: 'text-bg-primary',   label: 'Confirmée' },
  picked:     { cls: 'text-bg-success',   label: 'Retirée' },
  cancelled:  { cls: 'text-bg-danger',    label: 'Annulée' },
  pending:    { cls: 'text-bg-warning',   label: 'En attente' },
  preparing:  { cls: 'text-bg-info',      label: 'En préparation' },
  ready:      { cls: 'text-bg-success',   label: 'Prête' },
  delivered:  { cls: 'text-bg-secondary', label: 'Livrée' },
  seated:     { cls: 'text-bg-info',      label: 'Installé' },
  no_show:    { cls: 'text-bg-dark',      label: 'No-show' },
  active:     { cls: 'text-bg-success',   label: 'Actif' },
  inactive:   { cls: 'text-bg-secondary', label: 'Inactif' },
  trial:      { cls: 'text-bg-warning',   label: 'Trial' },
  pro:        { cls: 'text-bg-primary',   label: 'Pro' },
  canteen:    { cls: 'text-bg-info',      label: 'Cantine' },
  restaurant: { cls: 'text-bg-warning',   label: 'Restaurant' },
};

export function StatusBadge({ status, label }) {
  const s = STATUS_MAP[status] || { cls: 'text-bg-secondary', label: status };
  return <span className={`badge rounded-pill ${s.cls}`}>{label || s.label}</span>;
}

export function RoleBadge({ role }) {
  const map = {
    superadmin: 'text-bg-danger',
    restaurant_owner: 'text-bg-warning',
    restaurant_manager: 'text-bg-info',
    canteen_admin: 'text-bg-primary',
    organization_admin: 'text-bg-primary',
    employee: 'text-bg-light text-dark',
    customer: 'text-bg-success',
    kitchen_staff: 'text-bg-secondary',
    delivery: 'text-bg-dark',
    owner:      'text-bg-warning',
    admin:      'text-bg-primary',
    manager:    'text-bg-info',
    staff:      'text-bg-secondary',
    user:       'text-bg-light text-dark',
  };
  return <span className={`badge rounded-pill ${map[role] || 'text-bg-secondary'}`}>{ROLE_LABELS[role] || role}</span>;
}
