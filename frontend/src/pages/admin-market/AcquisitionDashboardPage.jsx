import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { AreaRadiusPicker } from '../../shared/components/geo/AreaRadiusPicker';

const STATUS_TABS = [
  { value: 'eligible', label: 'Eligibles' },
  { value: 'approved', label: 'Valides' },
  { value: 'published', label: 'Publies' },
  { value: 'duplicate', label: 'Doublons' },
  { value: 'out_of_scope', label: 'Hors zone' },
  { value: 'rejected', label: 'Rejetes' },
  { value: 'all', label: 'Tous' },
];

const statusTone = {
  eligible: ['#0F766E', '#ECFDF5', '#99F6E4'],
  approved: ['#166534', '#F0FDF4', '#BBF7D0'],
  published: ['#1D4ED8', '#EFF6FF', '#BFDBFE'],
  duplicate: ['#92400E', '#FFFBEB', '#FDE68A'],
  out_of_scope: ['#991B1B', '#FEF2F2', '#FECACA'],
  rejected: ['#6B7280', '#F9FAFB', '#E5E7EB'],
  ready: ['#0369A1', '#F0F9FF', '#BAE6FD'],
  running: ['#166534', '#F0FDF4', '#BBF7D0'],
  paused: ['#92400E', '#FFFBEB', '#FDE68A'],
  stopped: ['#991B1B', '#FEF2F2', '#FECACA'],
  completed: ['#1D4ED8', '#EFF6FF', '#BFDBFE'],
};

// Categories reellement supportees par le connecteur OSM (voir
// osmConnector.js CATEGORY_FILTERS) — pas de checkbox pour une categorie
// sans mapping de tag OSM fiable (ex: dark_kitchen, pharmacie_de_garde,
// droguerie, quincaillerie... non ajoutees, pas de tag OSM univoque confirme).
const CATEGORY_GROUPS = [
  {
    label: 'Restauration',
    options: [
      { key: 'restaurant', label: 'Restaurants' },
      { key: 'cafe', label: 'Cafes' },
      { key: 'boulangerie', label: 'Boulangeries' },
      { key: 'patisserie', label: 'Patisseries' },
      { key: 'fast_food', label: 'Fast-food' },
      { key: 'glacier', label: 'Glaciers' },
    ],
  },
  {
    label: 'Commerces',
    options: [
      { key: 'epicerie', label: 'Epiceries / Hanouts' },
      { key: 'supermarche', label: 'Supermarches' },
      { key: 'boucherie', label: 'Boucheries' },
      { key: 'primeur', label: 'Primeurs' },
    ],
  },
  {
    label: 'Sante',
    options: [
      { key: 'pharmacie', label: 'Pharmacies' },
    ],
  },
];
const MAX_CATEGORIES = 3;
const PAGE_SIZE = 20;

const DEFAULT_CAMPAIGN_FORM = {
  name: '',
  countryCode: 'MA',
  region: 'Rabat-Sale-Kenitra',
  province: 'Skhirat-Temara',
  city: 'Skhirat',
  centerLat: '33.849',
  centerLng: '-7.031',
  radiusKm: '3',
  categories: ['restaurant', 'cafe', 'boulangerie'],
  maxCells: '20',
  maxRequests: '300',
  maxCandidates: '150',
  maxRuntimeMinutes: '60',
  maxConcurrentCells: '1',
  maxConcurrentTasks: '1',
  maxTasksRun: '4',
};

function Badge({ value }) {
  const [color, bg, border] = statusTone[value] || ['#374151', '#F9FAFB', '#E5E7EB'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '2px 8px', borderRadius: 6, border: `1px solid ${border}`, color, background: bg, fontSize: 12, fontWeight: 700 }}>
      {value || '-'}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, minWidth: 130 }}>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, color: '#111827', fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', min, max, step }) {
  return (
    <label style={{ display: 'grid', gap: 5, fontSize: 12, color: '#4B5563', fontWeight: 800 }}>
      {label}
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 38, border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: '#111827' }}
      />
    </label>
  );
}

