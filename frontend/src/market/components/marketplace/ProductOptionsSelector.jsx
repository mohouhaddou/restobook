import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';
import React from 'react';
import { clamp } from './productOptions';

const fmt = n => Number(n || 0).toFixed(2);

function SingleChoice({ opt, value, onChange, theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opt.values.map(v => (
        <label key={v.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
          border: `2px solid ${value === v.id ? theme.primary : '#E5E7EB'}`,
          background: value === v.id ? `${theme.primary}10` : '#fff',
          transition: 'all .15s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${value === v.id ? theme.primary : '#D1D5DB'}`,
              background: value === v.id ? theme.primary : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {value === v.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <input type="radio" style={{ display: 'none' }} checked={value === v.id} onChange={() => onChange(v.id)} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{v.label}</span>
          </div>
          {Number(v.extra_price) > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.primary }}>+{fmt(v.extra_price)} MAD</span>
          )}
        </label>
      ))}
    </div>
  );
}

function MultiChoice({ opt, value = [], onChange, theme }) {
  const toggle = (id) => {
    const next = value.includes(id) ? value.filter(x => x !== id) : [...value, id];
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {opt.values.map(v => {
        const checked = value.includes(v.id);
        return (
          <label key={v.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            border: `2px solid ${checked ? theme.primary : '#E5E7EB'}`,
            background: checked ? `${theme.primary}10` : '#fff',
            transition: 'all .15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: `2px solid ${checked ? theme.primary : '#D1D5DB'}`,
                background: checked ? theme.primary : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <input type="checkbox" style={{ display: 'none' }} checked={checked} onChange={() => toggle(v.id)} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{v.label}</span>
            </div>
            {Number(v.extra_price) > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.primary }}>+{fmt(v.extra_price)} MAD</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function QuantityOption({ opt, value, onChange, theme }) {
  const min = opt.min_value ?? 1;
  const max = opt.max_value ?? 99;
  const step = opt.step ?? 1;
  const cur = value ?? min;

  const adjust = (delta) => {
    const next = Math.round((cur + delta) * 1000) / 1000;
    onChange(clamp(next, min, max));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={() => adjust(-step)} disabled={cur <= min}
        style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${cur > min ? theme.primary : '#E5E7EB'}`,
          background: cur > min ? `${theme.primary}10` : '#F9FAFB', color: cur > min ? theme.primary : '#9CA3AF',
          fontWeight: 800, fontSize: 18, cursor: cur > min ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 18, color: '#111827' }}>
        {step < 1 ? cur.toFixed(step < 0.1 ? 2 : 1) : cur}
        {opt.unit && <span style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginLeft: 4 }}>{opt.unit}</span>}
      </div>
      <button onClick={() => adjust(step)} disabled={cur >= max}
        style={{ width: 36, height: 36, borderRadius: 10, border: `2px solid ${cur < max ? theme.primary : '#E5E7EB'}`,
          background: cur < max ? `${theme.primary}10` : '#F9FAFB', color: cur < max ? theme.primary : '#9CA3AF',
          fontWeight: 800, fontSize: 18, cursor: cur < max ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+
      </button>
    </div>
  );
}

function TextOption({ opt, value, onChange }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={`Votre ${opt.name.toLowerCase()}…`}
      rows={3}
      style={{ width: '100%', borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontSize: 14, resize: 'vertical',
        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#FF8A00'}
      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
    />
  );
}

function DateSlotOption({ opt, value, onChange }) {
  return (
    <input
      type="datetime-local"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ width: '100%', borderRadius: 10, border: '1.5px solid #E5E7EB', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
      onFocus={e => e.target.style.borderColor = '#FF8A00'}
      onBlur={e => e.target.style.borderColor = '#E5E7EB'}
    />
  );
}

/**
 * Rendu unifié des options produit — taille/quantité/poids/accompagnements/
 * suppléments/variantes — quel que soit le module (resto/hanout/pharmacie/
 * futur type de commerce). Utilisé par MenuItemModal, ProductModal (hanout)
 * et ProductDetailPage : une seule logique d'affichage, la différence vient
 * uniquement de la configuration des options renvoyées par le backend.
 */
export function ProductOptionsSelector({ options, selections, errors, onChange, theme }) {
  const list = (options || []).filter(o => o.available).sort((a, b) => a.sort_order - b.sort_order);
  if (!list.length) return null;

  return (
    <>
      {list.map(opt => (
        <div key={opt.id} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#111827' }}>{opt.name}</span>
            {opt.required
              ? <span style={{ fontSize: 10, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '2px 7px', borderRadius: 20 }}>Requis</span>
              : <span style={{ fontSize: 10, fontWeight: 700, background: '#F3F4F6', color: '#6B7280', padding: '2px 7px', borderRadius: 20 }}>Optionnel</span>
            }
          </div>

          {opt.type === 'single_choice' && <SingleChoice opt={opt} value={selections[opt.id]} onChange={v => onChange(opt.id, v)} theme={theme} />}
          {opt.type === 'multi_choice' && <MultiChoice opt={opt} value={selections[opt.id]} onChange={v => onChange(opt.id, v)} theme={theme} />}
          {(opt.type === 'quantity' || opt.type === 'weight') && <QuantityOption opt={opt} value={selections[opt.id]} onChange={v => onChange(opt.id, v)} theme={theme} />}
          {opt.type === 'text' && <TextOption opt={opt} value={selections[opt.id]} onChange={v => onChange(opt.id, v)} />}
          {opt.type === 'date_slot' && <DateSlotOption opt={opt} value={selections[opt.id]} onChange={v => onChange(opt.id, v)} />}

          {errors?.[opt.id] && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#DC2626', fontWeight: 600 }}><PremiumIcon name="alert" size={13} /> {errors[opt.id]}</div>
          )}
        </div>
      ))}
    </>
  );
}
