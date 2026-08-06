import React from 'react';
import { DashboardIcon } from '../ui/DashboardIcon';

// Bouton d'action rapide (rangée horizontale scrollable sur l'Accueil) :
// Commander / Scanner QR / Recommander / Liste de courses / Pharmacie de garde...
export function QuickActionCard({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '14px 10px', minWidth: 84, flexShrink: 0,
        background: 'var(--mk-card)', border: '1px solid var(--mk-border)', borderRadius: 16,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--mk-shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 12, background: 'var(--mk-orange-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
      }}><DashboardIcon icon={icon} size={20} /></span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mk-text2)', textAlign: 'center' }}>{label}</span>
    </button>
  );
}
