import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { AdsManagerLayout } from './AdsManagerLayout';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const SOURCE_LABELS = { internal: 'Interne', partner: 'Partenaire', adsense: 'AdSense' };
const STATUS_META = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  scheduled: { label: 'Planifiée', color: '#2563EB', bg: '#EFF6FF' },
  active: { label: 'Active', color: '#16A34A', bg: '#F0FDF4' },
  paused: { label: 'Suspendue', color: '#D97706', bg: '#FFFBEB' },
  expired: { label: 'Expirée', color: '#9CA3AF', bg: '#F9FAFB' },
  archived: { label: 'Archivée', color: '#9CA3AF', bg: '#F9FAFB' },
};

function StatCard({ label, value, icon }) {
  return (
    <div className="if-card" style={{ padding: 16, flex: 1, minWidth: 140 }}>
      <PremiumIcon name={icon} size={22} style={{ color: '#FF8A00' }} />
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{label}</div>
    </div>
  );
}

const inputStyle = { minHeight: 36, border: '1px solid #D1D5DB', borderRadius: 8, padding: '6px 10px', fontSize: 13 };

const DEFAULT_FILTERS = { q: '', status: '', source_type: '', platform: '', advertiser: '' };

export default function AdCampaignsListPage() {
  const { get, post, del } = useApi();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pendingDelete, setPendingDelete] = useState(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    Promise.all([
      get(`/superadmin/ads?${params.toString()}`),
      get('/superadmin/ads/summary'),
      get('/superadmin/ad-placements'),
    ]).then(([campaignsRes, summaryRes, placementsRes]) => {
      setCampaigns(campaignsRes.campaigns || []);
      setSummary(summaryRes);
      setPlacements(placementsRes.placements || []);
      setLoading(false);
    }).catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDuplicate(c) {
    try { await post(`/superadmin/ads/${c.id}/duplicate`, {}); setMsg('Campagne dupliquée en brouillon.'); setKind('success'); load(); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }
  async function handleActivate(c) {
    try { await post(`/superadmin/ads/${c.id}/activate`, {}); load(); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }
  async function handleSuspend(c) {
    try { await post(`/superadmin/ads/${c.id}/suspend`, {}); load(); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try { await del(`/superadmin/ads/${id}`); setMsg('Campagne supprimée.'); setKind('success'); setCampaigns(prev => prev.filter(c => c.id !== id)); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }

  const placementNameById = new Map(placements.map(p => [p.id, p.name]));

  return (
    <AdsManagerLayout
      title="Publicités" icon="radio"
      actions={<button className="if-btn if-btn-primary if-btn-sm" onClick={() => navigate('/superadmin/ads/new')}><PremiumIcon name="plus" size={14} /> Nouvelle publicité</button>}
    >
      {summary && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatCard label="Campagnes actives" value={summary.active_campaigns} icon="play" />
          <StatCard label="Planifiées" value={summary.scheduled_campaigns} icon="calendar" />
          <StatCard label="Expirées" value={summary.expired_campaigns} icon="clock" />
          <StatCard label="Impressions" value={summary.impressions} icon="eye" />
          <StatCard label="Clics" value={summary.clicks} icon="target" />
          <StatCard label="CTR" value={`${(summary.ctr * 100).toFixed(1)}%`} icon="trendingUp" />
          <StatCard label="Revenus estimés" value={summary.estimated_revenue != null ? `${summary.estimated_revenue.toFixed(2)} MAD` : '—'} icon="wallet" />
        </div>
      )}

      <div className="if-card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Recherche
          <input style={inputStyle} placeholder="Nom de campagne…" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Statut
          <select style={inputStyle} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Tous</option>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Type
          <select style={inputStyle} value={filters.source_type} onChange={e => setFilters({ ...filters, source_type: e.target.value })}>
            <option value="">Tous</option>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Plateforme
          <select style={inputStyle} value={filters.platform} onChange={e => setFilters({ ...filters, platform: e.target.value })}>
            <option value="">Toutes</option>
            {['global', 'homepage', 'marketplace', 'discover', 'play', 'user_dashboard'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#4B5563' }}>
          Annonceur
          <input style={inputStyle} placeholder="Nom annonceur…" value={filters.advertiser} onChange={e => setFilters({ ...filters, advertiser: e.target.value })} />
        </label>
        {Object.values(filters).some(Boolean) && (
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Réinitialiser</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : campaigns.length === 0 ? (
        <EmptyState icon="radio" title="Aucune publicité" subtitle="Créez votre première campagne pour l'afficher sur les plateformes iFilino." />
      ) : (
        <div className="if-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 11.5, textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Aperçu</th>
                  <th style={{ padding: 10 }}>Nom</th>
                  <th style={{ padding: 10 }}>Annonceur</th>
                  <th style={{ padding: 10 }}>Type</th>
                  <th style={{ padding: 10 }}>Emplacements</th>
                  <th style={{ padding: 10 }}>Dates</th>
                  <th style={{ padding: 10 }}>Priorité</th>
                  <th style={{ padding: 10 }}>Impressions</th>
                  <th style={{ padding: 10 }}>Clics</th>
                  <th style={{ padding: 10 }}>CTR</th>
                  <th style={{ padding: 10 }}>Statut</th>
                  <th style={{ padding: 10 }}></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const st = STATUS_META[c.status] || STATUS_META.draft;
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                      <td style={{ padding: 10 }}>
                        <div style={{ width: 56, height: 32, borderRadius: 6, background: '#F3F4F6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.desktop_image_url ? <img src={c.desktop_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <PremiumIcon name={c.source_type === 'adsense' ? 'radio' : 'image'} size={16} style={{ opacity: .4 }} />}
                        </div>
                      </td>
                      <td style={{ padding: 10, fontWeight: 700 }}>{c.name}</td>
                      <td style={{ padding: 10 }}>{c.advertiser_name || '—'}</td>
                      <td style={{ padding: 10 }}>{SOURCE_LABELS[c.source_type]}</td>
                      <td style={{ padding: 10, maxWidth: 180 }}>{(c.placements || []).map(p => placementNameById.get(p.id) || p.code).join(', ') || '—'}</td>
                      <td style={{ padding: 10, whiteSpace: 'nowrap', fontSize: 12 }}>{c.start_at ? new Date(c.start_at).toLocaleDateString('fr-FR') : '…'} → {c.end_at ? new Date(c.end_at).toLocaleDateString('fr-FR') : '…'}</td>
                      <td style={{ padding: 10 }}>{c.priority}</td>
                      <td style={{ padding: 10 }}>{c.impressions_count}</td>
                      <td style={{ padding: 10 }}>{c.clicks_count}</td>
                      <td style={{ padding: 10 }}>{(c.ctr * 100).toFixed(1)}%</td>
                      <td style={{ padding: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
                        {c.is_active_now && <div style={{ fontSize: 9.5, color: '#16A34A', marginTop: 2 }}>Actif maintenant</div>}
                      </td>
                      <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => navigate(`/superadmin/ads/${c.id}/edit`)}><PremiumIcon name="edit" size={13} /></button>
                          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => navigate(`/superadmin/ads/${c.id}/stats`)}><PremiumIcon name="chart" size={13} /></button>
                          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => handleDuplicate(c)}><PremiumIcon name="copy" size={13} /></button>
                          {['active', 'paused'].includes(c.status) && (
                            <button className="if-btn if-btn-outline if-btn-sm" onClick={() => (c.status === 'active' ? handleSuspend(c) : handleActivate(c))}>
                              <PremiumIcon name={c.status === 'active' ? 'pause' : 'play'} size={13} />
                            </button>
                          )}
                          <button className="if-btn if-btn-outline if-btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => setPendingDelete(c)}><PremiumIcon name="trash" size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer cette publicité ?"
        message={`« ${pendingDelete?.name} » sera définitivement supprimée, avec ses statistiques.`}
        confirmLabel="Supprimer" confirmClass="btn-danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </AdsManagerLayout>
  );
}
