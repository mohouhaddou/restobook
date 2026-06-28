import React, { useEffect, useState } from 'react';

const COLORS = { success: '#16a34a', error: '#dc2626', info: '#2563eb', warning: '#d97706' };

export function Toast({ msg, kind = 'info', onClose, autoHideMs = 6000 }) {
  const [visible, setVisible] = useState(!!msg);

  useEffect(() => {
    setVisible(!!msg);
    if (!msg || !autoHideMs) return;
    const t = setTimeout(() => { setVisible(false); onClose?.(); }, autoHideMs);
    return () => clearTimeout(t);
  }, [msg, autoHideMs, onClose]);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') { setVisible(false); onClose?.(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!visible || !msg) return null;

  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', right: 16, bottom: 16, maxWidth: 420, zIndex: 9999,
      background: '#fff', border: `1px solid ${COLORS[kind] || COLORS.info}`,
      borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.15)',
      padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
      animation: 'fadeInUp .18s ease-out'
    }}>
      <div style={{ flex: 1, color: '#111', fontSize: 14 }}>{msg}</div>
      <button className="btn btn-sm btn-outline-secondary" onClick={() => { setVisible(false); onClose?.(); }}>✕</button>
      <style>{`@keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
