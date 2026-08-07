import React from 'react';

const DAY_NAMES = { monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche' };
const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function OpeningHours({ hours }) {
  if (!hours) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
      {DAYS_ORDER.map(day => {
        const slot = hours[day];
        return (
          <div key={day} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>{DAY_NAMES[day]}</span>
            <span style={{ color: slot?.closed ? '#DC2626' : 'var(--mk-muted, #64748B)' }}>
              {!slot ? '—' : slot.closed ? 'Fermé' : `${slot.open || '00:00'} – ${slot.close || '23:59'}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
