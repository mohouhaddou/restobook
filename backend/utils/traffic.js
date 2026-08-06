'use strict';
const crypto = require('crypto');
const TrafficEvent = require('../models/trafficEvent');

const PEPPER = process.env.TRAFFIC_HASH_PEPPER || 'ifilino-traffic';
const VISITOR_COOKIE = 'ifilino_visitor';
const BOT_UA = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|headless/i;

function cookieValue(req, name) {
  const raw = req.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : '';
}

function hashVisitor(req, res) {
  let identity = cookieValue(req, VISITOR_COOKIE);
  if (!identity) {
    identity = crypto.randomUUID();
    if (res && !res.headersSent) {
      res.cookie(VISITOR_COOKIE, identity, {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }
  }
  const ip = req.ip || req.connection?.remoteAddress || '';
  const ua = req.get('user-agent') || '';
  const stableIdentity = identity || `${ip}|${ua}`;
  return crypto.createHash('sha256').update(`${stableIdentity}|${PEPPER}`).digest('hex');
}

function deviceTypeFromUA(ua) {
  const s = String(ua || '');
  if (/ipad|tablet|(android(?!.*mobile))/i.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(s)) return 'mobile';
  return 'desktop';
}

const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'whatsapp.com', 'linkedin.com', 'youtube.com', 'snapchat.com'];
const SEARCH_HOSTS = ['google.', 'bing.com', 'yahoo.', 'duckduckgo.com'];

function referrerDomain(req) {
  const ref = req.get('referer') || req.get('referrer');
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    const appHost = (req.get('host') || '').replace(/^www\./, '').split(':')[0];
    if (host === appHost) return 'internal';
    if (SOCIAL_HOSTS.some(h => host.includes(h))) return 'social';
    if (SEARCH_HOSTS.some(h => host.includes(h))) return 'search';
    return host;
  } catch {
    return 'direct';
  }
}

// Fire-and-forget: logs one row per (visitor, entity, day) — duplicates are
// silently swallowed via the unique index so re-visits the same day don't
// inflate the unique-visitor count.
function trackTraffic(req, res, { module, entityType, entityId }) {
  const userAgent = req.get('user-agent') || '';
  if (!userAgent || BOT_UA.test(userAgent)) return;
  const now = new Date();
  TrafficEvent.create({
    module,
    entity_type: entityType,
    entity_id: entityId != null ? String(entityId) : '0',
    visitor_hash: hashVisitor(req, res),
    referrer_domain: referrerDomain(req),
    device_type: deviceTypeFromUA(req.get('user-agent')),
    view_date: now.toISOString().slice(0, 10),
    created_at: now,
  }).catch(err => {
    if (err.name !== 'SequelizeUniqueConstraintError') {
      // eslint-disable-next-line no-console
      console.error('[traffic] track failed:', err.message);
    }
  });
}

module.exports = { trackTraffic, hashVisitor, deviceTypeFromUA, referrerDomain };
