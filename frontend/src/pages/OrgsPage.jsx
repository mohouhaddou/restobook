import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';

const BLANK = { slug:'', name:'', type:'canteen', plan:'trial', owner_matricule:'', owner_password:'changeme' };

export default function OrgsPage() {
  const { get, post, patch } = useApi();
  const [orgs, setOrgs]   = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm]   = useState(BLANK);
  const [msg, setMsg]     = useState('');
  const [kind, setKind]   = useState('success');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [o, s] = await Promise.all([get('/superadmin/organizations'), get('/superadmin/stats')]);
      setOrgs(o.organizations || []); setStats(s);
    } catch {}
  }

  function notify(text, k='success') { setMsg(text); setKind(k); }

  async function create(e) {
    e.preventDefault();
    try { await post('/superadmin/organizations', form); notify('Organisation créée'); setForm(BLANK); load(); }
    catch (err) { notify(err.message, 'error'); }
  }

  async function suspend(id) {
    try { await post(`/superadmin/organizations/${id}/suspend`, {}); notify('Suspendue'); load(); }
    catch (err) { notify(err.message, 'error'); }
  }
  async function restore(id) {
    try { await post(`/superadmin/organizations/${id}/restore`, {}); notify('Réactivée'); load(); }
    catch (err) { notify(err.message, 'error'); }
  }

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      {stats && (
        <div className="row g-3 mb-2">
          {[
            { label:'Organisations', value: stats.organizations?.total },
            { label:'Actives', value: stats.organizations?.active },
            { label:'Utilisateurs', value: stats.users?.total },
            { label:'Réservations', value: stats.reservations?.total },
          ].map(c => (
            <div key={c.label} className="col-6 col-md-3">
              <div className="card p-3 text-center border-0 shadow-sm">
                <div className="display-6 fw-bold text-primary">{c.value ?? '—'}</div>
                <div className="text-secondary small">{c.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-3">
        <h5 className="mb-3">Nouvelle organisation</h5>
        <form onSubmit={create} className="row g-2 align-items-end">
          <div className="col-6 col-sm-3"><label className="form-label small">Slug *</label>
            <input className="form-control form-control-sm" value={form.slug} required pattern="[a-z0-9-]+"
              onChange={e => setForm(f=>({...f,slug:e.target.value.toLowerCase()}))} placeholder="mon-org" /></div>
          <div className="col-6 col-sm-4"><label className="form-label small">Nom *</label>
            <input className="form-control form-control-sm" value={form.name} required
              onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
          <div className="col-6 col-sm-2"><label className="form-label small">Type</label>
            <select className="form-select form-select-sm" value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}>
              <option value="canteen">Cantine</option><option value="restaurant">Restaurant</option><option value="hanout">Hanout</option><option value="pharmacie">Pharmacie</option><option value="cafe">Café</option></select></div>
          <div className="col-6 col-sm-2"><label className="form-label small">Plan</label>
            <select className="form-select form-select-sm" value={form.plan} onChange={e => setForm(f=>({...f,plan:e.target.value}))}>
              {['trial','starter','pro','enterprise'].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          <div className="col-12 col-sm-3"><label className="form-label small">Owner (matricule)</label>
            <input className="form-control form-control-sm" value={form.owner_matricule}
              onChange={e => setForm(f=>({...f,owner_matricule:e.target.value}))} placeholder="owner.org" /></div>
          <div className="col-auto"><button className="btn btn-primary btn-sm">Créer</button></div>
        </form>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">Organisations ({orgs.length})</h5>
        {orgs.length === 0
          ? <EmptyState icon="🏢" title="Aucune organisation" />
          : <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead className="table-light"><tr><th>Slug</th><th>Nom</th><th>Type</th><th>Plan</th><th>Users</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {orgs.map(o => (
                    <tr key={o.id}>
                      <td><code>{o.slug}</code></td>
                      <td>{o.name}</td>
                      <td><StatusBadge status={o.type} /></td>
                      <td><span className="badge text-bg-light">{o.plan}</span></td>
                      <td>{o.user_count}</td>
                      <td>{o.active ? <StatusBadge status="active" /> : <StatusBadge status="cancelled" label="Suspendue" />}</td>
                      <td>
                        {o.active
                          ? <button className="btn btn-xs btn-outline-warning" style={{fontSize:11}} onClick={() => suspend(o.id)}>Suspendre</button>
                          : <button className="btn btn-xs btn-outline-success" style={{fontSize:11}} onClick={() => restore(o.id)}>Réactiver</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </>
  );
}
