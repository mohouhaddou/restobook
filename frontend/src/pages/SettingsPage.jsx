import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';
import { API } from '../api';

export default function SettingsPage() {
  const { get, put, token } = useApi();
  const [settings, setSettings] = useState({ cutoff_time:'', allow_cancel_until:'', hero_image_url:'', brand_name:'', brand_logo_url:'', theme_primary:'#FF8A00', theme_accent:'#FFD500' });
  const [heroFile, setHeroFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [pwdForm, setPwdForm]   = useState({ current_password:'', new_password:'', confirm_password:'' });
  const [msg, setMsg]   = useState('');
  const [kind, setKind] = useState('success');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try { const d = await get('/admin/settings'); setSettings(d.settings || {}); } catch {}
  }

  function notify(text, k='success') { setMsg(text); setKind(k); }

  async function saveSettings(e) {
    e.preventDefault();
    try {
      await put('/admin/settings', {
        cutoff_time: settings.cutoff_time,
        allow_cancel_until: settings.allow_cancel_until,
        brand_name: settings.brand_name,
        brand_logo_url: settings.brand_logo_url,
        theme_primary: settings.theme_primary,
        theme_accent: settings.theme_accent,
      });
      notify('Paramètres sauvegardés');
    } catch (err) { notify(err.message, 'error'); }
  }

  async function uploadHero(e) {
    e.preventDefault();
    if (!heroFile) return notify('Choisissez un fichier.', 'error');
    const fd = new FormData();
    fd.append('image', heroFile);
    try {
      const r = await fetch(API('/admin/branding/hero'), { method:'POST', headers:{Authorization:`Bearer ${token}`}, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify('Image héro mise à jour'); setHeroFile(null); loadSettings();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function uploadLogo(e) {
    e.preventDefault();
    if (!logoFile) return notify('Choisissez un logo.', 'error');
    const fd = new FormData();
    fd.append('image', logoFile);
    try {
      const r = await fetch(API('/admin/branding/logo'), { method:'POST', headers:{Authorization:`Bearer ${token}`}, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify('Logo mis à jour'); setLogoFile(null); loadSettings();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) return notify('Les mots de passe ne correspondent pas.', 'error');
    try {
      const r = await fetch(API('/auth/change-password'), { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body: JSON.stringify(pwdForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify('Mot de passe mis à jour'); setPwdForm({ current_password:'', new_password:'', confirm_password:'' });
    } catch (err) { notify(err.message, 'error'); }
  }

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="card p-3">
        <h5 className="mb-3">Paramètres de la cantine</h5>
        <form onSubmit={saveSettings} className="row g-3">
          <div className="col-12 col-sm-6">
            <label className="form-label">Heure limite de réservation (HH:MM)</label>
            <input className="form-control" value={settings.cutoff_time || ''}
              onChange={e => setSettings(s => ({...s, cutoff_time: e.target.value}))} pattern="\d{2}:\d{2}" />
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label">Heure limite d'annulation (HH:MM)</label>
            <input className="form-control" value={settings.allow_cancel_until || ''}
              onChange={e => setSettings(s => ({...s, allow_cancel_until: e.target.value}))} pattern="\d{2}:\d{2}" />
          </div>
          <div className="col-auto">
            <button className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">Identité visuelle</h5>
        <form onSubmit={saveSettings} className="row g-3 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label">Nom affiché</label>
            <input className="form-control" value={settings.brand_name || ''}
              onChange={e => setSettings(s => ({...s, brand_name: e.target.value}))} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Couleur principale</label>
            <input type="color" className="form-control form-control-color" value={settings.theme_primary || '#FF8A00'}
              onChange={e => setSettings(s => ({...s, theme_primary: e.target.value}))} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Couleur accent</label>
            <input type="color" className="form-control form-control-color" value={settings.theme_accent || '#FFD500'}
              onChange={e => setSettings(s => ({...s, theme_accent: e.target.value}))} />
          </div>
          <div className="col-12 col-md-auto">
            <button className="btn btn-primary">Appliquer le thème</button>
          </div>
        </form>
        <div className="mt-3 d-flex align-items-center gap-3 flex-wrap">
          {settings.brand_logo_url && <img src={settings.brand_logo_url} alt="Logo" style={{height:48, maxWidth:180, objectFit:'contain', border:'1px solid var(--rb-border)', borderRadius:8, padding:6}} />}
          <form onSubmit={uploadLogo} className="d-flex gap-2 flex-wrap">
            <input type="file" accept="image/*" className="form-control" style={{maxWidth:300}}
              onChange={e => setLogoFile(e.target.files?.[0] || null)} />
            <button className="btn btn-outline-primary">Uploader le logo</button>
          </form>
        </div>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">Image héro</h5>
        {settings.hero_image_url && (
          <div className="mb-2" style={{height:100, background:`url('${settings.hero_image_url}') center/cover`, borderRadius:8}} />
        )}
        <form onSubmit={uploadHero} className="d-flex gap-2 flex-wrap">
          <input type="file" accept="image/*" className="form-control" style={{maxWidth:300}}
            onChange={e => setHeroFile(e.target.files?.[0] || null)} />
          <button className="btn btn-outline-primary">Upload</button>
        </form>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">Changer mon mot de passe</h5>
        <form onSubmit={changePassword} className="row g-3" style={{maxWidth:400}}>
          {['current_password','new_password','confirm_password'].map(field => (
            <div key={field} className="col-12">
              <label className="form-label small">{field.replace(/_/g,' ')}</label>
              <input type="password" className="form-control" value={pwdForm[field]}
                onChange={e => setPwdForm(f => ({...f, [field]: e.target.value}))} />
            </div>
          ))}
          <div className="col-auto"><button className="btn btn-primary">Mettre à jour</button></div>
        </form>
      </div>
    </>
  );
}