function countRows(rows) {
  return Object.fromEntries((rows || []).map(row => [row.status, Number(row.count)]));
}

export default function AcquisitionDashboardPage() {
  const { get, post, del } = useApi();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState('eligible');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const [campaignForm, setCampaignForm] = useState(DEFAULT_CAMPAIGN_FORM);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignMetrics, setCampaignMetrics] = useState(null);
  const [campaignTasks, setCampaignTasks] = useState([]);
  const [campaignCells, setCampaignCells] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [controlLoading, setControlLoading] = useState(false);

  const selectedCandidate = useMemo(
    () => candidates.find(candidate => candidate.id === selected?.id) || selected,
    [candidates, selected]
  );

  const candidateCounts = countRows(stats?.candidates);
  const taskCounts = countRows(campaignMetrics?.tasks);
  const campaignCandidateCounts = countRows(campaignMetrics?.candidates);

  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCandidates = useMemo(
    () => candidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [candidates, currentPage]
  );
  const allPageSelected = pagedCandidates.length > 0 && pagedCandidates.every(candidate => selectedIds.has(candidate.id));

  function toggleSelectAllOnPage() {
    setSelectedIds(current => {
      const next = new Set(current);
      if (allPageSelected) {
        pagedCandidates.forEach(candidate => next.delete(candidate.id));
      } else {
        pagedCandidates.forEach(candidate => next.add(candidate.id));
      }
      return next;
    });
  }

  function toggleSelectOne(id) {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function updateCampaignForm(field, value) {
    setCampaignForm(current => ({ ...current, [field]: value }));
  }

  const handleAreaCenterChange = useCallback((lat, lng) => {
    setCampaignForm(current => ({ ...current, centerLat: String(lat), centerLng: String(lng) }));
  }, []);

  function toggleCategory(key) {
    setCampaignForm(current => {
      const has = current.categories.includes(key);
      if (has) return { ...current, categories: current.categories.filter(c => c !== key) };
      if (current.categories.length >= MAX_CATEGORIES) return current;
      return { ...current, categories: [...current.categories, key] };
    });
  }

  function buildCampaignPayload() {
    const categories = campaignForm.categories.slice(0, MAX_CATEGORIES);
    return {
      name: campaignForm.name.trim(),
      countryCode: campaignForm.countryCode.trim().toUpperCase(),
      region: campaignForm.region.trim() || null,
      province: campaignForm.province.trim() || null,
      city: campaignForm.city.trim() || null,
      geographicScope: {
        type: 'radius',
        centerLat: Number(campaignForm.centerLat),
        centerLng: Number(campaignForm.centerLng),
        radiusKm: Number(campaignForm.radiusKm),
      },
      entityTypes: ['business'],
      categories,
      sourceIds: ['openstreetmap'],
      limits: {
        maxCells: Number(campaignForm.maxCells),
        maxSources: 2,
        maxRequests: Number(campaignForm.maxRequests),
        maxRequestsPerSource: 250,
        maxPagesPerSource: 20,
        maxPagesPerDomain: 5,
        maxEntitiesDiscovered: Number(campaignForm.maxCandidates),
        maxEntitiesEnriched: 60,
        maxEntitiesPublished: 30,
        maxRuntimeMinutes: Number(campaignForm.maxRuntimeMinutes),
        maxAiTokens: 0,
        maxAiCostAmount: 0,
        maxStorageMb: 200,
        maxRetriesPerTask: 2,
        maxTaskDepth: 2,
      },
      concurrency: {
        maxConcurrentCells: Number(campaignForm.maxConcurrentCells),
        maxConcurrentSources: 1,
        maxConcurrentTasks: Number(campaignForm.maxConcurrentTasks),
      },
      reviewPolicy: { humanReviewRequired: true },
    };
  }

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const params = new URLSearchParams();
      params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const [candidatePayload, statsPayload] = await Promise.all([
        get(`/superadmin/acquisition/candidates?${params.toString()}`),
        get('/superadmin/acquisition/candidates/stats'),
      ]);
      setCandidates(candidatePayload.candidates || []);
      setStats(statsPayload.stats || null);
      setPage(1);
      setSelectedIds(new Set());
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaigns(preferredId) {
    const payload = await get('/superadmin/acquisition/campaigns');
    const nextCampaigns = payload.campaigns || [];
    setCampaigns(nextCampaigns);
    // La selection courante peut avoir disparu (suppression) : ne la garder
    // que si elle existe encore dans la liste fraiche, sinon retomber sur la
    // premiere campagne dispo (ou aucune selection si la liste est vide).
    const wanted = preferredId || selectedCampaignId;
    const stillExists = wanted && nextCampaigns.some(c => String(c.id) === String(wanted));
    const id = (stillExists ? wanted : nextCampaigns[0]?.id) || '';
    setSelectedCampaignId(id ? String(id) : '');
    if (id) {
      await loadCampaignDetails(id);
    } else {
      setSelectedCampaign(null); setCampaignMetrics(null); setCampaignTasks([]); setCampaignCells([]);
    }
  }

  async function loadCampaignDetails(id) {
    if (!id) return;
    const [campaignPayload, metricsPayload, tasksPayload, cellsPayload] = await Promise.all([
      get(`/superadmin/acquisition/campaigns/${id}`),
      get(`/superadmin/acquisition/campaigns/${id}/metrics`),
      get(`/superadmin/acquisition/campaigns/${id}/tasks`),
      get(`/superadmin/acquisition/campaigns/${id}/cells`),
    ]);
    setSelectedCampaign(campaignPayload.campaign || null);
    setCampaignMetrics(metricsPayload.metrics || null);
    setCampaignTasks(tasksPayload.tasks || []);
    setCampaignCells(cellsPayload.cells || []);
  }

  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    loadCampaigns().catch(error => setMessage(error.message));
  }, []);

  async function estimateCampaign() {
    setControlLoading(true);
    setMessage('');
    try {
      const payload = await post('/superadmin/acquisition/campaigns/estimate', buildCampaignPayload());
      setEstimate(payload.estimate || null);
      setMessage('Estimation calculee pour la zone demandee');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setControlLoading(false);
    }
  }

  async function createCampaign() {
    setControlLoading(true);
    setMessage('');
    try {
      const payload = await post('/superadmin/acquisition/campaigns', buildCampaignPayload());
      setEstimate(null);
      setMessage(`Campagne creee: ${payload.campaign?.name || campaignForm.name}`);
      setShowCreateForm(false);
      await loadCampaigns(payload.campaign?.id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setControlLoading(false);
    }
  }

  async function deleteCampaign() {
    if (!selectedCampaignId) return;
    const publishedCount = campaignCandidateCounts.published || 0;
    const ok = window.confirm(
      publishedCount > 0
        ? `Cette campagne a ${publishedCount} fiche(s) publiee(s) sur le marketplace — les fiches resteront en ligne, seul l'historique de la campagne sera supprime. Continuer ?`
        : 'Supprimer definitivement cette campagne et son historique ?'
    );
    if (!ok) return;
    setControlLoading(true);
    setMessage('');
    try {
      await del(`/superadmin/acquisition/campaigns/${selectedCampaignId}`);
      setMessage('Campagne supprimee');
      await loadCampaigns();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setControlLoading(false);
    }
  }

  async function campaignAction(action, body = {}) {
    if (!selectedCampaignId) return;
    setControlLoading(true);
    setMessage('');
    try {
      const payload = await post(`/superadmin/acquisition/campaigns/${selectedCampaignId}/${action}`, body);
      if (action === 'run') {
        setMessage(`Batch execute: ${payload.summary?.processed || 0} tache(s) traitee(s)`);
      } else if (action === 'start') {
        // "Lancer" seul ne fait qu'armer la campagne (statut -> running) sans
        // traiter aucune tache — on enchaine immediatement un premier batch
        // pour qu'un resultat soit visible tout de suite, plutot que de
        // compter sur un second clic sur "Run batch" que rien ne signale.
        const runPayload = await post(`/superadmin/acquisition/campaigns/${selectedCampaignId}/run`, { maxTasks: Number(campaignForm.maxTasksRun) });
        setMessage(`Campagne lancee — ${runPayload.summary?.processed || 0} tache(s) traitee(s)`);
      } else {
        setMessage(`Campagne ${action}: ${payload.campaign?.status || 'ok'}`);
      }
      await loadCampaigns(selectedCampaignId);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setControlLoading(false);
    }
  }

  async function approve(candidate) {
    try {
      await post(`/superadmin/acquisition/candidates/${candidate.id}/approve`, {});
      setMessage(`${candidate.raw_name} valide`);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function reject(candidate) {
    const reason = window.prompt('Motif du rejet (optionnel) :') || null;
    try {
      await post(`/superadmin/acquisition/candidates/${candidate.id}/reject`, { reason });
      setMessage(`${candidate.raw_name} rejete`);
      setSelected(null);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function publish(candidate) {
    const ok = window.confirm(`Publier "${candidate.raw_name}" comme fiche marketplace non revendiquee ?`);
    if (!ok) return;
    try {
      const payload = await post(`/superadmin/acquisition/candidates/${candidate.id}/publish`, {});
      setMessage(`Fiche publiee : ${payload.organization?.slug || payload.candidate?.published_slug || candidate.raw_name}`);
      await load();
    } catch (error) { setMessage(error.message); }
  }

  async function bulkPublish() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = window.confirm(`Publier ${ids.length} candidat(s) comme fiches marketplace non revendiquees ?`);
    if (!ok) return;
    setBulkLoading(true);
    setMessage('');
    try {
      const payload = await post('/superadmin/acquisition/candidates/bulk-publish', { ids });
      const failedCount = payload.failed?.length || 0;
      setMessage(`${payload.succeeded?.length || 0} fiche(s) publiee(s)${failedCount ? `, ${failedCount} echec(s)` : ''}`);
      setSelectedIds(new Set());
      await load();
    } catch (error) { setMessage(error.message); } finally { setBulkLoading(false); }
  }

  async function bulkReject() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const reason = window.prompt(`Motif du rejet pour ${ids.length} candidat(s) (optionnel) :`) || null;
    setBulkLoading(true);
    setMessage('');
    try {
      const payload = await post('/superadmin/acquisition/candidates/bulk-reject', { ids, reason });
      const failedCount = payload.failed?.length || 0;
      setMessage(`${payload.succeeded?.length || 0} candidat(s) rejete(s)${failedCount ? `, ${failedCount} echec(s)` : ''}`);
      setSelectedIds(new Set());
      setSelected(null);
      await load();
    } catch (error) { setMessage(error.message); } finally { setBulkLoading(false); }
  }

  const actionDisabled = controlLoading || !selectedCampaignId;
  const campaignStatus = selectedCampaign?.status;
  const startDisabled  = actionDisabled || !['ready', 'paused', 'draft', 'stopped'].includes(campaignStatus);
  const pauseDisabled  = actionDisabled || campaignStatus !== 'running';
  const resumeDisabled = actionDisabled || campaignStatus !== 'paused';
  const runDisabled    = actionDisabled || campaignStatus !== 'running';
  const stopDisabled   = actionDisabled || !['running', 'paused'].includes(campaignStatus);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-title">Knowledge Acquisition</div>
        <div className="page-subtitle">Controle des campagnes, validation humaine et publication marketplace des fiches non revendiquees.</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <Stat label="Eligibles" value={candidateCounts.eligible || 0} />
        <Stat label="Valides" value={candidateCounts.approved || 0} />
        <Stat label="Publies" value={candidateCounts.published || 0} />
        <Stat label="Fiches non revendiquees" value={stats?.unclaimedBusinesses || 0} />
      </div>

      {message && <div style={{ padding: '10px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, color: '#9A3412', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{message}</div>}

      <section style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#111827' }}>Pilotage campagne</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Zone limitee, source OpenStreetMap, enrichissement IA desactive.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {showCreateForm ? (
              <>
                <button disabled={controlLoading} onClick={estimateCampaign} style={{ minHeight: 38, border: '1px solid #D1D5DB', background: '#fff', color: '#111827', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Estimer</button>
                <button disabled={controlLoading || !campaignForm.name.trim() || campaignForm.categories.length === 0} onClick={createCampaign} style={{ minHeight: 38, border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800, opacity: (!campaignForm.name.trim() || campaignForm.categories.length === 0) ? 0.5 : 1 }}>Creer</button>
                <button onClick={() => setShowCreateForm(false)} style={{ minHeight: 38, border: '1px solid #D1D5DB', background: '#fff', color: '#6B7280', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Annuler</button>
              </>
            ) : (
              <button onClick={() => setShowCreateForm(true)} style={{ minHeight: 38, border: 'none', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>+ Nouvelle campagne</button>
            )}
          </div>
        </div>

        {showCreateForm && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Field label="Nom" value={campaignForm.name} onChange={(value) => updateCampaignForm('name', value)} />
              <Field label="Ville" value={campaignForm.city} onChange={(value) => updateCampaignForm('city', value)} />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#4B5563', marginBottom: 6 }}>
                Categories ({campaignForm.categories.length}/{MAX_CATEGORIES})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {CATEGORY_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{group.label}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {group.options.map(opt => {
                        const checked = campaignForm.categories.includes(opt.key);
                        const disabled = !checked && campaignForm.categories.length >= MAX_CATEGORIES;
                        return (
                          <label key={opt.key} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
                            border: `1.5px solid ${checked ? '#111827' : '#E5E7EB'}`,
                            background: checked ? '#111827' : '#fff',
                            color: checked ? '#fff' : disabled ? '#D1D5DB' : '#374151',
                            fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
                          }}>
                            <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleCategory(opt.key)} style={{ margin: 0 }} />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Le pilote limite les campagnes a {MAX_CATEGORIES} categories maximum.</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <AreaRadiusPicker
                lat={campaignForm.centerLat === '' ? null : Number(campaignForm.centerLat)}
                lng={campaignForm.centerLng === '' ? null : Number(campaignForm.centerLng)}
                radiusKm={Number(campaignForm.radiusKm)}
                onCenterChange={handleAreaCenterChange}
                onRadiusChange={(value) => updateCampaignForm('radiusKm', String(value))}
                minRadius={0.2}
                maxRadius={5}
              />
            </div>

            <button onClick={() => setShowAdvanced(v => !v)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#2563EB', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
              {showAdvanced ? '▾ Masquer les options avancees' : '▸ Options avancees'}
            </button>

            {showAdvanced && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 10 }}>
                <Field label="Pays" value={campaignForm.countryCode} onChange={(value) => updateCampaignForm('countryCode', value)} />
                <Field label="Region" value={campaignForm.region} onChange={(value) => updateCampaignForm('region', value)} />
                <Field label="Province" value={campaignForm.province} onChange={(value) => updateCampaignForm('province', value)} />
                <Field label="Cellules max" type="number" min="1" max="20" value={campaignForm.maxCells} onChange={(value) => updateCampaignForm('maxCells', value)} />
                <Field label="Requetes max" type="number" min="1" max="300" value={campaignForm.maxRequests} onChange={(value) => updateCampaignForm('maxRequests', value)} />
                <Field label="Candidats max" type="number" min="1" max="500" value={campaignForm.maxCandidates} onChange={(value) => updateCampaignForm('maxCandidates', value)} />
                <Field label="Runtime min" type="number" min="1" max="180" value={campaignForm.maxRuntimeMinutes} onChange={(value) => updateCampaignForm('maxRuntimeMinutes', value)} />
                <Field label="Cellules paralleles" type="number" min="1" max="2" value={campaignForm.maxConcurrentCells} onChange={(value) => updateCampaignForm('maxConcurrentCells', value)} />
                <Field label="Taches paralleles" type="number" min="1" max="3" value={campaignForm.maxConcurrentTasks} onChange={(value) => updateCampaignForm('maxConcurrentTasks', value)} />
                <Field label="Batch run" type="number" min="1" max="25" value={campaignForm.maxTasksRun} onChange={(value) => updateCampaignForm('maxTasksRun', value)} />
              </div>
            )}

            {estimate && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                <Stat label="Cellules estimees" value={estimate.cells || 0} />
                <Stat label="Requetes max" value={estimate.maxRequests || 0} />
                <Stat label="Pire cas" value={estimate.worstCaseAdaptiveRequests || 0} />
                <Stat label="Candidats max" value={estimate.maxCandidates || 0} />
              </div>
            )}
          </>
        )}

        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 14, paddingTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#4B5563', marginBottom: 8 }}>Campagnes</div>
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12, textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Nom</th>
                  <th style={{ padding: 8 }}>Ville</th>
                  <th style={{ padding: 8 }}>Statut</th>
                  <th style={{ padding: 8 }}>Creee le</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#6B7280' }}>Aucune campagne.</td></tr>
                ) : campaigns.map(campaign => (
                  <tr key={campaign.id}
                    onClick={() => { setSelectedCampaignId(String(campaign.id)); loadCampaignDetails(campaign.id).catch(error => setMessage(error.message)); }}
                    style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer', background: String(campaign.id) === selectedCampaignId ? '#FFF7ED' : '#fff' }}>
                    <td style={{ padding: 8, fontWeight: 800, color: '#111827' }}>{campaign.name}</td>
                    <td style={{ padding: 8, color: '#374151' }}>{campaign.city || '-'}</td>
                    <td style={{ padding: 8 }}><Badge value={campaign.status} /></td>
                    <td style={{ padding: 8, color: '#6B7280' }}>{campaign.created_at ? new Date(campaign.created_at).toLocaleString('fr-FR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button disabled={startDisabled} title={startDisabled && !actionDisabled ? `Non démarrable depuis le statut "${campaignStatus}"` : undefined} onClick={() => campaignAction('start')} style={{ minHeight: 36, border: 'none', background: '#16A34A', color: '#fff', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: startDisabled ? 0.5 : 1 }}>{campaignStatus === 'stopped' ? 'Relancer' : 'Lancer'}</button>
              <button disabled={pauseDisabled} title={pauseDisabled && !actionDisabled ? `Pause impossible depuis le statut "${campaignStatus}"` : undefined} onClick={() => campaignAction('pause', { reason: 'PAUSE_MANUAL' })} style={{ minHeight: 36, border: '1px solid #F59E0B', background: '#FFFBEB', color: '#92400E', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: pauseDisabled ? 0.5 : 1 }}>Pause</button>
              <button disabled={resumeDisabled} title={resumeDisabled && !actionDisabled ? `Reprise impossible depuis le statut "${campaignStatus}"` : undefined} onClick={() => campaignAction('resume')} style={{ minHeight: 36, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#166534', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: resumeDisabled ? 0.5 : 1 }}>Reprendre</button>
              <button disabled={runDisabled} title={runDisabled && !actionDisabled ? `Run batch nécessite le statut "running" (actuel: "${campaignStatus}")` : undefined} onClick={() => campaignAction('run', { maxTasks: Number(campaignForm.maxTasksRun) })} style={{ minHeight: 36, border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: runDisabled ? 0.5 : 1 }}>Run batch</button>
              <button disabled={stopDisabled} title={stopDisabled && !actionDisabled ? `Déjà à l'arrêt (statut "${campaignStatus}")` : undefined} onClick={() => campaignAction('stop', { reason: 'STOP_MANUAL' })} style={{ minHeight: 36, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: stopDisabled ? 0.5 : 1 }}>Stop</button>
              <button disabled={actionDisabled} onClick={deleteCampaign} style={{ minHeight: 36, border: '1px solid #DC2626', background: '#fff', color: '#DC2626', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', fontWeight: 800, opacity: actionDisabled ? 0.5 : 1 }}>Supprimer</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            <Stat label="Statut" value={selectedCampaign?.status ? <Badge value={selectedCampaign.status} /> : '-'} />
            <Stat label="Cellules" value={campaignCells.length} />
            <Stat label="Taches queue" value={taskCounts.queued || 0} />
            <Stat label="Taches done" value={taskCounts.completed || 0} />
            <Stat label="Candidats" value={Object.values(campaignCandidateCounts).reduce((sum, value) => sum + value, 0)} />
            <Stat label="Publies" value={campaignCandidateCounts.published || 0} />
          </div>
        </div>

        {campaignTasks.length > 0 && (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12, textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Tache</th>
                  <th style={{ padding: 8 }}>Type</th>
                  <th style={{ padding: 8 }}>Statut</th>
                  <th style={{ padding: 8 }}>Source</th>
                  <th style={{ padding: 8 }}>Stop reason</th>
                </tr>
              </thead>
              <tbody>
                {campaignTasks.slice(0, 8).map(task => (
                  <tr key={task.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: 8, fontWeight: 800 }}>{task.id}</td>
                    <td style={{ padding: 8 }}>{task.task_type}</td>
                    <td style={{ padding: 8 }}><Badge value={task.status} /></td>
                    <td style={{ padding: 8 }}>{task.source_id || '-'}</td>
                    <td style={{ padding: 8, color: '#6B7280' }}>{task.stop_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatus(tab.value)} style={{
              minHeight: 38,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1.5px solid ${status === tab.value ? '#111827' : '#E5E7EB'}`,
              background: status === tab.value ? '#111827' : '#fff',
              color: status === tab.value ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 13,
            }}>{tab.label}</button>
          ))}
          <div style={{ flex: '1 1 220px' }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') load(); }}
            placeholder="Rechercher nom, adresse, categorie"
            style={{ minHeight: 38, flex: '1 1 260px', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 14 }}
          />
          <button onClick={load} style={{ minHeight: 38, border: 'none', borderRadius: 8, background: '#EA580C', color: '#fff', padding: '8px 14px', fontWeight: 800, cursor: 'pointer' }}>
            Filtrer
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, .8fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 800, color: '#111827' }}>
              Candidats {loading ? '- chargement' : `- ${candidates.length}`}
            </div>
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <span style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 700 }}>{selectedIds.size} selectionne(s)</span>
                <button disabled={bulkLoading} onClick={bulkPublish} style={{ minHeight: 34, border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 800, fontSize: 12.5, opacity: bulkLoading ? 0.6 : 1 }}>Publier la selection</button>
                <button disabled={bulkLoading} onClick={bulkReject} style={{ minHeight: 34, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 800, fontSize: 12.5, opacity: bulkLoading ? 0.6 : 1 }}>Rejeter / supprimer la selection</button>
              </div>
            )}
          </div>
          {candidates.length === 0 ? (
            <div style={{ padding: 28, color: '#6B7280', textAlign: 'center' }}>Aucun candidat pour ce filtre.</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', color: '#4B5563', fontSize: 12, textAlign: 'left' }}>
                      <th style={{ padding: 10, width: 34 }}>
                        <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAllOnPage} style={{ margin: 0, cursor: 'pointer' }} />
                      </th>
                      <th style={{ padding: 10 }}>Nom</th>
                      <th style={{ padding: 10 }}>Categorie</th>
                      <th style={{ padding: 10 }}>Statut</th>
                      <th style={{ padding: 10 }}>Adresse</th>
                      <th style={{ padding: 10 }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCandidates.map(candidate => (
                      <tr key={candidate.id} onClick={() => setSelected(candidate)} style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer', background: selectedCandidate?.id === candidate.id ? '#FFF7ED' : '#fff' }}>
                        <td style={{ padding: 10 }} onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(candidate.id)} onChange={() => toggleSelectOne(candidate.id)} style={{ margin: 0, cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: 10, fontWeight: 800, color: '#111827' }}>{candidate.raw_name}</td>
                        <td style={{ padding: 10, color: '#374151' }}>{candidate.normalized_category || candidate.probable_category || '-'}</td>
                        <td style={{ padding: 10 }}><Badge value={candidate.status} /></td>
                        <td style={{ padding: 10, color: '#6B7280', maxWidth: 260 }}>{candidate.raw_address || <span style={{ color: '#B45309' }}>Adresse absente</span>}</td>
                        <td style={{ padding: 10 }}>
                          {candidate.source_url ? <a href={candidate.source_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} style={{ color: '#EA580C', fontWeight: 700 }}>OSM</a> : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: 12, borderTop: '1px solid #F3F4F6' }}>
                  <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ minHeight: 32, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 6, padding: '5px 10px', cursor: currentPage === 1 ? 'default' : 'pointer', fontWeight: 700, fontSize: 12.5, opacity: currentPage === 1 ? 0.5 : 1 }}>Precedent</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                    <button key={pageNumber} onClick={() => setPage(pageNumber)} style={{
                      minHeight: 32, minWidth: 32, border: `1px solid ${pageNumber === currentPage ? '#111827' : '#D1D5DB'}`,
                      background: pageNumber === currentPage ? '#111827' : '#fff', color: pageNumber === currentPage ? '#fff' : '#374151',
                      borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                    }}>{pageNumber}</button>
                  ))}
                  <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ minHeight: 32, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', borderRadius: 6, padding: '5px 10px', cursor: currentPage === totalPages ? 'default' : 'pointer', fontWeight: 700, fontSize: 12.5, opacity: currentPage === totalPages ? 0.5 : 1 }}>Suivant</button>
                </div>
              )}
            </>
          )}
        </div>

        <aside style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14, position: 'sticky', top: 12 }}>
          {!selectedCandidate ? (
            <div style={{ color: '#6B7280', fontSize: 14 }}>Selectionnez un candidat pour consulter la provenance et agir.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#111827' }}>{selectedCandidate.raw_name}</div>
                  <div style={{ marginTop: 6 }}><Badge value={selectedCandidate.status} /></div>
                </div>
                {selectedCandidate.published_slug && <a href={`/r/${selectedCandidate.published_slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#EA580C', fontWeight: 800 }}>Voir</a>}
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 10px', marginTop: 16, fontSize: 13 }}>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>Categorie</dt><dd style={{ margin: 0 }}>{selectedCandidate.source_category || '-'} - {selectedCandidate.normalized_category || '-'}</dd>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>Adresse</dt><dd style={{ margin: 0 }}>{selectedCandidate.raw_address || 'Absente'}</dd>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>Telephone</dt><dd style={{ margin: 0 }}>{selectedCandidate.phone || 'Absent'}</dd>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>Coordonnees</dt><dd style={{ margin: 0 }}>{selectedCandidate.latitude}, {selectedCandidate.longitude}</dd>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>OSM</dt><dd style={{ margin: 0 }}>{selectedCandidate.osm_type}/{selectedCandidate.osm_id}</dd>
                <dt style={{ color: '#6B7280', fontWeight: 800 }}>Licence</dt><dd style={{ margin: 0 }}>OpenStreetMap contributors</dd>
              </dl>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {['eligible'].includes(selectedCandidate.status) && (
                  <button onClick={() => approve(selectedCandidate)} style={{ minHeight: 38, border: '1px solid #86EFAC', background: '#F0FDF4', color: '#166534', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Valider</button>
                )}
                {['eligible', 'approved'].includes(selectedCandidate.status) && (
                  <button onClick={() => publish(selectedCandidate)} style={{ minHeight: 38, border: 'none', background: '#2563EB', color: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Publier</button>
                )}
                {selectedCandidate.status !== 'published' && selectedCandidate.status !== 'rejected' && (
                  <button onClick={() => reject(selectedCandidate)} style={{ minHeight: 38, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Rejeter</button>
                )}
              </div>

              <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#4B5563', fontSize: 12, lineHeight: 1.5 }}>
                La publication cree une fiche informative non revendiquee, visible marketplace, sans commande, sans reservation et sans contenu IA.
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
