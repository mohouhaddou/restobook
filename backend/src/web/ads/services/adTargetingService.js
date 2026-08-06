'use strict';

/**
 * Compile un route_pattern stocké en base (ex: '/discover/*', '/product/:slug')
 * en RegExp sûre. JAMAIS de `new RegExp(userInput)` direct : tout littéral est
 * échappé avant d'être ré-assemblé, seuls ':param' et le '*' final sont
 * ré-étendus vers des fragments fixes ('[^/]+', '(?:/.*)?') — un utilisateur ne
 * peut donc jamais injecter de motif regex arbitraire ou provoquer un ReDoS.
 */
function compileRoutePattern(pattern) {
  if (typeof pattern !== 'string' || !pattern.trim()) return null;
  let p = pattern.trim();
  const hasTrailingWildcard = p === '*' || p.endsWith('/*');
  if (hasTrailingWildcard) p = p.endsWith('/*') ? p.slice(0, -2) : '';

  const escapeLiteral = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const segments = p.split('/').map(seg => (
    seg.startsWith(':') && seg.length > 1 ? '[^/]+' : escapeLiteral(seg)
  ));
  let body = segments.join('/');
  if (hasTrailingWildcard) body += '(?:/.*)?';

  try { return new RegExp(`^${body}$`); } catch { return null; }
}

function matchesTargeting(rule, ctx) {
  if (!rule) return true;
  if (rule.platform && rule.platform !== ctx.platform) return false;

  const route = ctx.route || '';
  if (rule.route_type === 'exact' && rule.route_pattern !== route) return false;
  if (rule.route_type === 'prefix' && rule.route_pattern && !route.startsWith(rule.route_pattern)) return false;
  if (rule.route_type === 'pattern' && rule.route_pattern) {
    const re = compileRoutePattern(rule.route_pattern);
    if (re && !re.test(route)) return false;
  }

  if (rule.language && rule.language !== 'all' && rule.language !== ctx.language) return false;
  if (rule.device && rule.device !== 'all' && rule.device !== ctx.device) return false;
  if (rule.audience_type && rule.audience_type !== 'all' && rule.audience_type !== ctx.audienceType) return false;
  if (rule.country && rule.country !== ctx.country) return false;
  if (rule.city && rule.city !== ctx.city) return false;

  const now = ctx.now || new Date();
  if (rule.days_of_week && rule.days_of_week.length && !rule.days_of_week.includes(now.getUTCDay())) return false;
  if (rule.start_hour || rule.end_hour) {
    const hm = now.toISOString().slice(11, 16);
    if (rule.start_hour && hm < rule.start_hour) return false;
    if (rule.end_hour && hm > rule.end_hour) return false;
  }

  return true;
}

// Plusieurs règles = plusieurs profils de ciblage (OR entre règles, AND entre
// champs d'une même règle). Aucune règle => la campagne s'applique à tout
// contexte compatible avec la plateforme/l'emplacement déjà filtrés en amont.
function campaignMatchesTargeting(rules, ctx) {
  if (!rules || !rules.length) return true;
  return rules.some(rule => matchesTargeting(rule, ctx));
}

module.exports = { compileRoutePattern, matchesTargeting, campaignMatchesTargeting };
