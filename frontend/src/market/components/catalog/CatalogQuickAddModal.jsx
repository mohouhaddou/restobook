import React, { useEffect, useRef, useState } from 'react';
import { ASSET } from '../../../shared/services/api';
import { searchCatalog, suggestCatalog, getCatalogProductByBarcode } from '../../../shared/services/catalogApi';
import { BarcodeInput } from '../../../shared/components/ui/BarcodeInput';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';
import { Portal } from '../../../shared/components/ui/Portal';
import { CatalogNewDraftForm } from './CatalogNewDraftForm';

/**
 * Assistant "Catalogue commun" — 3 modes d'ajout rapide (recherche par nom,
 * scan caméra, saisie manuelle de code-barres — les deux derniers sont fournis
 * par <BarcodeInput/> qui bascule déjà entre les deux). Sélectionner un
 * produit catalogue (existant ou nouvellement créé) préremplit le formulaire
 * d'ajout déjà existant du commerçant (ProductsTab/MedicineForm) plutôt que
 * de dupliquer un formulaire prix/stock — voir §4 du plan
 * misty-dreaming-puddle.md pour la justification.
 *
 * Props :
 *   target             : 'hanout' | 'pharmacy'
 *   onClose()
 *   onOpenManualForm(prefill) — prefill est déjà mappé sur la forme du
 *                               formulaire du dashboard appelant.
 */
export function CatalogQuickAddModal({ target, onClose, onOpenManualForm }) {
  const accent = target === 'pharmacy' ? '#0EA5E9' : '#10B981';
  const [tab, setTab] = useState('search'); // 'search' | 'barcode'
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');
  const [barcodeNotFound, setBarcodeNotFound] = useState(null);
  const [barcodeLookupErr, setBarcodeLookupErr] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      suggestCatalog(query.trim()).then(d => setSuggestions(d.products || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function mapToForm(product) {
    const base = { name: product.name, description: product.description || '', barcode: product.barcode || '' };
    if (target === 'hanout') {
      return { ...base, unit: product.unit || 'pièce', images: product.image_url ? [product.image_url] : [] };
    }
    return { ...base, image_url: product.image_url || '' };
  }

  function pick(product) {
    onOpenManualForm(mapToForm(product));
    onClose();
  }

  async function runSearch(e) {
    e?.preventDefault?.();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const d = await searchCatalog(query.trim());
      setResults(d.products || []);
    } catch { setResults([]); }
    setSearching(false);
  }

  async function handleBarcodeDetected(code) {
    setBarcodeValue(code);
    setBarcodeNotFound(null);
    setBarcodeLookupErr('');
    try {
      const d = await getCatalogProductByBarcode(code);
      pick(d.product);
    } catch (e) {
      if (e.status === 404) setBarcodeNotFound(code);
      else setBarcodeLookupErr(e.message || 'Erreur lors de la recherche');
    }
  }

  return (
    <Portal>
      {/* zIndex < 200 : BarcodeCameraScanner (ouvert depuis <BarcodeInput/> ci-dessous) est
          lui aussi porté sur document.body avec zIndex:200 — il doit toujours passer
          au-dessus de cette modale, jamais l'inverse. */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="book" size={18} /> Catalogue commun</h3>
            <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 34, height: 34, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={18} /></button>
          </div>

          <div style={{ display: 'inline-flex', border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <button onClick={() => setTab('search')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', background: tab === 'search' ? accent : '#fff', color: tab === 'search' ? '#fff' : accent, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><PremiumIcon name="search" size={14} /> Rechercher</button>
            <button onClick={() => setTab('barcode')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', background: tab === 'barcode' ? accent : '#fff', color: tab === 'barcode' ? '#fff' : accent, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}><PremiumIcon name="scan" size={14} /> Code-barres</button>
          </div>

          {tab === 'search' && (
            <div>
              <form onSubmit={runSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Nom, marque, catégorie…"
                  autoFocus
                  style={{ flex: 1, padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none' }}
                />
                <button type="submit" style={{ padding: '10px 16px', background: accent, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Chercher</button>
              </form>

              {!results && suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {suggestions.map(p => <ProductRow key={p.id} product={p} onPick={() => pick(p)} />)}
                </div>
              )}

              {results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {searching ? <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>Recherche…</div> : results.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20, fontSize: 13 }}>Aucun résultat pour « {query} ».</div>
                  ) : results.map(p => <ProductRow key={p.id} product={p} onPick={() => pick(p)} />)}
                </div>
              )}

              <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Produit introuvable ?</div>
                <CatalogNewDraftForm onCreated={pick} onCancel={onClose} />
              </div>
            </div>
          )}

          {tab === 'barcode' && (
            <div>
              <BarcodeInput
                value={barcodeValue}
                onChange={setBarcodeValue}
                onDetected={handleBarcodeDetected}
                placeholder="Scanner ou saisir le code-barres…"
              />
              {barcodeLookupErr && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626' }}>{barcodeLookupErr}</div>}

              {barcodeNotFound && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
                  <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 10 }}>
                    Aucun produit pour le code <strong>{barcodeNotFound}</strong> dans le catalogue commun.
                  </div>
                  <CatalogNewDraftForm initialBarcode={barcodeNotFound} onCreated={pick} onCancel={() => setBarcodeNotFound(null)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

function ProductRow({ product, onPick }) {
  return (
    <button onClick={onPick} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
      {product.image_url ? (
        <img src={ASSET(product.image_url)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F9FAFB', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#64748B' }}><PremiumIcon name="package" size={20} /></div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
        {product.brand?.name && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{product.brand.name}</div>}
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#FF8A00' }}>+</span>
    </button>
  );
}
