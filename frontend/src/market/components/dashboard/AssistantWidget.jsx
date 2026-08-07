import React, { useState } from 'react';
import { API } from '../../../api';
import { PremiumIconBadge } from '../../../shared/components/ui/PremiumIcon';

// Widget Assistant IA — stub Phase 2 côté logique (réponse en dur servie par
// POST /api/dashboard/assistant/ask) mais UI complète et interactive dès v1,
// pour une architecture facilement extensible vers un vrai appel LLM.
const SUGGESTIONS = [
  'Faire ma liste de courses pour un couscous',
  'Trouver la pharmacie de garde',
  'Comparer les prix des restaurants proches',
];

export function AssistantWidget({ authHeader }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(message) {
    if (!message.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(API('/dashboard/assistant/ask'), {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Erreur' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Une erreur est survenue.' }]);
    }
    setLoading(false);
  }

  return (
    <div className="mk-card" style={{ padding: 18, background: 'linear-gradient(135deg, var(--mk-card), var(--mk-orange-light))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <PremiumIconBadge name="sparkles" size={22} style={{ color: 'var(--mk-orange)' }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--mk-text)' }}>Assistant iFilino</div>
          <div style={{ fontSize: 11, color: 'var(--mk-muted)' }}>Bientôt : listes, comparaisons, recommandations</div>
        </div>
      </div>

      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'var(--mk-orange)' : 'var(--mk-surface)',
              color: m.role === 'user' ? '#fff' : 'var(--mk-text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--mk-border)',
              borderRadius: 12, padding: '8px 12px', fontSize: 12.5, maxWidth: '85%',
            }}>
              {m.text}
            </div>
          ))}
          {loading && <div style={{ fontSize: 12, color: 'var(--mk-muted)' }}>Réflexion…</div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => ask(s)} className="mk-pill" style={{ fontSize: 11 }}>{s}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(input); }}
          placeholder="Demandez quelque chose…"
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--mk-border)',
            background: 'var(--mk-input-bg)', color: 'var(--mk-text)', fontSize: 13, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', background: 'var(--mk-orange)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: loading ? .6 : 1,
          }}
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
