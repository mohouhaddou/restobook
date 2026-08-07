import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_PUBLIC_BASE_PATH
    ? env.VITE_PUBLIC_BASE_PATH.replace(/\/?$/, '/')
    : '/restobook/';
  return {
    base,
    server: {
      // En dev, le backend tourne sur un port séparé (voir .env.development) —
      // ASSET() suppose la même origine (vrai en prod, reverse-proxifié), donc
      // on proxifie /uploads ici pour que les images produits s'affichent.
      proxy: env.VITE_UPLOADS_PROXY_TARGET ? { '/uploads': env.VITE_UPLOADS_PROXY_TARGET } : undefined,
    },
    // Bundle SSR (backend/src/modules/seo/ssrRenderer.js, `npm run build:ssr`)
    // — noExternal: true embarque react/react-dom dans le bundle plutôt que
    // de les laisser en `import` externes : le backend est un projet npm
    // séparé sans ces dépendances dans son propre node_modules, un import
    // externe échouerait donc au chargement.
    ssr: {
      noExternal: true,
    },
  };
});
