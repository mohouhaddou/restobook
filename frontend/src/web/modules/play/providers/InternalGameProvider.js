import GameProvider from './GameProvider';
import { listRegistryGames } from '../registry/gamesRegistry';
import { GAME_LAUNCH_METHODS, GAME_SOURCES, normalizeCatalogGame } from '../catalog/gameSchema';

export default class InternalGameProvider extends GameProvider {
  constructor({ translate = key => key } = {}) {
    super({
      id: 'ifilino',
      name: 'iFilino Play',
      description: 'Jeux originaux développés pour iFilino.',
      categories: ['arcade', 'memory', 'quick', 'sports'],
      mobile: true,
      fullscreen: true,
      ads: false,
      license: 'iFilino',
    });
    this.translate = translate;
  }

  async getCatalog() {
    return listRegistryGames().map(game => normalizeCatalogGame({
      ...game,
      title: this.translate(game.titleKey),
      name: this.translate(game.titleKey),
      description: this.translate(game.descriptionKey),
      source: GAME_SOURCES.INTERNAL,
      launchMethod: game.engine === 'phaser' ? GAME_LAUNCH_METHODS.PHASER : GAME_LAUNCH_METHODS.REACT,
      compatibility: {
        mobile: true,
        keyboard: Boolean(game.options?.keyboard),
        fullscreen: true,
      },
      license: 'iFilino',
      launchConfig: { component: game.component, engine: game.engine, options: game.options || {} },
    }, this.id));
  }

  canLaunch(game) {
    return game?.providerId === this.id && Boolean(game.launchConfig?.component);
  }

  async getLaunchDescriptor(game) {
    if (!this.canLaunch(game)) throw new Error(`Game ${game?.slug || 'unknown'} cannot be launched by ${this.id}`);
    return Object.freeze({ method: game.launchMethod, component: game.launchConfig.component, options: game.launchConfig.options });
  }
}
