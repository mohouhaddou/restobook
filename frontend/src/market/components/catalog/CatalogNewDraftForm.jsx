import React, { useEffect, useState } from 'react';
import { ASSET } from '../../../shared/services/api';
import { createCatalogProduct, uploadCatalogImage, listCatalogCategories } from '../../../shared/services/catalogApi';
import { ProductImageCapture } from '../../../shared/components/ui/ProductImageCapture';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const inputStyle = { width: '100%', padding: '10px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const fieldLabel = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' };

/**
 * Formulaire minimal de création d'une fiche catalogue partagée quand le
 * commerçant ne trouve pas son produit (scan/recherche infructueux). La
 * fiche est créée en `pending_review` — jamais auto-vérifiée — voir §4 du
 * plan misty-dreaming-puddle.md.
 *
 * Props :
 *   initialBarcode : string  — préfilé depuis le scan/la saisie manuelle qui a échoué
 *   onCreated(product)       — appelé une fois la fiche créée (ou un doublon choisi)
 *   onCancel()
 */
export function CatalogNewDraftForm({ initialBarcode = '', onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [candidates, setCandidates] = useState(null); // doublons possibles proposés par le serveur

  useEffect(() => {
    listCatalogCategories().then(d => setCategories(d.categories || [])).catch(() => {});
  }, []);

  const roots = categories.filter(c => !c.parent_id);
  const childrenOf = pid => categories.filter(c => c.parent_id === pid);

  async function submit(force = false) {
    if (!name.trim()) { setErr('Nom requis'); return; }
    setSaving(true); setErr(''); setCandidates(null);
    try {
      const d = await createCatalogProduct({
        name: name.trim(),
        brand_name: brandName.trim() || undefined,
        category_id: categoryId || undefined,
        barcode: barcode.trim() || undefined,
        description: description.trim() || undefined,
        image_url: imageUrl || undefined,
        force,
      });
      onCreated?.(d.product);
    } catch (e) {
      if (e.status === 409 && e.body?.error === 'duplicate_barcode') {
        setErr(`Ce code-barres est déjà utilisé par "${e.body.product.name}".`);
        setCandidates([e.body.product]);
      } else if (e.status === 409 && e.body?.error === 'possible_duplicates') {
        setErr('Des produits proches existent déjà dans le catalogue.');
        setCandidates(e.body.candidates || []);
      } else {
        setErr(e.message || 'Erreur lors de la création');
      }
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
        Produit introuvable dans le catalogue commun — créez sa fiche. Elle sera marquée <strong>en cours de vérification</strong> mais vous pouvez l'utiliser immédiatement dans votre commerce.
      </div>

      {err && <div style={{ marginBottom: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>{err}</div>}

      {candidates && candidates.length > 0 && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {candidates.map(c => (
            <button key={c.id} onClick={() => onCreated?.(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#F9FAFB', cursor: 'pointer' }}>
              {c.image_url ? <img src={ASSET(c.image_url)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', color: '#64748B' }}><PremiumIcon name="package" size={18} /></div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Utiliser cette fiche existante</div>
              </div>
            </button>
          ))}
          <button onClick={() => submit(true)} disabled={saving} style={{ padding: '8px 12px', border: '1.5px dashed #F59E0B', borderRadius: 10, background: '#FFFBEB', color: '#B45309', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            Non, créer quand même une nouvelle fiche
          </button>
        </div>
      )}

      {!candidates && (
        <>
          <div style={{ marginBottom: 12 }}>
            <span style={fieldLabel}>Nom *</span>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ex : Coca-Cola 1.5L" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <span style={fieldLabel}>Marque</span>
              <input value={brandName} onChange={e => setBrandName(e.target.value)} style={inputStyle} placeholder="Ex : Coca-Cola" />
            </div>
            <div>
              <span style={fieldLabel}>Catégorie</span>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Sans catégorie</option>
                {roots.map(root => (
                  <React.Fragment key={root.id}>
                    <option value={root.id}>{root.name}</option>
                    {childrenOf(root.id).map(child => (
                      <option key={child.id} value={child.id}>&nbsp;&nbsp;↳ {child.name}</option>
                    ))}
                  </React.Fragment>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={fieldLabel}>Code-barres (facultatif)</span>
            <input value={barcode} onChange={e => setBarcode(e.target.value)} style={inputStyle} placeholder="EAN/UPC" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={fieldLabel}>Description (facultatif)</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={fieldLabel}>Photo (facultatif)</span>
            {imageUrl && <img src={ASSET(imageUrl)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />}
            <ProductImageCapture uploadFn={uploadCatalogImage} onImageReady={setImageUrl} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '11px', border: '1.5px solid #E5E7EB', borderRadius: 10, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Annuler</button>
            <button onClick={() => submit(false)} disabled={saving} style={{ flex: 2, padding: '11px', background: '#FF8A00', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Création…' : 'Créer ce produit'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
