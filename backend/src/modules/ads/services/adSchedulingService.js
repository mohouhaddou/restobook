'use strict';

// Résout jour/heure locaux dans le fuseau de la campagne sans dépendance externe
// (Intl.DateTimeFormat gère la conversion de fuseau nativement en Node).
function localParts(date, timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = t => parts.find(p => p.type === t)?.value;
    const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    let hour = get('hour'); if (hour === '24') hour = '00';
    return { dayOfWeek: WEEKDAYS[get('weekday')], hm: `${hour}:${get('minute')}` };
  } catch {
    // Fuseau invalide/inconnu -> UTC plutôt que de faire planter la résolution d'annonce.
    return { dayOfWeek: date.getUTCDay(), hm: date.toISOString().slice(11, 16) };
  }
}

/**
 * Statut + fenêtre de diffusion + plafonds — n'évalue PAS le ciblage
 * (plateforme/route/langue/appareil/audience), voir adTargetingService.
 */
function isCampaignActiveNow(campaign, now = new Date()) {
  if (!campaign || campaign.status !== 'active') return false;
  if (campaign.start_at && now < new Date(campaign.start_at)) return false;
  if (campaign.end_at && now > new Date(campaign.end_at)) return false;

  if ((campaign.days_of_week && campaign.days_of_week.length) || campaign.start_hour || campaign.end_hour) {
    const { dayOfWeek, hm } = localParts(now, campaign.timezone);
    if (campaign.days_of_week && campaign.days_of_week.length && !campaign.days_of_week.includes(dayOfWeek)) return false;
    if (campaign.start_hour && hm < campaign.start_hour) return false;
    if (campaign.end_hour && hm > campaign.end_hour) return false;
  }

  if (campaign.max_impressions != null && campaign.impressions_count >= campaign.max_impressions) return false;
  if (campaign.max_clicks != null && campaign.clicks_count >= campaign.max_clicks) return false;

  return true;
}

module.exports = { isCampaignActiveNow, localParts };
