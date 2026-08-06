import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_PUBLIC_BASE_PATH
    ? env.VITE_PUBLIC_BASE_PATH.replace(/\/?$/, '/')
    : '/restobook/';
  return {
    base,
    // @ifilino/shared (packages/shared/) est lié en dépendance locale `file:`
    // — Vite résout ce symlink vers son vrai chemin (hors node_modules/) et,
    // sans ce forçage, le sert comme module source brut plutôt que de le
    // pré-bundler avec l'interop CJS→ESM habituel : `module.exports` n'est
    // alors plus reconnu et les imports nommés échouent silencieusement à
    // l'exécution (piège Vite+monorepo classique, vérifié en conditions
    // réelles). `optimizeDeps.include` force le pré-bundling esbuild malgré
    // le symlink.
    optimizeDeps: {
      include: ['@ifilino/shared'],
    },
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
