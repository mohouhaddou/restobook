import React, { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { EmptyState } from '../components/ui/EmptyState';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND } from '../config/branding';
import { API } from '../api';

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const CAT_COLORS = {
  'entrée': { bg: '#F0FDF4', color: '#16A34A', icon: '🥗' },
  plat:     { bg: '#FFF7ED', color: '#FF8A00', icon: '🍽️' },
  dessert:  { bg: '#FDF4FF', color: '#9333EA', icon: '🍮' },
  boisson:  { bg: '#EFF6FF', color: '#2563EB', icon: '🥤' },
};

export default function PrepPage() {
  const { get, token } = useApi();
  const [date, setDate]   = useState(today());
  const [summary, setSummary] = useState([]);
  const [list, setList]       = useState([]);
  const [view, setView]       = useState('person');
  const [status, setStatus]   = useState('confirmed');
  const [q, setQ]             = useState('');

  useEffect(() => { load(); }, [date, view, status]);

  async function load() {
    try {
      const [s, l] = await Promise.all([
        get(`/reservations/summary?date=${date}`),
        get(`/reservations/day?date=${date}&status=${status}&view=${view === 'person' ? 'matrix' : 'list'}`)
      ]);
      setSummary(s.items || []);
      setList(l.items || []);
    } catch {}
  }

  // ── Export CSV via le backend ──────────────────────────────────────────────
  async function exportCSV() {
    const url = API(`/reservations/export?date=${date}&status=${status}`);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reservations_${date}.csv`;
    a.click();
  }

  // ── Export PDF via jsPDF ───────────────────────────────────────────────────
  async function exportPDF() {
    try {
      const [sumData, matData] = await Promise.all([
        get(`/reservations/summary?date=${date}`),
        get(`/reservations/day?date=${date}&status=confirmed&view=matrix`)
      ]);

      const doc   = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      let y = 40;

      // En-tête
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor('#FF8A00');
      doc.text(BRAND.APP_NAME, 40, y);
      doc.setTextColor('#1C1917');
      doc.setFontSize(13);
      doc.text(`Préparation du ${date}`, 40, y + 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#78716C');
      doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 40, y + 36);
      y += 56;

      // Séparateur
      doc.setDrawColor('#E7E5E4');
      doc.line(40, y, pageW - 40, y);
      y += 18;

      // Récap par catégorie
      const cats = {};
      (sumData.items || []).forEach(it => {
        const c = (it.category || '').replace(/^entree$/, 'entrée');
        if (!cats[c]) cats[c] = [];
        cats[c].push({ libelle: it.libelle, count: Number(it.count) });
      });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor('#1C1917');
      doc.text('Récapitulatif par catégorie', 40, y);
      y += 8;

      for (const [cat, items] of Object.entries(cats)) {
        if (!items.length) continue;
        autoTable(doc, {
          startY: y,
          head: [[{ content: cat.toUpperCase(), colSpan: 2, styles: { fillColor: '#FFF7ED', textColor: '#FF8A00', fontStyle: 'bold' } }],
                 ['Plat', 'Quantité']],
          body: items.map(it => [it.libelle, `×${it.count}`]),
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
          headStyles: { fillColor: '#F5F5F4', textColor: '#78716C', fontSize: 8 },
          columnStyles: { 1: { halign: 'center', cellWidth: 70 } },
          margin: { left: 40, right: 40 },
          tableWidth: pageW - 80,
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      y += 10;
      doc.setDrawColor('#E7E5E4');
      doc.line(40, y, pageW - 40, y);
      y += 16;

      // Tableau par personne
      const rows = (matData.items || []).map(r => [
        r.matricule || '', r.nom || '',
        r.entree || '—', r.plat || '—', r.dessert || '—', r.boisson || '—'
      ]);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Préparation par personne', 40, y);

      autoTable(doc, {
        startY: y + 10,
        head: [['Matricule', 'Nom', '🥗 Entrée', '🍽️ Plat', '🍮 Dessert', '🥤 Boisson']],
        body: rows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: '#FF8A00', textColor: '#fff', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: '#FFF7ED' },
        margin: { left: 40, right: 40 },
        columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 110 } },
      });

      doc.save(`preparation_${date}.pdf`);
    } catch (e) {
      console.error('Export PDF:', e);
    }
  }

  // Grouper le résumé par catégorie
  const catGroups = summary.reduce((acc, r) => {
    const cat = (r.category || '').replace(/^entree$/, 'entrée');
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const totalPlats = summary.reduce((s, r) => s + Number(r.count), 0);

  const filtered = list.filter(r => {
    if (!q) return true;
    return `${r.nom || ''} ${r.matricule || ''} ${r.entree || ''} ${r.plat || ''} ${r.label || ''}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <>
      {/* Header */}
      <div className="card p-0" style={{overflow:'hidden'}}>
        <div style={{padding:'16px 20px', borderBottom:'1px solid var(--rb-border)'}}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 className="section-title mb-0">Préparation du jour</h4>
              <div style={{fontSize:13, color:'var(--rb-muted)', marginTop:2}}>
                {totalPlats} portion{totalPlats > 1 ? 's' : ''} à préparer
              </div>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <input type="date" className="form-control form-control-sm" style={{width:'auto'}}
                value={date} onChange={e => setDate(e.target.value)} />
              <button className="btn btn-outline-secondary btn-sm" onClick={exportCSV} title="Exporter en CSV">
                📊 CSV
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={exportPDF} title="Exporter en PDF">
                📄 PDF
              </button>
            </div>
          </div>
        </div>

        {/* Récap par catégorie */}
        <div style={{padding:'16px 20px'}}>
          {Object.keys(catGroups).length === 0 ? (
            <div style={{color:'var(--rb-muted)', fontSize:13}}>Aucune réservation pour ce jour.</div>
          ) : (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12}}>
              {Object.entries(catGroups).map(([cat, items]) => {
                const cfg = CAT_COLORS[cat] || { bg:'var(--rb-surface)', color:'var(--rb-muted)', icon:'🍴' };
                const total = items.reduce((s, r) => s + Number(r.count), 0);
                return (
                  <div key={cat} style={{background:cfg.bg, borderRadius:12, padding:'14px 16px', border:`1px solid ${cfg.color}30`}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                      <span style={{fontSize:20}}>{cfg.icon}</span>
                      <span style={{fontWeight:700, fontSize:14, color:cfg.color, textTransform:'capitalize'}}>{cat}</span>
                      <span style={{marginLeft:'auto', fontWeight:700, fontSize:18, color:cfg.color}}>{total}</span>
                    </div>
                    {items.map((it, i) => (
                      <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderTop:i > 0 ? `1px solid ${cfg.color}20` : 'none'}}>
                        <span style={{fontSize:12, color:'var(--rb-text)'}}>{it.libelle}</span>
                        <span style={{fontWeight:600, fontSize:13, color:cfg.color}}>×{it.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Liste détaillée */}
      <div className="card p-0" style={{overflow:'hidden'}}>
        <div style={{padding:'14px 20px', borderBottom:'1px solid var(--rb-border)'}}>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex" style={{background:'var(--rb-surface)', borderRadius:8, padding:3, gap:3}}>
              {[['person','👤 Par personne'],['item','📦 Par item']].map(([v, label]) => (
                <button key={v}
                  onClick={() => setView(v)}
                  style={{
                    border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer',
                    background: view === v ? 'var(--rb-card)' : 'transparent',
                    color: view === v ? 'var(--rb-text)' : 'var(--rb-muted)',
                    boxShadow: view === v ? 'var(--rb-shadow)' : 'none',
                  }}>{label}</button>
              ))}
            </div>
            <select className="form-select form-select-sm" style={{width:'auto'}} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="confirmed">Confirmées</option>
              <option value="picked">Retirées</option>
              <option value="all">Toutes</option>
            </select>
            <input className="form-control form-control-sm ms-auto" style={{maxWidth:200}}
              placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>

        <div style={{overflowX:'auto'}}>
          {filtered.length === 0 ? (
            <div style={{padding:24}}><EmptyState icon="📋" title="Aucune donnée" subtitle="Modifiez le filtre ou la date." /></div>
          ) : view === 'person' ? (
            <table className="rb-table">
              <thead><tr><th>Matricule</th><th>Nom</th><th>🥗 Entrée</th><th>🍽️ Plat</th><th>🍮 Dessert</th><th>🥤 Boisson</th></tr></thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    <td><code style={{fontSize:12}}>{r.matricule}</code></td>
                    <td style={{fontWeight:500}}>{r.nom || '—'}</td>
                    <td style={{fontSize:12, color: r.entree === '—' ? 'var(--rb-muted-2)' : 'var(--rb-text)'}}>{r.entree || '—'}</td>
                    <td style={{fontSize:12, color: r.plat === '—' ? 'var(--rb-muted-2)' : 'var(--rb-text)'}}>{r.plat || '—'}</td>
                    <td style={{fontSize:12, color: r.dessert === '—' ? 'var(--rb-muted-2)' : 'var(--rb-text)'}}>{r.dessert || '—'}</td>
                    <td style={{fontSize:12, color: r.boisson === '—' ? 'var(--rb-muted-2)' : 'var(--rb-text)'}}>{r.boisson || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="rb-table">
              <thead><tr><th>Matricule</th><th>Catégorie</th><th>Plat</th><th>Statut</th></tr></thead>
              <tbody>
                {filtered.map((r, i) => {
                  const cat = (r.category || '').replace(/^entree$/, 'entrée');
                  const cfg = CAT_COLORS[cat] || {};
                  const statusMap = { confirmed:'rb-badge--blue', picked:'rb-badge--green', cancelled:'rb-badge--red' };
                  return (
                    <tr key={i}>
                      <td><code style={{fontSize:12}}>{r.matricule}</code></td>
                      <td><span className={`rb-badge`} style={{background:cfg.bg, color:cfg.color}}>{cfg.icon} {cat}</span></td>
                      <td style={{fontSize:12}}>{r.label}</td>
                      <td><span className={`rb-badge ${statusMap[r.status] || 'rb-badge--gray'}`}>{r.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
