import test from 'node:test';import assert from 'node:assert/strict';import{readFile,stat}from'node:fs/promises';
const contractSource=await readFile(new URL('../src/modules/play/contracts/gameResult.js',import.meta.url),'utf8');const contract=await import(`data:text/javascript;base64,${Buffer.from(contractSource).toString('base64')}`);
test('normalizes unsafe score, duration and difficulty',()=>{const value=contract.createGameResult({gameId:'reaction-test',score:9999999,duration:-2,difficulty:'invalid'});assert.equal(value.score,100000);assert.equal(value.durationSeconds,0);assert.equal(value.difficulty,'medium');assert.ok(contract.isGameResult(value));});
test('preserves abandoned state',()=>{const value=contract.createGameResult({gameId:'color-match',status:'abandoned',won:true});assert.equal(value.status,'abandoned');assert.equal(value.won,false);});
test('registry declares eight unique lazy games',async()=>{const source=await readFile(new URL('../src/modules/play/registry/gamesRegistry.js',import.meta.url),'utf8');for(const slug of['memory-cards','reaction-test','color-match','bubble-pop','brick-smash','tower-stack','penalty-master','snake'])assert.match(source,new RegExp(`slug: '${slug}'`));assert.equal((source.match(/lazy\(\(\) => import/g)||[]).length,8);});
test('Phaser is lazy, local and destroyed on unmount',async()=>{const source=await readFile(new URL('../src/modules/play/games/phaser/PhaserGameContainer.jsx',import.meta.url),'utf8');assert.match(source,/phaser-arcade-physics\.min\.js/);assert.match(source,/script\.async=true/);assert.match(source,/destroy\(true\)/);const asset=await stat(new URL('../public/vendor/phaser-arcade-physics.min.js',import.meta.url));assert.ok(asset.size<1_200_000);});
test('Play offline cache excludes APIs',async()=>{const source=await readFile(new URL('../public/firebase-messaging-sw.js',import.meta.url),'utf8');assert.match(source,/IFILINO_PLAY_CACHE/);assert.match(source,/pathname\.startsWith\("\/play"\)/);assert.doesNotMatch(source,/PLAY_SHELL[^;]*\/api\//s);});

test('partner provider only launches licensed HTTPS allowlisted games', async () => {
  const { default: PartnerGameProvider } = await import('../src/modules/play/providers/PartnerGameProvider.js');
  const provider = new PartnerGameProvider({
    metadata: { id: 'licensed-demo', name: 'Licensed Demo', license: 'contract-demo' },
    allowedOrigins: ['https://games.example.test'],
    games: [{ id: 'demo', slug: 'demo', name: 'Demo', url: 'https://games.example.test/play/demo' }],
  });
  const [game] = await provider.getCatalog();
  const launch = await provider.getLaunchDescriptor(game);
  assert.equal(game.source, 'partner');
  assert.equal(launch.origin, 'https://games.example.test');
  assert.match(launch.sandbox, /allow-scripts/);
  assert.doesNotMatch(launch.sandbox, /allow-same-origin/);
  assert.throws(() => new PartnerGameProvider({ metadata: { id: 'bad', name: 'Bad', license: 'x' }, allowedOrigins: ['https://games.example.test'], games: [{ id: 'bad', slug: 'bad', url: 'http://games.example.test' }] }), /HTTPS/);
});

test('recommendations are unique, relevant and exclude the current game', async () => {
  const { rankGameRecommendations } = await import('../src/modules/play/services/recommendationService.js');
  const currentGame = { slug: 'memory', game_type: 'memory', duration: 5, tags: ['brain'] };
  const games = [
    currentGame,
    { slug: 'memory-cards', game_type: 'memory', duration: 4, tags: ['brain'], rating: 4.8, playCount: 500 },
    { slug: 'snake', game_type: 'arcade', duration: 6, rating: 4, playCount: 100 },
    { slug: 'memory-cards', game_type: 'memory', duration: 4 },
  ];
  const ranked = rankGameRecommendations({ currentGame, games, history: [{ game: { slug: 'snake' } }], favoriteSlugs: ['memory-cards'], limit: 3 });
  assert.deepEqual(ranked.map(game => game.slug), ['memory-cards', 'snake']);
  assert.equal(new Set(ranked.map(game => game.slug)).size, ranked.length);
});

test('catalog exposes persistent combinable advanced filters', async () => {
  const source = await readFile(new URL('../src/modules/play/hooks/useGameCatalog.js', import.meta.url), 'utf8');
  for (const key of ['difficulty', 'duration', 'device', 'source']) assert.match(source, new RegExp(key));
  assert.match(source, /sessionStorage\.setItem/);
  assert.match(source, /activeFilterCount/);
});


test('game details expose complete social SEO and structured breadcrumbs',async()=>{
 const seo=await readFile(new URL('../src/modules/play/components/PlayGameSeo.jsx',import.meta.url),'utf8');
 const page=await readFile(new URL('../src/pages/play/GameDetailsPage.jsx',import.meta.url),'utf8');
 const details=await readFile(new URL('../src/modules/play/components/GameDetails.jsx',import.meta.url),'utf8');
 for(const tag of ['og:title','og:description','og:url','twitter:card','link[rel="canonical"]'])assert.ok(seo.includes(tag));
 assert.match(page,/BreadcrumbList/);
 assert.match(page,/VideoGame/);
 assert.match(details,/aria-label="Fil d’Ariane"/);
 assert.match(details,/aria-current="page"/);
});

test("Play PWA registers independently and exposes install and offline states",async()=>{
 const hook=await readFile(new URL("../src/modules/play/hooks/usePlayPwa.js",import.meta.url),"utf8");
 const banner=await readFile(new URL("../src/modules/play/components/PlayPwaBanner.jsx",import.meta.url),"utf8");
 assert.match(hook,/serviceWorker\.register/);
 assert.match(hook,/beforeinstallprompt/);
 assert.match(hook,/appinstalled/);
 assert.match(banner,/Mode hors ligne/);
 assert.match(banner,/aria-live="polite"/);
});


test("Play public routes are lazy-loaded behind an accessible skeleton",async()=>{
 const app=await readFile(new URL("../src/App.jsx",import.meta.url),"utf8");
 const fallback=await readFile(new URL("../src/modules/play/components/PlayRouteFallback.jsx",import.meta.url),"utf8");
 for(const page of ["PlayHomePage","PlayGamePage","GameDetailsPage","PlayProfilePage"])assert.match(app,new RegExp("const "+page+" = lazy"));
 assert.match(app,/Suspense fallback/);
 assert.match(fallback,/aria-busy="true"/);
 assert.match(fallback,/role="status"/);
});


test("Discover articles expose a contextual Play recommendation bridge",async()=>{
 const bridge=await readFile(new URL("../src/modules/play/services/discoverPlayBridge.js",import.meta.url),"utf8");
 const articlePage=await readFile(new URL("../src/pages/discover/ArticlePage.jsx",import.meta.url),"utf8");
 assert.match(bridge,/penalty-master/);
 assert.match(bridge,/guess-place/);
 assert.match(bridge,/memory-cards/);
 assert.match(bridge,/normalize/);
 assert.match(articlePage,/DiscoverGameRecommendation/);
});


test("Play game details recommend related Discover reading",async()=>{
 const bridge=await readFile(new URL("../src/modules/play/services/discoverPlayBridge.js",import.meta.url),"utf8");
 const details=await readFile(new URL("../src/pages/play/GameDetailsPage.jsx",import.meta.url),"utf8");
 assert.match(bridge,/recommendArticleForGame/);
 assert.match(details,/RelatedDiscoverContent/);
 assert.match(details,/@context/);
 assert.match(details,/window.location.origin/);
});


test("Play administration manages catalog status and licensed providers",async()=>{
 const model=await readFile(new URL("../../backend/models/playProvider.js",import.meta.url),"utf8");
 const routes=await readFile(new URL("../../backend/src/modules/play/adminRoutes.js",import.meta.url),"utf8");
 const admin=await readFile(new URL("../src/pages/superadmin/PlayAdminPage.jsx",import.meta.url),"utf8");
 assert.match(model,/tableName: \x27play_providers\x27/);
 assert.match(routes,/\/providers/);
 assert.match(routes,/référence de licence est requise/);
 assert.match(routes,/startsWith\(\x27https:\/\/\x27\)/);
 assert.match(admin,/Fournisseurs/);
 assert.match(admin,/handleToggle/);
});


test("partner catalog games require an active licensed provider and matching HTTPS origin",async()=>{
 const model=await readFile(new URL("../../backend/models/playGame.js",import.meta.url),"utf8");
 const routes=await readFile(new URL("../../backend/src/modules/play/adminRoutes.js",import.meta.url),"utf8");
 const admin=await readFile(new URL("../src/pages/superadmin/PlayAdminPage.jsx",import.meta.url),"utf8");
 for(const field of ["provider_id","launch_url","thumbnail_url","source","supports_mobile"])assert.match(model,new RegExp(field));
 assert.match(routes,/fournisseur doit être actif et licencié/i);
 assert.match(routes,/launch\.origin/);
 assert.match(routes,/launch\.protocol/);
 assert.match(admin,/URL lancement HTTPS/);
 assert.match(admin,/ID fournisseur/);
});


test("public catalog serializes and launches active licensed partner games",async()=>{
 const service=await readFile(new URL("../../backend/src/modules/play/services/gameService.js",import.meta.url),"utf8");
 const player=await readFile(new URL("../src/pages/play/PlayGamePage.jsx",import.meta.url),"utf8");
 assert.match(service,/providerId/);
 assert.match(service,/launchConfig/);
 assert.match(service,/license_reference/);
 assert.match(service,/filter\(Boolean\)/);
 assert.match(player,/PartnerGameFrame/);
 assert.match(player,/strict-origin-when-cross-origin/);
 assert.match(player,/game\.launchMethod===\x27redirect\x27/);
 assert.match(player,/target="_blank"/);
 assert.match(player,/noopener noreferrer/);
});
