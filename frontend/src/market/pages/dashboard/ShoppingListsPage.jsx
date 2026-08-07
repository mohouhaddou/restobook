import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShoppingLists } from '../../../shared/hooks/useShoppingLists';
import { useCart } from '../../modules/marketplace/CartContext';
import { useMkTheme } from '../../../shared/hooks/useMkTheme';
import { SHOPPING_CATEGORY_ORDER, categoryMeta } from '../../config/shoppingCategories';
import { ListCard } from '../../components/shopping-list/ListCard';
import { CategorySection } from '../../components/shopping-list/CategorySection';
import { SmartAddBar } from '../../components/shopping-list/SmartAddBar';
import { PresetPickerModal } from '../../components/shopping-list/PresetPickerModal';
import { BestStoreResultSheet } from '../../components/shopping-list/BestStoreResultSheet';
import { DashboardIcon } from '../../../shared/components/ui/DashboardIcon';
import { PremiumIcon, PremiumIconBadge } from '../../../shared/components/ui/PremiumIcon';
import { Portal } from '../../../shared/components/ui/Portal';
import { ShareButton } from '../../../shared/components/ui/ShareMenu';

function buildListShareText(list) {
  const lines = list.items.map(i => {
    const qty = i.quantity_value ? `${i.quantity_value}${i.quantity_unit ? ' ' + i.quantity_unit : ''}` : i.quantity;
    return `• ${i.name}${qty ? ` (${qty})` : ''}`;
  });
  return `🛒 ${list.name}\n\n${lines.join('\n')}\n\nListe créée avec iFilino`;
}

