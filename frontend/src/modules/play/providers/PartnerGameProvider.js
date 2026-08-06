import GameProvider from './GameProvider.js';
import { GAME_LAUNCH_METHODS, GAME_SOURCES, normalizeCatalogGame } from '../catalog/gameSchema.js';

const SAFE_SANDBOX = Object.freeze(['allow-scripts', 'allow-same-origin', 'allow-pointer-lock', 'allow-orientation-lock', 'allow-presentation', 'allow-popups']);
const cleanOrigins = origins => new Set((origins || []).map(value => new URL(value).origin));

export default class PartnerGameProvider extends GameProvider {
  constructor({ metadata, games = [], allowedOrigins = [] }) {
    super({ ...metadata, license: metadata?.license || '' });
    if (!this.metadata.license) throw new TypeError('A partner provider requires an explicit license');
    this.allowedOrigins = cleanOrigins(allowedOrigins);
    this.games = Object.freeze(games.map(game => this.normalize(game)));
  }
  validateLaunchUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new TypeError('Partner games require HTTPS');
    if (!this.allowedOrigins.has(url.origin)) throw new TypeError(`Partner origin is not allowed: ${url.origin}`);
    return url.href;
  }
  normalize(game) {
    const launchUrl = this.validateLaunchUrl(game?.launchConfig?.url || game?.url || '');
    return normalizeCatalogGame({ ...game, source: GAME_SOURCES.PARTNER, launchMethod: GAME_LAUNCH_METHODS.EMBED, license: game.license || this.metadata.license, ads: game.ads ?? this.metadata.ads, compatibility: { mobile: game.mobile ?? this.metadata.mobile, keyboard: Boolean(game.keyboard), fullscreen: game.fullscreen ?? this.metadata.fullscreen }, launchConfig: { url: launchUrl } }, this.id);
  }
  async getCatalog() { return [...this.games]; }
  canLaunch(game) { return game?.providerId === this.id && game?.launchMethod === GAME_LAUNCH_METHODS.EMBED; }
  async getLaunchDescriptor(game) {
    if (!this.canLaunch(game)) throw new Error(`Game ${game?.slug || 'unknown'} cannot be launched by ${this.id}`);
    return Object.freeze({ method: GAME_LAUNCH_METHODS.EMBED, url: this.validateLaunchUrl(game.launchConfig.url), origin: new URL(game.launchConfig.url).origin, sandbox: SAFE_SANDBOX.join(' '), permissions: 'fullscreen; gamepad; autoplay', referrerPolicy: 'strict-origin-when-cross-origin' });
  }
}
