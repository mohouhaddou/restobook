import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useApi } from '../../shared/hooks/useApi';

const STATUS_OPTIONS = ['coming_soon', 'ready_to_generate', 'available', 'disabled'];
const DEFAULT_FORM = { type: '', title: '', description: '', price: 0, currency: 'MAD', status: 'coming_soon' };

/**
 * Panneau "Produits numériques" — CRUD SuperAdmin sur les DigitalProduct d'une Story, intégré à
 * PortalArticleEditorPage.jsx. Visible seulement une fois la Story enregistrée (portalContentId
 * requis, une Story pas encore créée n'a pas d'id).
 */
export function DigitalProductsPanel({ portalContentId, studyLessonId }) {
  const api = useApi();
  const [types, setTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/superadmin/digital-products/types'),
      api.get("/superadmin/digital-products?" + (studyLessonId ? "studyLessonId=" + studyLessonId : "portalContentId=" + portalContentId)),
    ])
      .then(([typesData, productsData]) => {
        setTypes(typesData.types || []);
        setProducts(productsData.products || []);
      })
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { if (portalContentId || studyLessonId) load(); }, [portalContentId, studyLessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createProduct() {
    if (!form.type || !form.title.trim()) return setMessage('Type et titre requis.');
    setSaving(true);
    try {
      await api.post('/superadmin/digital-products', { ...form, ...(studyLessonId ? { study_lesson_id: studyLessonId } : { portal_content_id: portalContentId }), price: Number(form.price) || 0 });
      setForm(DEFAULT_FORM);
      setMessage('Produit créé.');
      load();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(product, status) {
    try { await api.put(`/superadmin/digital-products/${product.id}`, { status }); load(); }
    catch (error) { setMessage(error.message); }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Supprimer « ${product.title} » ?`)) return;
    try { await api.del(`/superadmin/digital-products/${product.id}`); load(); }
    catch (error) { setMessage(error.message); }
  }

  async function regenerate(product) {
    try { await api.post(`/superadmin/digital-products/${product.id}/regenerate`, {}); setMessage('Régénération lancée.'); }
    catch (error) { setMessage(error.message); }
  }

  if (!portalContentId && !studyLessonId) return null;

  return (
    <div className="card portal-admin-panel portal-admin-digital-panel">
      <label className="form-label">Produits numériques</label>
      {message && <div className="alert alert-info py-1 px-2" style={{ fontSize: 12 }} role="status">{message}</div>}

      {loading ? <small className="portal-admin-help">Chargement…</small> : (
        <div className="portal-admin-product-list" style={{ marginBottom: 12 }}>
          {products.length === 0 && <small className="portal-admin-help">Aucun produit numérique pour ce contenu.</small>}
          {products.map(product => (
            <div key={product.id} className="portal-admin-product-row" style={{ fontSize: 12.5, border: '1px solid var(--rb-border, #e5e7eb)', borderRadius: 8, padding: '6px 8px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{product.title}</strong> <span style={{ color: '#6b7280' }}>({product.type})</span>
                <div style={{ color: '#6b7280' }}>{Number(product.price).toFixed(2)} {product.currency}</div>
              </div>
              <select className="form-select form-select-sm portal-admin-product-status" value={product.status} onChange={event => updateStatus(product, event.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" className="btn btn-outline-primary btn-xs" title="Forcer la régénération" onClick={() => regenerate(product)}><RefreshCw size={13}/></button>
              <button type="button" className="btn btn-outline-primary btn-xs" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => removeProduct(product)}><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
      )}

      <div className="portal-admin-product-form" style={{ borderTop: '1px dashed var(--rb-border, #e5e7eb)', paddingTop: 10 }}>
        <select className="form-select form-select-sm" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>
          <option value="">— Type —</option>
          {types.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>
        <input className="form-control form-control-sm" placeholder="Titre" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/>
        <textarea className="form-control form-control-sm" rows={2} placeholder="Description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })}/>
        <div className="portal-admin-product-pricing">
          <input className="form-control form-control-sm" type="number" step="0.01" placeholder="Prix" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })}/>
          <input className="form-control form-control-sm" style={{ width: 70 }} placeholder="MAD" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value })}/>
        </div>
        <select className="form-select form-select-sm" value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-xs" disabled={saving} onClick={createProduct}><Plus size={13}/> Ajouter</button>
      </div>
    </div>
  );
}