function BudgetSummary({ items }) {
  const remaining = items.filter(i => !i.checked);
  const total = remaining.reduce((s, i) => s + (Number(i.estimated_price) || 0), 0);
  const priced = remaining.filter(i => i.estimated_price != null).length;
  if (!remaining.length) return null;
  return (
    <div className="mk-card" style={{ padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>Budget estimé ({priced}/{remaining.length} articles avec prix)</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--mk-text)' }}>{total.toFixed(2)} MAD</div>
      </div>
      <span style={{ fontSize: 28 }}>💰</span>
    </div>
  );
}

// Petite fiche de choix quand plusieurs produits (modules différents)
// partagent le même code-barres — cas rare, pattern bottom-sheet réutilisé.
function BarcodeAmbiguousSheet({ products, onPick, onClose, theme }) {
  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className={`mk-wrap mk-${theme}`} style={{ background: 'var(--mk-surface)', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: '20px 18px 28px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: 'var(--mk-text)' }}>Plusieurs produits trouvés</h3>
        {products.map(p => (
          <button key={p.id} onClick={() => onPick(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)', background: 'var(--mk-card)', marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}>{p.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>{Number(p.price).toFixed(2)} MAD · {p.business?.name || `${p.seller_count} commerces`}</div>
          </button>
        ))}
      </div>
    </div>
    </Portal>
  );
}

export default function ShoppingListsPage() {
  const navigate = useNavigate();
  const cart = useCart();
  const sl = useShoppingLists();
  const [theme] = useMkTheme();

  const [selectedId, setSelectedId] = useState(null);
  const [newListName, setNewListName] = useState('');
  const [presets, setPresets] = useState(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bestStoreResult, setBestStoreResult] = useState(null);
  const [bestStoreLoading, setBestStoreLoading] = useState(false);
  const [usualPurchases, setUsualPurchases] = useState(null);
  const [barcodeAmbiguous, setBarcodeAmbiguous] = useState(null);
  const [checkoutTargets, setCheckoutTargets] = useState(null);
  // Le tri manuel (drag & drop) est désactivé par défaut : Reorder.Group capte
  // le geste vertical, ce qui empêche le scroll tactile de la page tant qu'il
  // est actif. L'utilisateur l'active explicitement pour réordonner, puis le
  // désactive pour retrouver un scroll normal.
  const [reorderMode, setReorderMode] = useState(false);

  const selectedList = useMemo(() => sl.lists.find(l => l.id === selectedId) || null, [sl.lists, selectedId]);

  const itemsByCategory = useMemo(() => {
    if (!selectedList) return {};
    const map = {};
    for (const item of selectedList.items) {
      const cat = item.category || 'autre';
      (map[cat] = map[cat] || []).push(item);
    }
    for (const cat in map) map[cat].sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [selectedList]);

  async function handleCreateList() {
    if (!newListName.trim()) return;
    const list = await sl.createList(newListName.trim(), '🛒');
    setNewListName('');
    setSelectedId(list.id);
  }

  async function openPresetModal() {
    setShowPresetModal(true);
    if (!presets) setPresets(await sl.fetchPresets());
  }

  async function handlePickPreset(key) {
    setGenerating(true);
    try {
      const list = await sl.generateFromPreset(key);
      setShowPresetModal(false);
      setSelectedId(list.id);
    } finally { setGenerating(false); }
  }

  function getLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000 },
      );
    });
  }

  async function handleBestStore() {
    setBestStoreLoading(true);
    try {
      const coords = await getLocation();
      const result = await sl.computeBestStore(selectedList.id, coords);
      setBestStoreResult(result);
    } finally { setBestStoreLoading(false); }
  }

  function handleOrderFromBestStore(recommended) {
    setBestStoreResult(null);
    navigate(`/h/${recommended.slug}?add_list=${selectedList.id}&only_org=${recommended.organization_id}`);
  }

  async function toggleUsualPurchases() {
    if (usualPurchases) { setUsualPurchases(null); return; }
    setUsualPurchases(await sl.fetchUsualPurchases());
  }

  async function addUsualPurchase(product) {
    await sl.addUsualPurchases(selectedList.id, [product.product_id]);
  }

  async function handleCheckout() {
    const plan = await sl.getCheckoutPlan(selectedList.id);
    const targets = [
      ...plan.resto.map(g => ({ ...g, module: 'resto' })),
      ...plan.hanout.map(g => ({ ...g, module: 'hanout' })),
    ];
    if (plan.pharmacie.length) {
      // Toujours affiché à part — jamais de fausse commande automatique pharmacie.
    }
    if (targets.length === 0) {
      alert(plan.pharmacie.length
        ? `${plan.pharmacie.length} article(s) pharmacie — à commander séparément via la fiche du commerce.`
        : 'Aucun article prêt à commander (ajoutez des produits depuis la recherche pour activer cette action).');
      return;
    }
    if (targets.length === 1 && !plan.pharmacie.length && !plan.unresolved.length) {
      proceedToTarget(targets[0]);
      return;
    }
    setCheckoutTargets({ targets, pharmacie: plan.pharmacie, unresolved: plan.unresolved });
  }

  function proceedToTarget(target) {
    setCheckoutTargets(null);
    if (target.module === 'hanout') {
      navigate(`/h/${target.slug}?add_list=${selectedList.id}&only_org=${target.organization_id}`);
      return;
    }
    // resto : pousse tout dans le panier global en une fois, puis /checkout
    const items = target.items
      .filter(it => it.source_product_id != null)
      .map(it => ({
        id: it.source_product_id, libelle: it.name, unit_price: it.unit_price || 0, image_url: it.image_url,
        quantity: Math.max(1, Math.round(it.quantity_value || 1)),
      }));
    if (!items.length) { alert('Ces articles ne sont plus rattachés à un plat précis — ajoutez-les depuis la recherche.'); return; }
    cart.addManyItems(target.slug, target.name, items);
    navigate('/checkout');
  }

  if (sl.loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--mk-muted)' }}>Chargement…</div>;
  }

  // ── Vue détail d'une liste ────────────────────────────────────────────────
  if (selectedList) {
    return (
      <div className="mk-fade-up">
        <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: 'var(--mk-muted)', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>← Mes listes</button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><DashboardIcon icon={selectedList.icon || '🛒'} size={19} />{selectedList.name}</h1>
          <button onClick={async () => { await sl.deleteList(selectedList.id); setSelectedId(null); }} style={{ background: 'none', border: 'none', color: 'var(--mk-red)', cursor: 'pointer', fontSize: 12 }}>Supprimer</button>
        </div>

        {selectedList.completed_at && (
          <div style={{ padding: 12, borderRadius: 12, background: 'var(--mk-green-light)', color: 'var(--mk-green)', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
            ✓ Liste terminée
          </div>
        )}

        <BudgetSummary items={selectedList.items} />

        <div style={{ marginBottom: 16 }}>
          <SmartAddBar
            onAddProduct={fields => sl.addItem(selectedList.id, fields)}
            onAddPlain={name => { if (name) sl.addItem(selectedList.id, { name }); else { const n = window.prompt('Nom de cet article :'); if (n?.trim()) sl.addItem(selectedList.id, { name: n.trim() }); } }}
            onAddBulk={entries => sl.addItemsBulk(selectedList.id, entries)}
            onBarcodeAmbiguous={setBarcodeAmbiguous}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <button onClick={toggleUsualPurchases} className="mk-pill"><PremiumIcon name="refresh" size={14} /> Mes produits habituels</button>
          <button onClick={handleBestStore} disabled={bestStoreLoading} className="mk-pill">{bestStoreLoading ? 'Recherche…' : <><PremiumIcon name="store" size={14} /> Meilleur commerce</>}</button>
          {selectedList.items.length > 0 && (
            <ShareButton title={selectedList.name} text={buildListShareText(selectedList)} />
          )}
          {selectedList.items.length > 1 && (
            <button onClick={() => setReorderMode(m => !m)} className="mk-pill" style={reorderMode ? { background: 'var(--mk-orange)', color: '#fff', borderColor: 'var(--mk-orange)' } : undefined}>
              {reorderMode ? 'Terminer le tri' : <><PremiumIcon name="shuffle" size={14} /> Réorganiser</>}
            </button>
          )}
        </div>

        {reorderMode && (
          <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginTop: -10, marginBottom: 14 }}>
            Glissez les articles pour les réordonner, puis appuyez sur « Terminer le tri ».
          </div>
        )}

        {usualPurchases && (
          <div className="mk-card" style={{ padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--mk-text)' }}>Mes produits habituels</div>
            {usualPurchases.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--mk-muted)' }}>Aucun historique d'achat pour le moment.</div>
            ) : usualPurchases.map(p => (
              <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--mk-text)' }}>{p.name} <span style={{ color: 'var(--mk-muted)' }}>· {p.times_bought}× acheté</span></div>
                <button onClick={() => addUsualPurchase(p)} className="mk-pill" style={{ fontSize: 11 }}>+ Ajouter</button>
              </div>
            ))}
          </div>
        )}

        {selectedList.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mk-muted)' }}>
            <PremiumIconBadge name="note" size={24} style={{ margin:'0 auto' }} />
            <div style={{ marginTop: 8, fontSize: 13 }}>Liste vide — utilisez la barre ci-dessus pour ajouter des articles.</div>
          </div>
        ) : (
          SHOPPING_CATEGORY_ORDER.filter(cat => itemsByCategory[cat]?.length).map(cat => (
            <CategorySection
              key={cat} category={cat} items={itemsByCategory[cat]} reorderMode={reorderMode}
              onToggle={item => sl.updateItem(selectedList.id, item.id, { checked: !item.checked })}
              onDelete={itemId => sl.deleteItem(selectedList.id, itemId)}
              onUpdate={(itemId, patch) => sl.updateItem(selectedList.id, itemId, patch)}
              onReorder={ordered => sl.reorderItems(selectedList.id, ordered.map(i => i.id))}
            />
          ))
        )}

        {selectedList.items.length > 0 && (
          <button onClick={handleCheckout} style={{
            position: 'sticky', bottom: 16, width: '100%', marginTop: 20, padding: 14, borderRadius: 14,
            border: 'none', background: 'var(--mk-orange)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,138,0,.35)',
          }}>
            Commander cette liste
          </button>
        )}

        {bestStoreResult && <BestStoreResultSheet result={bestStoreResult} onClose={() => setBestStoreResult(null)} onOrder={handleOrderFromBestStore} />}
        {barcodeAmbiguous && (
          <BarcodeAmbiguousSheet products={barcodeAmbiguous} theme={theme} onClose={() => setBarcodeAmbiguous(null)} onPick={p => {
            const seller = p.sellers?.[0];
            sl.addItem(selectedList.id, seller ? {
              name: p.name, estimated_price: seller.price, image_url: p.images?.[0] || null,
              source_module: p.module, source_product_id: seller.product_id, preferred_organization_id: seller.business?.id || null,
            } : {
              name: p.name, estimated_price: p.price, image_url: p.images?.[0] || null,
              source_module: p.module, source_product_id: p.id, preferred_organization_id: p.business?.id || null,
            });
            setBarcodeAmbiguous(null);
          }} />
        )}
        {checkoutTargets && (
          <Portal>
          <div onClick={() => setCheckoutTargets(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} className={`mk-wrap mk-${theme}`} style={{ background: 'var(--mk-surface)', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: '20px 18px 28px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: 'var(--mk-text)' }}>Par où commencer ?</h3>
              <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 14 }}>Votre liste couvre plusieurs commerces — commandez chacun séparément.</div>
              {checkoutTargets.targets.map(t => (
                <button key={`${t.module}:${t.organization_id}`} onClick={() => proceedToTarget(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)', background: 'var(--mk-card)', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--mk-text)' }}><DashboardIcon icon={t.module === 'resto' ? '🍽️' : '🏪'} size={14} /> {t.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--mk-muted)' }}>{t.items.length} article{t.items.length > 1 ? 's' : ''}</div>
                </button>
              ))}
              {checkoutTargets.pharmacie.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginTop: 8 }}>{checkoutTargets.pharmacie.length} article(s) pharmacie non inclus — à traiter séparément.</div>
              )}
              {checkoutTargets.unresolved.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginTop: 4 }}>{checkoutTargets.unresolved.length} article(s) libre(s), sans commerce associé — à ajouter manuellement.</div>
              )}
              <button onClick={() => setCheckoutTargets(null)} style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)', background: 'transparent', color: 'var(--mk-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Fermer</button>
            </div>
          </div>
          </Portal>
        )}
      </div>
    );
  }

  // ── Vue d'ensemble — mes listes ───────────────────────────────────────────
  return (
    <div className="mk-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="note" size={19} />Listes de courses</h1>
        <button onClick={openPresetModal} className="mk-pill"><PremiumIcon name="sparkles" size={14} /> Générer une liste</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={newListName} onChange={e => setNewListName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); }}
          placeholder="Nouvelle liste (ex: Courses de la semaine)"
          style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--mk-border)', background: 'var(--mk-input-bg)', color: 'var(--mk-text)', fontSize: 13.5 }}
        />
        <button onClick={handleCreateList} style={{ padding: '11px 20px', background: 'var(--mk-orange)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Créer</button>
      </div>

      {sl.lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--mk-muted)' }}>
          <div style={{ fontSize: 44 }}>📝</div>
          <div style={{ marginTop: 10, fontSize: 13.5 }}>Aucune liste pour le moment — créez-en une ou générez-en une depuis un préset.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
          {sl.lists.map(list => (
            <ListCard key={list.id} list={list} onOpen={l => setSelectedId(l.id)} onDelete={sl.deleteList} />
          ))}
        </div>
      )}

      {showPresetModal && presets && (
        <PresetPickerModal presets={presets} generating={generating} onPick={handlePickPreset} onClose={() => setShowPresetModal(false)} />
      )}
    </div>
  );
}
