'use strict';

const { AdPlacement, AdCampaign, AdTargetingRule, AdImpression } = require('../../../../models');
const adCache = require('./adCacheService');
const { isCampaignActiveNow } = require('./adSchedulingService');
const { campaignMatchesTargeting } = require('./adTargetingService');

// Charge (avec cache court) le placement + ses campagnes assignées + leurs
// règles de ciblage. Le filtrage fin (planification/ciblage, dépendant du
// contexte de la requête) se fait ensuite en mémoire, hors cache, pour rester
// correct par requête sans re-interroger la base à chaque affichage.
async function loadPlacementCandidates(placementCode) {
  const cached = adCache.get(placementCode);
  if (cached) return cached;

  const placement = await AdPlacement.findOne({
    where: { code: placementCode },
    include: [{
      model: AdCampaign,
      as: 'campaigns',
      through: { attributes: [] },
      include: [{ model: AdTargetingRule, as: 'targetingRules' }],
    }],
  });

  const result = { placement, campaigns: placement ? placement.campaigns || [] : [] };
  adCache.set(placementCode, result);
  return result;
}

// Priorité = niveau de compétition (seules les campagnes de plus haute
// priorité éligibles participent), rotation_weight = poids au sein de ce
// palier — cf. spec §5 : "priorité" puis "poids de rotation".
function pickWeighted(list) {
  if (!list.length) return null;
  const maxPriority = Math.max(...list.map(c => c.priority || 0));
  const topTier = list.filter(c => (c.priority || 0) === maxPriority);
  const totalWeight = topTier.reduce((s, c) => s + (c.rotation_weight || 1), 0);
  let r = Math.random() * totalWeight;
  for (const c of topTier) {
    r -= (c.rotation_weight || 1);
    if (r <= 0) return c;
  }
  return topTier[topTier.length - 1];
}

// Plafonds par utilisateur (frequency_cap) / par session (session_cap) —
// une requête COUNT indexée par campagne candidate, pas une agrégation lourde.
async function passesCaps(campaign, ctx) {
  if (campaign.frequency_cap && ctx.userId) {
    const count = await AdImpression.count({ where: { campaign_id: campaign.id, user_id: ctx.userId } });
    if (count >= campaign.frequency_cap) return false;
  }
  if (campaign.session_cap && ctx.sessionIdHash) {
    const count = await AdImpression.count({ where: { campaign_id: campaign.id, session_id_hash: ctx.sessionIdHash } });
    if (count >= campaign.session_cap) return false;
  }
  return true;
}

async function resolveEligibleCampaigns(placementCode, ctx) {
  const { placement, campaigns } = await loadPlacementCandidates(placementCode);
  if (!placement || !placement.is_active) return { placement: null, campaigns: [], eligible: [], winner: null };

  const now = ctx.now || new Date();
  const scheduledAndTargeted = campaigns.filter(c =>
    isCampaignActiveNow(c, now) && campaignMatchesTargeting(c.targetingRules, ctx)
  );

  const capChecks = await Promise.all(scheduledAndTargeted.map(c => passesCaps(c, ctx)));
  const eligible = scheduledAndTargeted.filter((c, i) => capChecks[i]);

  const winner = pickWeighted(eligible);
  return { placement, campaigns, eligible, winner };
}

// Fallback explicite par campagne (spec §5) : si la rotation normale ne
// retient aucune éligible (hors planification/ciblage, ou toutes hors plafond),
// une campagne peut se déclarer "par défaut" pour ses emplacements assignés.
function pickFallback(campaigns) {
  const internalDefault = campaigns.find(c => c.fallback_type === 'internal_default' && c.status === 'active');
  if (internalDefault) return internalDefault;
  const adsenseFallback = campaigns.find(c => c.fallback_type === 'adsense' && c.source_type === 'adsense' && c.status === 'active');
  if (adsenseFallback) return adsenseFallback;
  return null;
}

module.exports = { resolveEligibleCampaigns, pickWeighted, pickFallback, loadPlacementCandidates };
