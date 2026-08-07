import React from 'react';

export default function StarRating({ value, count }) {
  const rating = Number(value || 0);
  const total = Number(count || 0);
  const full = Math.min(5, Math.round(rating));
  const hasRating = rating > 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 26, padding: '3px 8px', borderRadius: 999, background: hasRating ? '#FFF7ED' : 'var(--mk-pill, #F1F5F9)', border: hasRating ? '1px solid rgba(245, 158, 11, .28)' : '1px solid var(--mk-border, #E2E8F0)', fontSize: 12 }}>
      <span aria-hidden="true" style={{ color: hasRating ? '#F59E0B' : '#CBD5E1', letterSpacing: 0 }}>{hasRating ? '★'.repeat(full) + '☆'.repeat(5 - full) : '★'}</span>
      {hasRating ? <strong style={{ color: 'var(--mk-text, #0F172A)', fontVariantNumeric: 'tabular-nums' }}>{rating.toFixed(1)}</strong> : <span style={{ color: 'var(--mk-muted, #64748B)', fontWeight: 800 }}>Nouveau</span>}
      {total > 0 && <span style={{ color: 'var(--mk-muted, #64748B)', fontWeight: 700 }}>{total} avis</span>}
    </span>
  );
}
