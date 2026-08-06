import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RoleBadge } from '../components/ui/Badge';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';
import { API } from '../api';

export default function ProfilePage() {
  const { user } = useAuth();
  const { token } = useApi();
  const [pwdForm, setPwdForm] = useState({ current_password:'', new_password:'', confirm_password:'' });
  const [msg, setMsg]   = useState('');
  const [kind, setKind] = useState('success');

  async function changePassword(e) {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password)
      return (setMsg('Les mots de passe ne correspondent pas.'), setKind('error'));
    try {
      const r = await fetch(API('/auth/change-password'), {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body: JSON.stringify({ current_password: pwdForm.current_password, new_password: pwdForm.new_password })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg('Mot de passe mis à jour'); setKind('success');
      setPwdForm({ current_password:'', new_password:'', confirm_password:'' });
    } catch (err) { setMsg(err.message); setKind('error'); }
  }

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
      <div className="card p-4" style={{maxWidth:480}}>
        <h5 className="mb-3">Mon profil</h5>
        <div className="d-flex align-items-center gap-3 mb-4">
          <div className="d-flex align-items-center justify-content-center rounded-circle bg-primary text-white fw-bold"
            style={{width:56,height:56,fontSize:22}}>
            {(user?.nom||user?.matricule||'U').trim()[0].toUpperCase()}
          </div>
          <div>
            <div className="fw-semibold">{user?.nom || user?.matricule}</div>
            <code className="small text-secondary">{user?.matricule}</code>
            <div className="mt-1"><RoleBadge role={user?.role} /></div>
          </div>
        </div>
        <table className="table table-sm mb-4">
          <tbody>
            <tr><td className="text-secondary small">Email</td><td>{user?.email || '—'}</td></tr>
            <tr><td className="text-secondary small">Organisation</td><td>{user?.organization_id ?? 'Global'}</td></tr>
          </tbody>
        </table>

        <h6>Changer le mot de passe</h6>
        <form onSubmit={changePassword} className="row g-3">
          {[
            ['current_password','Mot de passe actuel'],
            ['new_password','Nouveau mot de passe'],
            ['confirm_password','Confirmer'],
          ].map(([field, label]) => (
            <div key={field} className="col-12">
              <label className="form-label small">{label}</label>
              <input type="password" autoComplete={field === 'current_password' ? 'current-password' : 'new-password'} className="form-control" value={pwdForm[field]}
                onChange={e => setPwdForm(f => ({...f, [field]: e.target.value}))} required />
            </div>
          ))}
          <div className="col-auto"><button className="btn btn-primary btn-sm">Mettre à jour</button></div>
        </form>
      </div>
    </>
  );
}
