const text = value => String(value || '').trim().toLocaleLowerCase();

export function createCatalogService(catalog) {
  if (!catalog || typeof catalog.list !== 'function') throw new TypeError('A GameCatalog instance is required');

  return Object.freeze({
    list: () => catalog.list(),
    getBySlug: slug => catalog.findBySlug(slug),
    getProvider: providerId => catalog.getProvider(providerId),
    getLaunchDescriptor: (game, player) => catalog.getLaunchDescriptor(game, player),
    async search(filters = {}) {
      const query = text(filters.query);
      const games = await catalog.list();
      return games.filter(game => {
        const haystack = text([game.title, game.description, game.category, ...game.tags].join(' '));
        return (!query || haystack.includes(query))
          && (!filters.category || game.category === filters.category)
          && (!filters.difficulty || game.difficulty === filters.difficulty)
          && (!filters.source || game.source === filters.source)
          && (!filters.mobileOnly || game.compatibility.mobile)
          && (!filters.desktopOnly || game.compatibility.keyboard)
          && (!filters.maxDuration || game.averageDuration <= Number(filters.maxDuration));
      });
    },
  });
}
