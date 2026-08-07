const gameKey = game => game.slug || `${game.providerId}:${game.id}`;

export default class GameCatalog {
  constructor(providers = []) {
    this.providers = new Map();
    providers.forEach(provider => this.register(provider));
  }

  register(provider) {
    if (!provider?.id || typeof provider.getCatalog !== 'function') throw new TypeError('Invalid GameProvider');
    if (this.providers.has(provider.id)) throw new Error(`Provider ${provider.id} is already registered`);
    this.providers.set(provider.id, provider);
    return this;
  }

  getProvider(providerId) { return this.providers.get(providerId) || null; }

  async list() {
    const catalogs = await Promise.all([...this.providers.values()].map(provider => provider.getCatalog()));
    const unique = new Map();
    catalogs.flat().forEach(game => unique.set(gameKey(game), game));
    return [...unique.values()];
  }

  async findBySlug(slug) {
    for (const provider of this.providers.values()) {
      const game = await provider.getGame(slug);
      if (game) return game;
    }
    return null;
  }

  async getLaunchDescriptor(game, player = null) {
    const provider = this.getProvider(game?.providerId);
    if (!provider) throw new Error(`Unknown provider ${game?.providerId || ''}`);
    const session = await provider.createLaunchSession(game, player);
    const launch = await provider.getLaunchDescriptor(game, session);
    return Object.freeze({ provider, session, launch });
  }
}
