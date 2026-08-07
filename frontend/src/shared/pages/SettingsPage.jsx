import React, { useEffect, useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Toast } from '../../components/ui/Toast';
import { API } from '../../api';
import { useI18n } from '../../i18n/config';
import { LanguageSelect } from '../components/i18n/LanguageSelect';

export default function SettingsPage() {
  const { get, put, token } = useApi();
  const { t } = useI18n();
  const [settings, setSettings] = useState({ cutoff_time:'', allow_cancel_until:'', hero_image_url:'', brand_name:'', brand_logo_url:'' });
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
      });
      notify(t('common.saved'));
    } catch (err) { notify(err.message, 'error'); }
  }

  async function uploadHero(e) {
    e.preventDefault();
    if (!heroFile) return notify(t('common.choose_file'), 'error');
    const fd = new FormData();
    fd.append('image', heroFile);
    try {
      const r = await fetch(API('/admin/branding/hero'), { method:'POST', headers:{Authorization:`Bearer ${token}`}, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify(t('settings.hero_updated')); setHeroFile(null); loadSettings();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function uploadLogo(e) {
    e.preventDefault();
    if (!logoFile) return notify(t('common.choose_file'), 'error');
    const fd = new FormData();
    fd.append('image', logoFile);
    try {
      const r = await fetch(API('/admin/branding/logo'), { method:'POST', headers:{Authorization:`Bearer ${token}`}, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify(t('settings.logo_updated')); setLogoFile(null); loadSettings();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) return notify(t('auth.password_mismatch'), 'error');
    try {
      const r = await fetch(API('/auth/change-password'), { method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}, body: JSON.stringify(pwdForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify(t('auth.password_updated')); setPwdForm({ current_password:'', new_password:'', confirm_password:'' });
    } catch (err) { notify(err.message, 'error'); }
  }

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="card p-3">
        <h5 className="mb-3">{t('common.language_region')}</h5>
        <div className="d-flex align-items-center gap-3 flex-wrap">
          <LanguageSelect />
          <p className="m-0 small" style={{ color: 'var(--rb-muted)', maxWidth: 620 }}>{t('settings.language_help')}</p>
        </div>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">{t('settings.canteen_title')}</h5>
        <form onSubmit={saveSettings} className="row g-3">
          <div className="col-12 col-sm-6">
            <label className="form-label">{t('settings.reservation_cutoff')}</label>
            <input className="form-control" value={settings.cutoff_time || ''}
              onChange={e => setSettings(s => ({...s, cutoff_time: e.target.value}))} pattern="\d{2}:\d{2}" />
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label">{t('settings.cancel_cutoff')}</label>
            <input className="form-control" value={settings.allow_cancel_until || ''}
              onChange={e => setSettings(s => ({...s, allow_cancel_until: e.target.value}))} pattern="\d{2}:\d{2}" />
          </div>
          <div className="col-auto">
            <button className="btn btn-primary">{t('common.save')}</button>
          </div>
        </form>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">{t('settings.visual_identity')}</h5>
        <form onSubmit={saveSettings} className="row g-3 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label">{t('settings.display_name')}</label>
            <input className="form-control" value={settings.brand_name || ''}
              onChange={e => setSettings(s => ({...s, brand_name: e.target.value}))} />
          </div>
          <div className="col-12 col-md-auto">
            <button className="btn btn-primary">{t('settings.save_visual')}</button>
          </div>
        </form>
        <div className="mt-3 d-flex align-items-center gap-3 flex-wrap">
          {settings.brand_logo_url && <img src={settings.brand_logo_url} alt="Logo" style={{height:48, maxWidth:180, objectFit:'contain', border:'1px solid var(--rb-border)', borderRadius:8, padding:6}} />}
          <form onSubmit={uploadLogo} className="d-flex gap-2 flex-wrap">
            <input type="file" accept="image/*" className="form-control" style={{maxWidth:300}}
              onChange={e => setLogoFile(e.target.files?.[0] || null)} />
            <button className="btn btn-outline-primary">{t('settings.upload_logo')}</button>
          </form>
        </div>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">{t('settings.hero_image')}</h5>
        {settings.hero_image_url && (
          <div className="mb-2" style={{height:100, background:`url('${settings.hero_image_url}') center/cover`, borderRadius:8}} />
        )}
        <form onSubmit={uploadHero} className="d-flex gap-2 flex-wrap">
          <input type="file" accept="image/*" className="form-control" style={{maxWidth:300}}
            onChange={e => setHeroFile(e.target.files?.[0] || null)} />
          <button className="btn btn-outline-primary">{t('common.upload')}</button>
        </form>
      </div>

      <div className="card p-3">
        <h5 className="mb-3">{t('auth.change_password')}</h5>
        <form onSubmit={changePassword} className="row g-3" style={{maxWidth:400}}>
          {['current_password','new_password','confirm_password'].map(field => (
            <div key={field} className="col-12">
              <label className="form-label small">{t('auth.' + field)}</label>
              <input type="password" autoComplete={field === 'current_password' ? 'current-password' : 'new-password'} className="form-control" value={pwdForm[field]}
                onChange={e => setPwdForm(f => ({...f, [field]: e.target.value}))} />
            </div>
          ))}
          <div className="col-auto"><button className="btn btn-primary">{t('auth.update_password')}</button></div>
        </form>
      </div>
    </>
  );
}
