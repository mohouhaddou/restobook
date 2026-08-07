import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API } from '../../api';
import { useApi } from '../../hooks/useApi';
import { BRAND } from '../../config/branding';
import { Toast } from '../../components/ui/Toast';
import { RestaurantKpiCard } from '../modules/resto/components/RestaurantKpiCard';
import { RestaurantItemStatsTable } from '../modules/resto/components/RestaurantItemStatsTable';
import { CustomerHistoryTable } from '../modules/resto/components/CustomerHistoryTable';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} MAD`;
}

export default function RestaurantSaasPage() {
  const { get, post, patch, token } = useApi();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [dashboard, setDashboard] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [itemStats, setItemStats] = useState([]);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [profile, setProfile] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [from, to]);

  async function load() {
    setLoading(true);
    try {
      const qs = `from=${from}&to=${to}`;
      const [dash, clients, stats, menuData, profileData] = await Promise.all([
        get(`/restaurant-saas/dashboard?${qs}`),
        get(`/restaurant-saas/customers?${qs}`),
        get(`/restaurant-saas/items/stats?${qs}`),
        get('/restaurant-saas/menu'),
        get('/restaurant-saas/profile'),
      ]);
      setDashboard(dash);
      setCustomers(clients.customers || []);
      setItemStats(stats.items || []);
      setMenu({ categories: menuData.categories || [], items: menuData.items || [] });
      setProfile(profileData.restaurant || null);
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const d = await patch('/restaurant-saas/profile', {
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        city: profile.city,
        zone: profile.zone,
        cuisine_type: profile.cuisine_type,
        avg_prep_time: profile.avg_prep_time,
        accepts_takeaway: !!profile.accepts_takeaway,
        accepts_dine_in: !!profile.accepts_dine_in,
      });
      setProfile(d.restaurant);
      setMsg('Profil restaurant enregistré');
      setKind('success');
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    }
  }

  async function createCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await post('/restaurant-saas/categories', { name: newCategory.trim() });
      setNewCategory('');
      setMsg('Catégorie créée');
      setKind('success');
      load();
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    }
  }

  async function downloadCsv(kind) {
    const resp = await fetch(API(`/restaurant-saas/export/${kind}.csv?from=${from}&to=${to}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      setMsg('Export CSV impossible');
      setKind('error');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restobook_${kind}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${BRAND.APP_NAME} Restaurant - Rapport`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Période: ${from} - ${to}`, 14, 24);
    doc.text(`CA: ${money(dashboard?.sales?.revenue)} | Commandes: ${dashboard?.sales?.orders || 0}`, 14, 31);
    autoTable(doc, {
      startY: 40,
      head: [['Plat', 'Type', 'Quantité', 'CA']],
      body: itemStats.map(i => [i.libelle, i.type, i.quantity, money(i.revenue)]),
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Client', 'Téléphone', 'Commandes', 'Total']],
      body: customers.slice(0, 25).map(c => [c.name, c.phone || '-', c.orders_count, money(c.total_spent)]),
    });
    doc.save(`restobook_restaurant_${from}_${to}.pdf`);
  }

  const sales = dashboard?.sales || {};
  const orderModes = useMemo(() => Object.entries(sales.by_type || {}), [sales.by_type]);

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Restaurant SaaS</h1>
          <div style={{ color: 'var(--rb-muted)', fontSize: 13 }}>
            Gestion intelligente du restaurant: ventes, menu, clients et rentabilité.
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <input type="date" className="form-control form-control-sm" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="form-control form-control-sm" value={to} onChange={e => setTo(e.target.value)} />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadCsv('sales')}>CSV ventes</button>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => downloadCsv('items')}>CSV plats</button>
          <button className="btn btn-primary btn-sm" onClick={exportPdf}>PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="card p-4 text-center text-muted">Chargement du cockpit restaurant…</div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-6 col-lg-3"><RestaurantKpiCard label="Chiffre d'affaires" value={money(sales.revenue)} hint="hors commandes annulées" /></div>
            <div className="col-6 col-lg-3"><RestaurantKpiCard label="Commandes" value={sales.orders || 0} hint="sur la période" /></div>
            <div className="col-6 col-lg-3"><RestaurantKpiCard label="Ticket moyen" value={money(sales.avg_ticket)} hint="commandes validées" /></div>
            <div className="col-6 col-lg-3"><RestaurantKpiCard label="Clients" value={sales.customers || 0} hint="clients identifiés" /></div>
            <div className="col-6 col-lg-3"><RestaurantKpiCard label="Réservations" value={sales.reservations || 0} hint="tables sur la période" /></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-5">
              <div className="card p-3 h-100">
                <h2 style={{ fontSize: 16 }}>Restaurant</h2>
                {profile && (
                  <form onSubmit={saveProfile} className="row g-2">
                    <div className="col-12"><input className="form-control form-control-sm" value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Nom" /></div>
                    <div className="col-6"><input className="form-control form-control-sm" value={profile.phone || ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="Téléphone" /></div>
                    <div className="col-6"><input className="form-control form-control-sm" value={profile.email || ''} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="Email" /></div>
                    <div className="col-12"><input className="form-control form-control-sm" value={profile.address || ''} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))} placeholder="Adresse" /></div>
                    <div className="col-6"><input className="form-control form-control-sm" value={profile.city || ''} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} placeholder="Ville" /></div>
                    <div className="col-6"><input className="form-control form-control-sm" value={profile.zone || ''} onChange={e => setProfile(p => ({ ...p, zone: e.target.value }))} placeholder="Zone" /></div>
                    <div className="col-6"><input className="form-control form-control-sm" value={profile.cuisine_type || ''} onChange={e => setProfile(p => ({ ...p, cuisine_type: e.target.value }))} placeholder="Cuisine" /></div>
                    <div className="col-6"><input type="number" min="1" className="form-control form-control-sm" value={profile.avg_prep_time || ''} onChange={e => setProfile(p => ({ ...p, avg_prep_time: e.target.value }))} placeholder="Préparation min" /></div>
                    <div className="col-6">
                      <label className="form-check small"><input className="form-check-input me-2" type="checkbox" checked={!!profile.accepts_dine_in} onChange={e => setProfile(p => ({ ...p, accepts_dine_in: e.target.checked }))} />Sur place</label>
                    </div>
                    <div className="col-6">
                      <label className="form-check small"><input className="form-check-input me-2" type="checkbox" checked={!!profile.accepts_takeaway} onChange={e => setProfile(p => ({ ...p, accepts_takeaway: e.target.checked }))} />À emporter</label>
                    </div>
                    <div className="col-12"><button className="btn btn-primary btn-sm" type="submit">Enregistrer</button></div>
                  </form>
                )}
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card p-3 h-100">
                <h2 style={{ fontSize: 16 }}>Menus et catégories</h2>
                <form onSubmit={createCategory} className="d-flex gap-2 mb-3">
                  <input className="form-control form-control-sm" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Nouvelle catégorie" />
                  <button className="btn btn-outline-primary btn-sm">Ajouter</button>
                </form>
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {menu.categories.map(c => <span key={c.id} className="badge text-bg-light border">{c.name}</span>)}
                  {menu.categories.length === 0 && <span className="text-muted small">Aucune catégorie configurée.</span>}
                </div>
                <div className="row g-2">
                  <div className="col-4"><RestaurantKpiCard label="Plats" value={menu.items.length} /></div>
                  <div className="col-4"><RestaurantKpiCard label="Disponibles" value={menu.items.filter(i => i.is_available !== false).length} /></div>
                  <div className="col-4"><RestaurantKpiCard label="Catégories" value={menu.categories.length} /></div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card p-3 h-100">
                <h2 style={{ fontSize: 16 }}>Modes de commande</h2>
                {orderModes.length === 0 ? <div className="text-muted small">Aucune commande.</div> : orderModes.map(([type, count]) => (
                  <div key={type} className="d-flex justify-content-between py-2 border-bottom">
                    <span>{type}</span><strong>{count}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-8">
              <div className="card p-3 h-100">
                <h2 style={{ fontSize: 16 }}>Statistiques par plat</h2>
                <RestaurantItemStatsTable items={itemStats} />
              </div>
            </div>
            <div className="col-12">
              <div className="card p-3">
                <h2 style={{ fontSize: 16 }}>Historique clients</h2>
                <CustomerHistoryTable customers={customers} />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
