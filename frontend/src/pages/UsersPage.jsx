import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { RoleBadge, StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Toast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from '../auth/permissions';

const ROLES = ASSIGNABLE_ROLES;

export default function UsersPage() {
  const { get, post, patch, del } = useApi();
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [msg, setMsg]     = useState('');
  const [msgKind, setMsgKind] = useState('info');
  const [q, setQ]         = useState('');
  const [form, setForm]   = useState({ matricule:'', nom:'', email:'', role:'user', password:'changeme' });
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try { const d = await get('/admin/users'); setUsers(d.users || []); } catch {}
  }

  function notify(text, kind = 'success') { setMsg(text); setMsgKind(kind); }

  async function create(e) {
    e.preventDefault();
    try {
      await post('/admin/users', form);
      notify('Utilisateur créé');
      setForm({ matricule:'', nom:'', email:'', role:'user', password:'changeme' });
      load();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function activate(id) {
    try { await post(`/admin/users/${id}/activate`, {}); notify('Compte activé'); load(); }
    catch (err) { notify(err.message, 'error'); }
  }

  async function remove(u) {
    try {
      await del(`/admin/users/${u.id}`);
      setPendingDelete(null);
      notify('Supprimé');
      load();
    }
    catch (err) { notify(err.message, 'error'); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await patch(`/admin/users/${editing.id}`, editing);
      notify('Mis à jour'); setEditing(null); load();
    } catch (err) { notify(err.message, 'error'); }
  }

  const filtered = users.filter(u => {
    const n = q.toLowerCase();
    return !n || `${u.matricule} ${u.nom} ${u.email} ${u.role}`.toLowerCase().includes(n);
  });

  return (
    <>
      <Toast msg={msg} kind={msgKind} onClose={() => setMsg('')} />

      {/* Formulaire de création */}
      <div className="card p-3">
        <h5 className="mb-3">Créer un utilisateur</h5>
        <form onSubmit={create} className="row g-2 align-items-end">
          <div className="col-12 col-sm-4">
            <label className="form-label small">Matricule *</label>
            <input className="form-control form-control-sm" value={form.matricule} required
              onChange={e => setForm(f => ({...f, matricule: e.target.value}))} />
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label small">Nom</label>
            <input className="form-control form-control-sm" value={form.nom}
              onChange={e => setForm(f => ({...f, nom: e.target.value}))} />
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label small">Email</label>
            <input type="email" className="form-control form-control-sm" value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          </div>
          <div className="col-6 col-sm-3">
            <label className="form-label small">Rôle</label>
            <select className="form-select form-select-sm" value={form.role}
              onChange={e => setForm(f => ({...f, role: e.target.value}))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
            </select>
          </div>
          <div className="col-6 col-sm-4">
            <label className="form-label small">Mot de passe initial</label>
            <input className="form-control form-control-sm" value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))} />
          </div>
          <div className="col-12 col-sm-auto">
            <button className="btn btn-primary btn-sm">Créer</button>
          </div>
        </form>
      </div>

      {/* Liste des utilisateurs */}
      <div className="card p-3">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 className="m-0">{users.length} utilisateur{users.length > 1 ? 's' : ''}</h5>
          <input className="form-control form-control-sm" style={{maxWidth:220}} placeholder="Rechercher…"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {filtered.length === 0
          ? <EmptyState icon="👤" title="Aucun utilisateur" />
          : <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead className="table-light">
                  <tr><th>Matricule</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td><code>{u.matricule}</code></td>
                      <td>{u.nom || '—'}</td>
                      <td className="text-secondary small">{u.email || '—'}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        {u.actif
                          ? <StatusBadge status="active" />
                          : <button className="btn btn-xs btn-outline-success" style={{fontSize:11}} onClick={() => activate(u.id)}>Activer</button>
                        }
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button className="btn btn-xs btn-outline-secondary" style={{fontSize:11}} onClick={() => setEditing({...u, password:''})}>Éditer</button>
                          {u.id !== me?.id && <button className="btn btn-xs btn-outline-danger" style={{fontSize:11}} onClick={() => setPendingDelete(u)}>✕</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer cet utilisateur"
        message={pendingDelete ? `${pendingDelete.nom || pendingDelete.matricule} sera supprimé définitivement.` : ''}
        confirmLabel="Supprimer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove(pendingDelete)}
      />

      {/* Modal édition */}
      {editing && (
        <div className="modal fade show" style={{display:'block'}} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-0">
                <h5 className="modal-title">Modifier — {editing.matricule}</h5>
                <button className="btn-close" onClick={() => setEditing(null)} />
              </div>
              <form onSubmit={saveEdit}>
                <div className="modal-body row g-3">
                  <div className="col-12"><label className="form-label small">Nom</label>
                    <input className="form-control" value={editing.nom || ''} onChange={e => setEditing(v => ({...v, nom: e.target.value}))} /></div>
                  <div className="col-12"><label className="form-label small">Email</label>
                    <input type="email" className="form-control" value={editing.email || ''} onChange={e => setEditing(v => ({...v, email: e.target.value}))} /></div>
                  <div className="col-6"><label className="form-label small">Rôle</label>
                    <select className="form-select" value={editing.role} onChange={e => setEditing(v => ({...v, role: e.target.value}))}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                    </select></div>
                  <div className="col-6"><label className="form-label small">Actif</label>
                    <select className="form-select" value={editing.actif ? 'true' : 'false'} onChange={e => setEditing(v => ({...v, actif: e.target.value === 'true'}))}>
                      <option value="true">Oui</option><option value="false">Non</option>
                    </select></div>
                  <div className="col-12"><label className="form-label small">Nouveau mot de passe (laisser vide = inchangé)</label>
                    <input type="password" className="form-control" value={editing.password || ''} onChange={e => setEditing(v => ({...v, password: e.target.value}))} /></div>
                </div>
                <div className="modal-footer border-0 gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Annuler</button>
                  <button type="submit" className="btn btn-primary">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
