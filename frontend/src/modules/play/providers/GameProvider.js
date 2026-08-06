export default class GameProvider {
  constructor(metadata) {
    if (new.target === GameProvider) throw new TypeError('GameProvider is an abstract contract');
    if (!metadata?.id || !metadata?.name) throw new TypeError('A provider requires id and name');
    this.metadata = Object.freeze({
      id: metadata.id,
      name: metadata.name,
      logo: metadata.logo || null,
      description: metadata.description || '',
      categories: Object.freeze(metadata.categories || []),
      mobile: metadata.mobile !== false,
      fullscreen: metadata.fullscreen !== false,
      ads: Boolean(metadata.ads),
      license: metadata.license || '',
    });
  }

  get id() { return this.metadata.id; }
  get name() { return this.metadata.name; }

  async getCatalog() { throw new Error(`${this.id}.getCatalog() is not implemented`); }
  async getGame(slug) { return (await this.getCatalog()).find(game => game.slug === slug) || null; }
  canLaunch() { return true; }
  async createLaunchSession(game, player = null) { return { id: null, game, player }; }
  async getLaunchDescriptor() { throw new Error(`${this.id}.getLaunchDescriptor() is not implemented`); }
  async destroySession() {}
}
