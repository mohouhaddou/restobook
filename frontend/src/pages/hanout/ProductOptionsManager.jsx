import React, { useState, useEffect } from 'react';
import { API } from '../../api';

const OPTION_TYPES = [
  { v:'single_choice', l:'Choix unique',    icon:'🔘' },
  { v:'multi_choice',  l:'Choix multiple',  icon:'☑️' },
  { v:'quantity',      l:'Quantité',        icon:'🔢' },
  { v:'weight',        l:'Poids',           icon:'⚖️' },
  { v:'text',          l:'Texte libre',     icon:'📝' },
  { v:'date_slot',     l:'Date / Créneau',  icon:'📅' },
];
const UNITS = ['pièce','kg','g','litre','ml','pack','portion','personne','heure'];

function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rb_token');
  return fetch(API(path), {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body,
  });
}

const EMPTY_OPT = { name:'', type:'single_choice', unit:'', min_value:'', max_value:'', step:'', extra_price:'0', required: true };
const EMPTY_VAL = { label:'', extra_price:'0' };

/* ── Option Form ─────────────────────────────────────────────────────────── */
function OptionForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_OPT, ...initial });
  const [values, setValues] = useState(initial?.values || []);
  const [newVal, setNewVal] = useState({ ...EMPTY_VAL });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const needsValues = ['single_choice','multi_choice'].includes(form.type);
  const needsNumeric = ['quantity','weight'].includes(form.type);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({ ...form, values });
    setSaving(false);
  }

  function addValue() {
    if (!newVal.label.trim()) return;
    setValues(prev => [...prev, { ...newVal, id: null, sort_order: prev.length }]);
    setNewVal({ ...EMPTY_VAL });
  }

  function removeValue(i) { setValues(prev => prev.filter((_, j) => j !== i)); }

  return (
    <div style={{ background:'#F9FAFB', borderRadius:12, padding:'16px', border:'1.5px solid #E5E7EB' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <div style={{ gridColumn:'1/-1' }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Nom de l'option *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Taille, Découpe, Accompagnement…"
            style={{ width:'100%', borderRadius:8, border:'1.5px solid #D1D5DB', padding:'8px 12px', fontSize:14, boxSizing:'border-box', fontFamily:'inherit', outline:'none' }} />
        </div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            style={{ width:'100%', borderRadius:8, border:'1.5px solid #D1D5DB', padding:'8px 12px', fontSize:14, boxSizing:'border-box', fontFamily:'inherit', outline:'none', background:'#fff' }}>
            {OPTION_TYPES.map(t => <option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Obligatoire</label>
          <input type="checkbox" checked={form.required} onChange={e => set('required', e.target.checked)}
            style={{ width:18, height:18, cursor:'pointer' }} />
        </div>
      </div>

      {/* Numeric options */}
      {needsNumeric && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:10 }}>
          {[['min_value','Min'],['max_value','Max'],['step','Pas'],['unit','Unité']].map(([k,l]) => (
            <div key={k}>
              <label style={{ fontSize:11, fontWeight:600, color:'#6B7280', display:'block', marginBottom:3 }}>{l}</label>
              {k === 'unit'
                ? <select value={form.unit} onChange={e => set('unit', e.target.value)}
                    style={{ width:'100%', borderRadius:8, border:'1.5px solid #D1D5DB', padding:'7px 8px', fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff' }}>
                    <option value="">—</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                : <input type="number" value={form[k]} onChange={e => set(k, e.target.value)} step="any" min="0"
                    style={{ width:'100%', borderRadius:8, border:'1.5px solid #D1D5DB', padding:'7px 8px', fontSize:13, boxSizing:'border-box', fontFamily:'inherit', outline:'none' }} />
              }
            </div>
          ))}
        </div>
      )}

      {/* Text/date extra price */}
      {(form.type === 'text' || form.type === 'date_slot') && (
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Prix supplémentaire fixe (MAD)</label>
          <input type="number" value={form.extra_price} onChange={e => set('extra_price', e.target.value)} min="0" step="0.5"
            style={{ width:'50%', borderRadius:8, border:'1.5px solid #D1D5DB', padding:'8px 12px', fontSize:14, fontFamily:'inherit', outline:'none' }} />
        </div>
      )}

      {/* Values for choice types */}
      {needsValues && (
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:8 }}>Valeurs possibles</label>
          {values.map((v, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
              <input value={v.label} onChange={e => { const c = [...values]; c[i] = { ...c[i], label: e.target.value }; setValues(c); }}
                placeholder="Label…" style={{ flex:1, borderRadius:8, border:'1.5px solid #D1D5DB', padding:'7px 10px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:12, color:'#6B7280' }}>+</span>
                <input type="number" value={v.extra_price} min="0" step="0.5"
                  onChange={e => { const c = [...values]; c[i] = { ...c[i], extra_price: e.target.value }; setValues(c); }}
                  style={{ width:70, borderRadius:8, border:'1.5px solid #D1D5DB', padding:'7px 8px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
                <span style={{ fontSize:12, color:'#6B7280' }}>MAD</span>
              </div>
              <button onClick={() => removeValue(i)} style={{ background:'none', border:'none', color:'#EF4444', cursor:'pointer', fontSize:18, padding:'0 4px' }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <input value={newVal.label} onChange={e => setNewVal(p => ({ ...p, label: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addValue()}
              placeholder="Nouvelle valeur…" style={{ flex:1, borderRadius:8, border:'1.5px dashed #D1D5DB', padding:'7px 10px', fontSize:13, fontFamily:'inherit', outline:'none', background:'#fff' }} />
            <input type="number" value={newVal.extra_price} min="0" step="0.5"
              onChange={e => setNewVal(p => ({ ...p, extra_price: e.target.value }))}
              style={{ width:70, borderRadius:8, border:'1.5px dashed #D1D5DB', padding:'7px 8px', fontSize:13, fontFamily:'inherit', outline:'none' }} />
            <button onClick={addValue} style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#E5E7EB', color:'#374151', fontWeight:700, fontSize:13, cursor:'pointer' }}>+ Ajouter</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button onClick={save} disabled={saving} style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background: saving ? '#E5E7EB' : '#10B981', color:'#fff', fontWeight:700, cursor: saving ? 'default' : 'pointer' }}>
          {saving ? 'Enregistrement…' : '✓ Enregistrer'}
        </button>
        <button onClick={onCancel} style={{ padding:'10px 16px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'#fff', color:'#6B7280', fontWeight:600, cursor:'pointer' }}>Annuler</button>
      </div>
    </div>
  );
}

/* ══ MAIN EXPORT ════════════════════════════════════════════════════════════ */
export default function ProductOptionsManager({ productId, productName, orgSlug, onClose }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [editing, setEditing] = useState(null); // option id

  const path = `/hanout-pro/products/${productId}/options`;

  async function load() {
    setLoading(true);
    try {
      const r = await authFetch(path);
      const d = await r.json();
      setOptions(d.options || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [productId]);

  async function handleSaveNew(form) {
    const r = await authFetch(path, { method:'POST', body: form });
    if (r.ok) { await load(); setAdding(false); }
  }

  async function handleSaveEdit(optionId, form) {
    await authFetch(`/hanout-pro/options/${optionId}`, { method:'PUT', body: form });
    // Update values
    const opt = options.find(o => o.id === optionId);
    const existingIds = (opt?.values || []).map(v => v.id);
    const newValues   = form.values || [];

    for (const v of newValues) {
      if (v.id) await authFetch(`/hanout-pro/options/values/${v.id}`, { method:'PUT', body: v });
      else await authFetch(`/hanout-pro/options/${optionId}/values`, { method:'POST', body: v });
    }
    // Delete removed values
    for (const id of existingIds) {
      if (!newValues.find(v => v.id === id)) await authFetch(`/hanout-pro/options/values/${id}`, { method:'DELETE' });
    }
    await load();
    setEditing(null);
  }

  async function deleteOption(id) {
    if (!confirm('Supprimer cette option ?')) return;
    await authFetch(`/hanout-pro/options/${id}`, { method:'DELETE' });
    await load();
  }

  async function toggleAvailable(opt) {
    await authFetch(`/hanout-pro/options/${opt.id}`, { method:'PUT', body: { available: !opt.available } });
    await load();
  }

  const typeInfo = (t) => OPTION_TYPES.find(x => x.v === t) || { icon:'❓', l: t };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:680, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:'#111827' }}>⚙️ Options produit</div>
            <div style={{ fontSize:13, color:'#6B7280', marginTop:2 }}>{productName}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9CA3AF' }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {loading
            ? <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>Chargement…</div>
            : (
              <>
                {options.length === 0 && !adding && (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'#9CA3AF' }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>⚙️</div>
                    <div style={{ fontSize:15, fontWeight:700 }}>Aucune option configurée</div>
                    <div style={{ fontSize:13, marginTop:4 }}>Ajoutez des options pour personnaliser ce produit</div>
                  </div>
                )}

                {options.map(opt => (
                  <div key={opt.id} style={{ background:'#F9FAFB', borderRadius:12, padding:'14px 16px', marginBottom:12, border:'1.5px solid #E5E7EB' }}>
                    {editing === opt.id
                      ? <OptionForm initial={{ ...opt, values: opt.values || [] }} onSave={form => handleSaveEdit(opt.id, form)} onCancel={() => setEditing(null)} />
                      : (
                        <div>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:16 }}>{typeInfo(opt.type).icon}</span>
                              <span style={{ fontWeight:800, fontSize:15, color:'#111827' }}>{opt.name}</span>
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:`${opt.required ? '#FEE2E2' : '#F3F4F6'}`, color: opt.required ? '#DC2626' : '#6B7280', fontWeight:700 }}>
                                {opt.required ? 'Requis' : 'Optionnel'}
                              </span>
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:'#EFF6FF', color:'#2563EB', fontWeight:600 }}>{typeInfo(opt.type).l}</span>
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={() => toggleAvailable(opt)} style={{ padding:'4px 10px', borderRadius:8, border:`1.5px solid ${opt.available ? '#10B981' : '#E5E7EB'}`, background: opt.available ? '#F0FDF4' : '#F9FAFB', color: opt.available ? '#10B981' : '#9CA3AF', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                                {opt.available ? '✓ Actif' : '✗ Inactif'}
                              </button>
                              <button onClick={() => setEditing(opt.id)} style={{ padding:'4px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', fontSize:12, cursor:'pointer' }}>✏️</button>
                              <button onClick={() => deleteOption(opt.id)} style={{ padding:'4px 10px', borderRadius:8, border:'1.5px solid #FEE2E2', background:'#FEF2F2', color:'#EF4444', fontSize:12, cursor:'pointer' }}>🗑️</button>
                            </div>
                          </div>
                          {/* Values preview */}
                          {(opt.type === 'single_choice' || opt.type === 'multi_choice') && opt.values?.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                              {opt.values.map(v => (
                                <span key={v.id} style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:'#fff', border:'1px solid #E5E7EB', color:'#374151', fontWeight:600 }}>
                                  {v.label}{Number(v.extra_price) > 0 ? ` +${Number(v.extra_price).toFixed(2)} MAD` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                          {(opt.type === 'quantity' || opt.type === 'weight') && (
                            <span style={{ fontSize:12, color:'#6B7280' }}>
                              {opt.min_value ?? '?'} → {opt.max_value ?? '?'} {opt.unit || ''} (pas: {opt.step ?? 1})
                            </span>
                          )}
                        </div>
                      )
                    }
                  </div>
                ))}

                {adding && (
                  <OptionForm onSave={handleSaveNew} onCancel={() => setAdding(false)} />
                )}
              </>
            )
          }
        </div>

        {/* Footer */}
        {!adding && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid #E5E7EB', flexShrink:0 }}>
            <button onClick={() => setAdding(true)} style={{ width:'100%', padding:'11px', borderRadius:12, border:'2px dashed #D1D5DB', background:'#F9FAFB', color:'#374151', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              + Ajouter une option
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
