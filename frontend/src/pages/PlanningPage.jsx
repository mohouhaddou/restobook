import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';

function monday(d) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}
function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function dayLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const CAT_COLORS = { plat: '#FF8A00', entrée: '#16A34A', dessert: '#9333EA', boisson: '#2563EB' };

const SLOT_COUNT = 8; // max items per day

export default function PlanningPage() {
  const { get, post } = useApi();
  const [weekStart, setWeekStart] = useState(monday(today()));
  const [items, setItems]         = useState([]);
  const [plan, setPlan]           = useState({});   // { 'YYYY-MM-DD': [{menu_item_id, quota}, ...] }
  const [saving, setSaving]       = useState({});   // { 'YYYY-MM-DD': true/false }
  const [msg, setMsg]             = useState('');
  const [kind, setKind]           = useState('success');

  const days = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Charger catalogue
  useEffect(() => {
    get('/menu/items')
      .then(d => setItems(d.items || []))
      .catch(() => {});
  }, []);

  // Charger menus existants pour chaque jour de la semaine
  const loadWeek = useCallback(async (dayList) => {
    const newPlan = {};
    await Promise.all(dayList.map(async (day) => {
      try {
        const d = await get(`/menu/today?date=${day}`);
        // Convertir les items du menu en slots pour le formulaire
        const slots = (d.items || []).map(it => ({
          menu_item_id: String(it.id),
          quota: it.restant !== undefined && it.restant !== null ? String(it.restant) : ''
        }));
        // Compléter avec des slots vides jusqu'à SLOT_COUNT
        while (slots.length < SLOT_COUNT) slots.push({ menu_item_id: '', quota: '' });
        newPlan[day] = slots;
      } catch {
        newPlan[day] = Array(SLOT_COUNT).fill({ menu_item_id: '', quota: '' });
      }
    }));
    setPlan(prev => ({ ...prev, ...newPlan }));
  }, [get]);

  useEffect(() => { loadWeek(days); }, [weekStart]);

  function setSlot(day, idx, field, value) {
    setPlan(prev => {
      const arr = [...(prev[day] || Array(SLOT_COUNT).fill({ menu_item_id: '', quota: '' }))];
      arr[idx] = { ...(arr[idx] || {}), [field]: value };
      return { ...prev, [day]: arr };
    });
  }

  async function saveDay(day) {
    setSaving(s => ({ ...s, [day]: true }));
    const slots = (plan[day] || []).filter(s => s?.menu_item_id);
    try {
      await post('/menu/day', {
        date_jour: day,
        items: slots.map(s => ({
          menu_item_id: Number(s.menu_item_id),
          quota: s.quota !== '' && s.quota !== null && s.quota !== undefined
            ? Number(s.quota) : null
        }))
      });
      setMsg(`✅ Menu enregistré pour ${dayLabel(day)}`);
      setKind('success');
    } catch (e) {
      setMsg(e.message);
      setKind('error');
    } finally {
      setSaving(s => ({ ...s, [day]: false }));
    }
  }

  async function saveAll() {
    for (const day of days) await saveDay(day);
    setMsg('✅ Toute la semaine enregistrée');
  }

  // Grouper items par type pour la sélection
  const itemsByType = useMemo(() => {
    const g = { plat: [], entrée: [], dessert: [], boisson: [] };
    items.forEach(it => {
      const t = it.type === 'entree' ? 'entrée' : it.type;
      if (g[t]) g[t].push(it);
    });
    return g;
  }, [items]);

  const isToday = (d) => d === today();
  const isPast  = (d) => d < today();

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      {/* Header semaine */}
      <div className="card p-0" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rb-border)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h4 className="section-title mb-0">Planification hebdomadaire</h4>
              <div style={{ fontSize: 13, color: 'var(--rb-muted)', marginTop: 2 }}>
                Semaine du {dayLabel(days[0])} au {dayLabel(days[4])}
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-outline-secondary btn-sm"
                onClick={() => setWeekStart(monday(addDays(weekStart, -7)))}>
                ‹ Semaine préc.
              </button>
              <button className="btn btn-outline-secondary btn-sm"
                onClick={() => setWeekStart(monday(today()))}>
                Cette semaine
              </button>
              <button className="btn btn-outline-secondary btn-sm"
                onClick={() => setWeekStart(monday(addDays(weekStart, 7)))}>
                Semaine suiv. ›
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveAll}>
                Tout enregistrer
              </button>
            </div>
          </div>
        </div>

        {/* Grille 5 jours */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))',
            gap: 0,
            minWidth: 900,
          }}>
            {days.map(day => {
              const slots = plan[day] || Array(SLOT_COUNT).fill({ menu_item_id: '', quota: '' });
              const filledSlots = slots.filter(s => s.menu_item_id);
              const past = isPast(day);
              const todayDay = isToday(day);

              return (
                <div key={day} style={{
                  borderRight: '1px solid var(--rb-border)',
                  padding: 14,
                  background: todayDay ? 'var(--rb-orange-light)' : past ? 'var(--rb-surface)' : 'var(--rb-card)',
                  opacity: past ? 0.7 : 1,
                }}>
                  {/* En-tête jour */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 13,
                      color: todayDay ? 'var(--rb-orange)' : 'var(--rb-text)',
                    }}>
                      {dayLabel(day)}
                      {todayDay && <span className="rb-badge rb-badge--orange ms-2" style={{ fontSize: 9 }}>Aujourd'hui</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 2 }}>
                      {filledSlots.length} plat{filledSlots.length > 1 ? 's' : ''} planifié{filledSlots.length > 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Slots */}
                  <div style={{ display: 'grid', gap: 6 }}>
                    {slots.map((slot, idx) => {
                      const selectedItem = slot.menu_item_id
                        ? items.find(x => String(x.id) === String(slot.menu_item_id))
                        : null;
                      const typeColor = selectedItem ? CAT_COLORS[selectedItem.type === 'entree' ? 'entrée' : selectedItem.type] : null;

                      return (
                        <div key={idx} style={{
                          background: slot.menu_item_id ? typeColor + '12' : 'var(--rb-surface)',
                          border: `1px solid ${slot.menu_item_id ? typeColor + '40' : 'var(--rb-border)'}`,
                          borderRadius: 6, padding: '6px 8px',
                          transition: 'all .15s',
                        }}>
                          <select
                            value={slot.menu_item_id || ''}
                            onChange={e => setSlot(day, idx, 'menu_item_id', e.target.value)}
                            style={{
                              width: '100%', border: 'none', background: 'transparent',
                              fontSize: 12, fontWeight: slot.menu_item_id ? 600 : 400,
                              color: slot.menu_item_id ? typeColor : 'var(--rb-muted)',
                              cursor: 'pointer', outline: 'none', padding: 0,
                            }}
                            disabled={past}
                          >
                            <option value="">— Aucun —</option>
                            {Object.entries(itemsByType).map(([type, list]) => (
                              list.length > 0 && (
                                <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                                  {list.map(it => (
                                    <option key={it.id} value={it.id}>{it.libelle}</option>
                                  ))}
                                </optgroup>
                              )
                            ))}
                          </select>

                          {slot.menu_item_id && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 10, color: 'var(--rb-muted)' }}>Quota :</span>
                              <input
                                type="number" min="0" placeholder="∞"
                                value={slot.quota || ''}
                                onChange={e => setSlot(day, idx, 'quota', e.target.value)}
                                disabled={past}
                                style={{
                                  width: 52, border: '1px solid var(--rb-border)', borderRadius: 4,
                                  padding: '1px 6px', fontSize: 11, textAlign: 'center', background: 'var(--rb-card)',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bouton sauvegarder */}
                  {!past && (
                    <button
                      className="btn btn-primary btn-sm w-100"
                      style={{ marginTop: 10, fontSize: 11 }}
                      onClick={() => saveDay(day)}
                      disabled={saving[day]}
                    >
                      {saving[day]
                        ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }} />
                        : '💾 Enregistrer'
                      }
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Légende types */}
      <div className="card p-3">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--rb-muted)', fontWeight: 600 }}>Types :</span>
          {Object.entries(CAT_COLORS).map(([cat, color]) => (
            <span key={cat} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, color, fontWeight: 600,
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rb-muted)' }}>
            Quota vide = illimité (∞)
          </span>
        </div>
      </div>
    </>
  );
}
