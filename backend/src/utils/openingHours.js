'use strict';

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// Calcule si un commerce est ouvert maintenant depuis son JSON opening_hours
// (clés attendues : monday..sunday, { closed, open:'HH:MM', close:'HH:MM' })
function isOpenNow(opening_hours) {
  if (!opening_hours) return null; // inconnu
  try {
    const now = new Date();
    const slot = opening_hours[DAYS[now.getDay()]];
    if (!slot || slot.closed) return false;
    const [oh, om] = (slot.open  || '00:00').split(':').map(Number);
    const [ch, cm] = (slot.close || '23:59').split(':').map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  } catch { return null; }
}

module.exports = { isOpenNow, DAYS };
