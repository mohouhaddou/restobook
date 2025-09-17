import React, { useEffect, useMemo, useState } from 'react';
import { API } from './api';

function formatDate(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return tz.toISOString().slice(0,10);
}
function mondayOf(dateStr){
  const d=new Date(dateStr); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); return formatDate(d);
}
async function jfetch(url, options={}, token){
  const r = await fetch(url, { ...options, headers: { 'Content-Type':'application/json', ...(options.headers||{}), ...(token?{Authorization:`Bearer ${token}`}:{}) } });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if(!r.ok) throw new Error(j.error||'Erreur');
  return j;
}

export default function App(){
  const [token,setToken]=useState(null);
  const [user,setUser]=useState(null);
  const [date,setDate]=useState(formatDate());
  const [menu,setMenu]=useState({items:[]});
  const [myResa,setMyResa]=useState([]);
  const [items,setItems]=useState([]);
  const [msg,setMsg]=useState('');
  const isManager = user?.role==='manager' || user?.role==='admin';
  const isAdmin = user?.role==='admin';

  async function login(e){
    e.preventDefault();
    setMsg('');
    const form = new FormData(e.target);
    const matricule = form.get('matricule');
    const password = form.get('password');
    try{
      const j = await jfetch(API('/auth/login'), {method:'POST', body: JSON.stringify({matricule,password})});
      setToken(j.token); setUser(j.user);
    }catch(err){ setMsg(err.message); }
  }
  function logout(){ setToken(null); setUser(null); }

  const loadMenu = async () => { if(!token) return; try{ const j = await jfetch(API(`/menu/today?date=${date}`), {}, token); setMenu(j); }catch(e){ setMsg(e.message); } };
  const loadMine = async () => { if(!token) return; try{ const j = await jfetch(API('/reservations/me'), {}, token); setMyResa(j.items||[]);}catch(e){ setMsg(e.message); } };
  const loadItems = async () => { if(!token) return; try{ const j = await jfetch(API('/menu/items'), {}, token); setItems(j.items||[]);}catch(e){ setMsg(e.message); } };

  useEffect(()=>{ loadMenu(); },[date, token]);
  useEffect(()=>{ loadMine(); loadItems(); },[token]);

  const reserve = async (menu_item_id) => {
    setMsg('');
    try{
      const j = await jfetch(API('/reservations'), { method:'POST', body: JSON.stringify({ date_jour: date, menu_item_id }) }, token);
      setMsg(`Réservation OK. Code: ${j.pickup_code}`); loadMine(); loadMenu();
    }catch(e){ setMsg(e.message); }
  };
  const cancelResa = async (id) => {
    try{ await jfetch(API(`/reservations/${id}`), { method:'DELETE' }, token); setMsg('Réservation annulée.'); loadMine(); loadMenu(); }
    catch(e){ setMsg(e.message); }
  };

  const weekStart = useMemo(()=> mondayOf(date),[date]);
  const days = [...Array(5)].map((_,i)=>{ const d = new Date(weekStart); d.setDate(d.getDate()+i); return formatDate(d); });
  const [plan,setPlan]=useState({});

  function setDayItem(day, idx, field, value){
    setPlan(p=>{ const arr = [...(p[day]||[{},{},{}])]; arr[idx] = {...(arr[idx]||{}), [field]: value}; return {...p, [day]: arr}; });
  }
  async function saveDay(day){
    try{
      const itemsForDay = (plan[day]||[]).filter(x=>x.menu_item_id);
      await jfetch(API('/menu/day'), { method:'POST', body: JSON.stringify({ date_jour: day, items: itemsForDay.map(x=>({menu_item_id:Number(x.menu_item_id), quota: x.quota?Number(x.quota):null})) }) }, token);
      setMsg(`Menu enregistré pour ${day}`);
      if(day===date) loadMenu();
    }catch(e){ setMsg(e.message); }
  }

  const [users, setUsers] = useState([]);
  async function loadUsers(){ if(!token || !isAdmin) return; const j = await jfetch(API('/admin/users'), {}, token); setUsers(j.users||[]); }
  useEffect(()=>{ loadUsers(); },[token, isAdmin]);

  async function adminCreate(e){
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      matricule: f.get('matricule'),
      nom: f.get('nom'),
      email: f.get('email'),
      role: f.get('role'),
      password: f.get('password') || 'changeme',
      actif: true
    };
    try{ await jfetch(API('/admin/users'), { method:'POST', body: JSON.stringify(payload) }, token); setMsg('Utilisateur créé'); e.target.reset(); loadUsers(); }
    catch(e){ setMsg(e.message); }
  }
  async function adminUpdate(u, data){ try{ await jfetch(API(`/admin/users/${u.id}`), { method:'PATCH', body: JSON.stringify(data) }, token); setMsg('Utilisateur mis à jour'); loadUsers(); } catch(e){ setMsg(e.message); } }
  async function adminDelete(u){ if(!confirm('Supprimer utilisateur ?')) return; try{ await jfetch(API(`/admin/users/${u.id}`), { method:'DELETE' }, token); setMsg('Utilisateur supprimé'); loadUsers(); } catch(e){ setMsg(e.message); } }

  return (
    <div className="shell">
      <div className="nav">
        <h1 className="brand">Cantine • Réservations</h1>
        <div className="row">
          {user ? (<>
            <span className="muted">Connecté : <b>{user.nom||user.matricule}</b> <span className="pill">{user.role}</span></span>
            <button className="btn" onClick={logout}>Déconnexion</button>
          </>) : null}
        </div>
      </div>

      {!user ? (
        <div className="card">
          <h3>Connexion</h3>
          <p className="muted">Comptes démo — admin: <code>admin</code>/<code>admin123</code> • manager: <code>manager</code>/<code>manager123</code> • user: <code>E12345</code>/<code>test123</code></p>
          <form onSubmit={login} className="grid">
            <input name="matricule" placeholder="Matricule" required />
            <input name="password" type="password" placeholder="Mot de passe" required />
            <button className="btn primary" type="submit">Se connecter</button>
          </form>
          {msg && <p className="muted" style={{marginTop:8}}>{msg}</p>}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="tabs">
              <div className="tab active">Employé</div>
              {isManager && <div className="tab active">Gestion hebdo</div>}
              {isAdmin && <div className="tab active">Administration</div>}
            </div>

            <div className="grid">
              <div className="row">
                <label>Date :</label>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
                <button className="btn" onClick={loadMenu}>Recharger</button>
              </div>
              {menu.items?.length ? (
                <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                  {menu.items.map(it => (
                    <div key={it.id} className="card" style={{padding:12}}>
                      <div style={{fontWeight:600}}>{it.libelle}</div>
                      <div className="muted">{it.description}</div>
                      <div className="muted">Restant : {it.restant===null?'∞':it.restant}</div>
                      <button className="btn primary" disabled={menu.locked || (it.restant!==null && it.restant<=0)} onClick={()=>reserve(it.id)} style={{marginTop:8}}>Réserver</button>
                    </div>
                  ))}
                </div>
              ) : <p className="muted">Aucun item planifié pour ce jour.</p>}

              <div className="card">
                <h3>Mes réservations</h3>
                <ul>
                  {myResa.map(r => (
                    <li key={r.id} className="row">
                      <b>{r.date_jour}</b> — {r.menu_label} — {r.status}
                      {r.status==='confirmed' && <>
                        <span> | Code : <code>{r.pickup_code}</code></span>
                        <button className="btn danger" onClick={()=>cancelResa(r.id)}>Annuler</button>
                      </>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {isManager && (
            <div className="card" style={{marginTop:16}}>
              <h3>Planification hebdomadaire</h3>
              <div className="muted">Semaine du <b>{weekStart}</b></div>
              <div className="grid">
                {days.map((d)=>(
                  <div key={d} className="card" style={{padding:12}}>
                    <div className="row"><b>{d}</b> <button className="btn" onClick={()=>saveDay(d)}>Enregistrer ce jour</button></div>
                    {[0,1,2].map(i => (
                      <div key={i} className="row">
                        <select value={plan[d]?.[i]?.menu_item_id || ''} onChange={e=>setDayItem(d,i,'menu_item_id',e.target.value)}>
                          <option value="">— Plat —</option>
                          {items.map(it=><option key={it.id} value={it.id}>{it.libelle}</option>)}
                        </select>
                        <input type="number" min="0" placeholder="Quota (vide = ∞)" value={plan[d]?.[i]?.quota || ''} onChange={e=>setDayItem(d,i,'quota',e.target.value)} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="card" style={{marginTop:12}}>
                <h4>Ajouter un item de menu</h4>
                <AddItem onDone={loadItems} token={token} />
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="card" style={{marginTop:16}}>
              <h3>Administration — Utilisateurs</h3>
              <form onSubmit={adminCreate} className="row" style={{marginBottom:12}}>
                <input name="matricule" placeholder="Matricule" required />
                <input name="nom" placeholder="Nom" />
                <input name="email" placeholder="Email" />
                <select name="role" defaultValue="user">
                  <option value="user">user</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
                <input name="password" type="password" placeholder="Mot de passe (déf: changeme)" />
                <button className="btn primary" type="submit">Créer</button>
              </form>

              <table>
                <thead><tr><th>Matricule</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Actif</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u=> (
                    <tr key={u.id}>
                      <td>{u.matricule}</td>
                      <td>{u.nom||''}</td>
                      <td>{u.email||''}</td>
                      <td>
                        <select value={u.role} onChange={e=>adminUpdate(u,{role:e.target.value})}>
                          <option value="user">user</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td>
                        <input type="checkbox" checked={u.actif} onChange={e=>adminUpdate(u,{actif:e.target.checked})} />
                      </td>
                      <td className="row">
                        <button className="btn" onClick={()=>{
                          const pw = prompt('Nouveau mot de passe :');
                          if(pw) adminUpdate(u,{password:pw});
                        }}>Réinitialiser MDP</button>
                        <button className="btn danger" onClick={()=>adminDelete(u)}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {msg && <div className="card" style={{marginTop:16, borderColor:'#334155'}}>{msg}</div>}
    </div>
  );
}

function AddItem({onDone, token}){
  const [libelle,setLibelle]=useState('');
  const [description,setDescription]=useState('');
  const [type,setType]=useState('plat');
  async function save(e){
    e.preventDefault();
    try{
      await fetch(API('/menu/items'), { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({libelle,description,type})});
      setLibelle(''); setDescription(''); setType('plat'); onDone?.();
    }catch(e){ alert('Erreur ajout item'); }
  }
  return (
    <form onSubmit={save} className="row">
      <input placeholder="Libellé" value={libelle} onChange={e=>setLibelle(e.target.value)} required />
      <input placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} />
      <select value={type} onChange={e=>setType(e.target.value)}>
        <option value="plat">Plat</option>
        <option value="entrée">Entrée</option>
        <option value="dessert">Dessert</option>
        <option value="boisson">Boisson</option>
      </select>
      <button className="btn primary" type="submit">Ajouter</button>
    </form>
  );
}
