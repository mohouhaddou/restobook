import { defineConfig } from 'vitest/config';

// Config dédiée au moteur Markdown partagé (frontend/src/shared/markdown) et à ses
// consommateurs (BookReader, cartes Kids). Séparée de vite.config.js (build de l'app)
// pour ne rien changer au build de production.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: [
      'src/shared/markdown/**/*.test.{js,jsx,ts,tsx}',
      'src/modules/portals/**/*.test.{js,jsx,ts,tsx}',
    ],
    globals: true,
  },
});
