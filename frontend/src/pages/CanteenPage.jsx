import React, { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Toast } from '../components/ui/Toast';
import { CanteenKpiCard } from '../components/canteen/CanteenKpiCard';
import { WeeklyMenuSummary } from '../components/canteen/WeeklyMenuSummary';
import { MealHistoryTable } from '../components/canteen/MealHistoryTable';

function today() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monday(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const emptyEmployee = { matricule: '', nom: '', email: '', role: 'employee', password: 'changeme' };

export default function CanteenPage() {
  const { get, post } = useApi();
  const [weekStart, setWeekStart] = useState(monday(today()));
  const [employees, setEmployees] = useState([]);
  const [week, setWeek] = useState({ menus: [] });
  const [attendance, setAttendance] = useState({ totals: {} });
  const [waste, setWaste] = useState({ totals: {}, items: [] });
  const [history, setHistory] = useState([]);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployee);
  const [msg, setMsg] = useState('');
  const [kind, setKind] = useState('success');

  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]);

  useEffect(() => { loadAll(); }, [weekStart]);

  async function loadAll() {
    try {
      const [emp, wk, att, wa, hist] = await Promise.all([
        get('/canteen/employees?status=all'),
        get(`/canteen/week?from=${weekStart}`),
        get(`/canteen/attendance?from=${weekStart}&to=${weekEnd}`),
        get(`/canteen/waste?from=${weekStart}&to=${weekEnd}`),
        get(`/canteen/history?from=${weekStart}&to=${weekEnd}&status=all`),
      ]);
      setEmployees(emp.employees || []);
      setWeek(wk || { menus: [] });
      setAttendance(att || { totals: {} });
      setWaste(wa || { totals: {}, items: [] });
      setHistory(hist.meals || []);
    } catch (e) {
      setMsg(e.message);
      setKind('error');
    }
  }

  async function createEmployee(e) {
    e.preventDefault();
    try {
      await post('/canteen/employees', employeeForm);
      setEmployeeForm(emptyEmployee);
      setMsg('Utilisateur associé à la cantine');
      setKind('success');
      loadAll();
    } catch (err) {
      setMsg(err.message);
      setKind('error');
    }
  }

  const activeEmployees = employees.filter(user => user.actif).length;
  const totals = attendance.totals || {};
  const wasteTotals = waste.totals || {};

  return (
    <>
      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />

      <div className="card p-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h4 className="section-title mb-0">Restobook Canteen</h4>
            <div style={{ fontSize: 13, color: 'var(--rb-muted)', marginTop: 2 }}>
              Entreprises, écoles et administrations · semaine {weekStart} → {weekEnd}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Semaine préc.
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setWeekStart(monday(today()))}>
              Cette semaine
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Semaine suiv.
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-6 col-lg-3">
          <CanteenKpiCard label="Utilisateurs actifs" value={activeEmployees} hint={`${employees.length} associés`} tone="blue" />
        </div>
        <div className="col-6 col-lg-3">
          <CanteenKpiCard label="Réservations" value={totals.total || 0} hint={`${totals.confirmed || 0} à servir`} tone="orange" />
        </div>
        <div className="col-6 col-lg-3">
          <CanteenKpiCard label="Repas consommés" value={totals.consumed || 0} hint="Validés par QR" tone="green" />
        </div>
        <div className="col-6 col-lg-3">
          <CanteenKpiCard label="Gaspillage estimé" value={wasteTotals.estimated_waste || 0} hint="Réservés non retirés" tone="red" />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <WeeklyMenuSummary menus={week.menus || []} />
        </div>
        <div className="col-12 col-xl-4">
          <div className="card p-3">
            <h5 style={{ fontSize: 15 }}>Ajouter employé / élève</h5>
            <form onSubmit={createEmployee} className="row g-2">
              <div className="col-12">
                <label className="form-label small">Matricule *</label>
                <input className="form-control form-control-sm" required value={employeeForm.matricule}
                  onChange={e => setEmployeeForm(v => ({ ...v, matricule: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label small">Nom</label>
                <input className="form-control form-control-sm" value={employeeForm.nom}
                  onChange={e => setEmployeeForm(v => ({ ...v, nom: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label small">Email</label>
                <input type="email" className="form-control form-control-sm" value={employeeForm.email}
                  onChange={e => setEmployeeForm(v => ({ ...v, email: e.target.value }))} />
              </div>
              <div className="col-7">
                <label className="form-label small">Rôle</label>
                <select className="form-select form-select-sm" value={employeeForm.role}
                  onChange={e => setEmployeeForm(v => ({ ...v, role: e.target.value }))}>
                  <option value="employee">Employee/User</option>
                  <option value="canteen_admin">CanteenAdmin</option>
                  <option value="kitchen_staff">KitchenStaff</option>
                </select>
              </div>
              <div className="col-5">
                <label className="form-label small">Mot de passe</label>
                <input className="form-control form-control-sm" value={employeeForm.password}
                  onChange={e => setEmployeeForm(v => ({ ...v, password: e.target.value }))} />
              </div>
              <div className="col-12">
                <button className="btn btn-primary btn-sm w-100">Associer</button>
              </div>
            </form>
          </div>

          <div className="card p-3 mt-3">
            <h5 style={{ fontSize: 15 }}>Gaspillage par plat</h5>
            {(waste.items || []).slice(0, 8).map(item => (
              <div key={item.menu_item_id} className="d-flex align-items-center justify-content-between py-1" style={{ fontSize: 12 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.libelle}</span>
                <strong style={{ color: item.estimated_waste > 0 ? '#DC2626' : 'var(--rb-muted)' }}>
                  {item.estimated_waste}
                </strong>
              </div>
            ))}
            {(!waste.items || waste.items.length === 0) && <div className="text-secondary small">Aucune donnée.</div>}
          </div>
        </div>
      </div>

      <MealHistoryTable meals={history} />
    </>
  );
}
