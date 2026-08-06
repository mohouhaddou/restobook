import React, { useEffect } from 'react';

export const DAYS_OPENING    = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
export const DAYS_OPENING_FR = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DEFAULT_SLOT = { closed: false, open: '09:00', close: '22:00' };

const inp = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid #E5E7EB', outline: 'none', color: '#111827',
  background: '#fff', fontFamily: 'inherit',
};

export function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, borderRadius: 12, background: checked ? 'var(--rb-orange,#FF8A00)' : '#D1D5DB', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </div>
      {label && <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>}
    </label>
  );
}

export function HoursEditor({ value, onChange }) {
  const hours = value || {};

  // Tout jour absent du JSON est affiché avec des valeurs par défaut (09:00-22:00) ;
  // on les écrit réellement dès le montage pour que l'affichage corresponde toujours
  // à ce qui sera enregistré (sinon un jour jamais touché par l'utilisateur reste
  // absent des données malgré son apparence "configurée" à l'écran).
  useEffect(() => {
    const missing = DAYS_OPENING.filter(day => !hours[day]);
    if (missing.length === 0) return;
    const filled = { ...hours };
    missing.forEach(day => { filled[day] = { ...DEFAULT_SLOT }; });
    onChange(filled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function setDay(day, field, val) {
    onChange({ ...hours, [day]: { ...hours[day], [field]: val } });
  }
  function toggleOpen(day, isOpen) {
    const h = hours[day] || {};
    onChange({ ...hours, [day]: { ...h, closed: !isOpen, open: h.open || '09:00', close: h.close || '22:00' } });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS_OPENING.map((day, i) => {
        const h = hours[day] || {};
        return (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 70, fontSize: 12, fontWeight: 600, color: '#374151' }}>{DAYS_OPENING_FR[i]}</div>
            <ToggleSwitch checked={!h.closed} onChange={v => toggleOpen(day, v)} label="" />
            {!h.closed && (
              <>
                <input type="time" value={h.open || '09:00'} onChange={e => setDay(day, 'open', e.target.value)} style={{ ...inp, width: 100 }} />
                <span style={{ color: '#9CA3AF', fontSize: 12 }}>→</span>
                <input type="time" value={h.close || '22:00'} onChange={e => setDay(day, 'close', e.target.value)} style={{ ...inp, width: 100 }} />
              </>
            )}
            {h.closed && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Fermé</span>}
          </div>
        );
      })}
    </div>
  );
}

export default HoursEditor;
