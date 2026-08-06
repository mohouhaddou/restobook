import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Toast } from '../components/ui/Toast';
import { useDeliverySocket } from '../shared/hooks/useDeliverySocket';
import { useLeafletMap } from '../shared/hooks/useLeafletMap';
import { haversineKm, estimateEtaMin } from '../shared/utils/geo';
import { BarcodeCameraScanner } from '../shared/components/ui/BarcodeCameraScanner';
import VehicleDocumentsPanel from './delivery/VehicleDocumentsPanel';

// Une fois le colis récupéré, le prochain arrêt devient le client — avant ça,
// c'est le commerce. Détermine à la fois l'itinéraire actif affiché sur la
// carte et le texte de distance/ETA du bandeau.
const STATUSES_HEADED_TO_CLIENT = ['picked_up', 'on_the_way'];

// Fréquence de partage de position — dans la fourchette 2-5s demandée.
const POSITION_PUSH_INTERVAL_MS = 4000;

const DELIVERY_STATUS_FLOW = [
  { from: 'assigned',  to: 'picking_up',  label: 'Je pars chercher la commande' },
  { from: 'picking_up', to: 'picked_up',  label: 'J\'ai récupéré la commande' },
  { from: 'picked_up',  to: 'on_the_way', label: 'Je suis en route vers le client' },
  { from: 'on_the_way', to: 'delivered',  label: 'Commande livrée ✓' },
];

const STATUS_LABELS = {
  pending:    '⏳ En attente',
  assigned:   '👋 Assignée',
  picking_up: '🛵 En route resto',
  picked_up:  '📦 Récupérée',
  on_the_way: '📍 En route client',
  delivered:  '✅ Livrée',
  failed:     '❌ Échouée',
};

// Statuts choisissables manuellement — 'on_delivery' est dérivé par le
// système (acceptation d'une livraison), jamais un choix du livreur.
const COURIER_STATUS_OPTIONS = [
  { value: 'available', label: 'Disponible', dot: '#22C55E' },
  { value: 'paused',    label: 'Pause',       dot: '#F59E0B' },
  { value: 'offline',   label: 'Hors ligne',  dot: '#9CA3AF' },
];

const TABS = [
  { key: 'available', icon: '📋', label: 'Disponibles' },
  { key: 'current',   icon: '🚀', label: 'En cours' },
  { key: 'history',   icon: '📅', label: 'Historique' },
  { key: 'vehicle',   icon: '🚗', label: 'Véhicule' },
];

export default function DeliveryPage() {
  const { get, post, patch } = useApi();

  const [available, setAvailable]   = useState([]);
  const [myDelivery, setMyDelivery] = useState(null);
  const [history, setHistory]       = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [tab, setTab]               = useState('available');
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState('');
  const [msgKind, setMsgKind]       = useState('success');
  const [selfPos, setSelfPos]       = useState(null);
  const [gpsError, setGpsError]     = useState('');
  const [courierStatus, setCourierStatus] = useState(null);
  const [statusSaving, setStatusSaving]   = useState(false);
  const [offer, setOffer]           = useState(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerSecondsLeft, setOfferSecondsLeft] = useState(0);
  const [showDeliveryScanner, setShowDeliveryScanner] = useState(false);
  const [manualCode, setManualCode]   = useState('');
  const [scannerUnavailable, setScannerUnavailable] = useState(false);

  const { pushPosition } = useDeliverySocket({
    asCourier: true,
    onDispatchOffer: (data) => setOffer(data),
  });
  const { containerRef: mapRef, setMarker, removeMarker, drawRoute, fitToMarkers, panTo } = useLeafletMap({ zoom: 15 });

  // ── Statut manuel du livreur (Disponible/Pause/Hors ligne) ────────────────
  useEffect(() => {
    get('/delivery/me').then(d => setCourierStatus(d.status)).catch(() => {});
  }, []);

  async function changeCourierStatus(value) {
    setStatusSaving(true);
    try {
      await patch('/delivery/me/status', { status: value });
      setCourierStatus(value);
    } catch (e) {
      toast(e.message || 'Erreur', 'error');
    }
    setStatusSaving(false);
  }

  // ── Compte à rebours de l'offre de dispatch en cours ──────────────────────
  useEffect(() => {
    if (!offer?.expires_at) { setOfferSecondsLeft(0); return; }
    function tick() {
      const s = Math.max(0, Math.round((new Date(offer.expires_at) - Date.now()) / 1000));
      setOfferSecondsLeft(s);
      if (s === 0) setOffer(null); // expiration réelle gérée côté serveur (sweep) — ici purement visuel
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [offer?.expires_at]);

  async function respondOffer(action) {
    if (!offer) return;
    setOfferLoading(true);
    try {
      await post(`/delivery/assignments/${offer.delivery_id}/${action}`, {});
      if (action === 'accept') {
        toast('Livraison acceptée ! Bonne route 🛵');
        await loadHistory();
        setTab('current');
      }
    } catch (e) {
      toast(e.message || 'Offre expirée ou déjà traitée', 'error');
    }
    setOffer(null);
    setOfferLoading(false);
  }

  function toast(m, kind = 'success') { setMsg(m); setMsgKind(kind); }

  // ── Partage de position GPS temps réel (toutes les 2-5s) ──────────────────
  // Envoyée en continu tant que la page livreur est ouverte (pas seulement
  // pendant une livraison active) : le dispatch/la carte SuperAdmin a besoin
  // de connaître la position des livreurs disponibles, pas seulement occupés.
  const pushPositionRef = useRef(pushPosition);
  pushPositionRef.current = pushPosition;
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('Géolocalisation non supportée par ce navigateur.'); return; }
    let cancelled = false;
    function tick() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          const { latitude, longitude, speed, heading, accuracy } = pos.coords;
          setSelfPos({ lat: latitude, lng: longitude, heading: heading || 0 });
          setGpsError('');
          pushPositionRef.current({
            lat: latitude, lng: longitude,
            speed_kmh: speed != null ? speed * 3.6 : undefined,
            heading_deg: heading != null ? heading : undefined,
            accuracy_m: accuracy != null ? accuracy : undefined,
          });
        },
        () => { if (!cancelled) setGpsError('Position indisponible — autorisez la géolocalisation.'); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
    tick();
    const id = setInterval(tick, POSITION_PUSH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Prochain arrêt du livreur — le commerce tant que le colis n'est pas
  // récupéré, le client ensuite. Piloté par le statut, pas par un choix manuel.
  const headedToClient = myDelivery ? STATUSES_HEADED_TO_CLIENT.includes(myDelivery.status) : false;
  const nextStop = myDelivery
    ? (headedToClient
        ? (myDelivery.delivery_lat != null ? { lat: myDelivery.delivery_lat, lng: myDelivery.delivery_lng, kind: 'client' } : null)
        : (myDelivery.restaurant_lat != null ? { lat: myDelivery.restaurant_lat, lng: myDelivery.restaurant_lng, kind: 'business' } : null))
    : null;
  const distToNextStopKm = (selfPos && nextStop) ? haversineKm(selfPos.lat, selfPos.lng, nextStop.lat, nextStop.lng) : null;
  const etaToNextStopMin = estimateEtaMin(distToNextStopKm);

  useEffect(() => {
    if (!selfPos) return;
    setMarker('self', { lat: selfPos.lat, lng: selfPos.lng, html: '🛵', rotation: selfPos.heading });
    // Itinéraire actif (moi → prochain arrêt) — recalculé à chaque position,
    // distinct du tracé "vue d'ensemble" commerce↔client (voir effet suivant)
    // qui lui ne bouge pas à chaque tick GPS.
    if (nextStop) {
      drawRoute('active-leg', [[selfPos.lat, selfPos.lng], [nextStop.lat, nextStop.lng]], { color: '#FF5D00', weight: 5, opacity: 0.9 });
    } else {
      drawRoute('active-leg', null);
    }
    // Pendant une livraison active, la vue est cadrée sur commerce+client+moi
    // (voir l'effet ci-dessous) — ne pas la faire fuir vers "self" à chaque
    // tick GPS, sinon elle dézoome jamais. Le bouton 🎯 recentre à la demande.
    if (!myDelivery) panTo(selfPos.lat, selfPos.lng);
  }, [selfPos, nextStop?.lat, nextStop?.lng, setMarker, drawRoute, panTo, myDelivery]);

  // Position du commerce (retrait) et du client (dépôt) sur la carte livreur —
  // n'affichait auparavant que le livreur lui-même, aucun repère de contexte.
  // Tracé pointillé discret = trajet global de la commande (contexte), à ne
  // pas confondre avec le tracé plein "active-leg" ci-dessus (le vrai
  // itinéraire à suivre maintenant).
  useEffect(() => {
    const pickupLat = myDelivery?.restaurant_lat, pickupLng = myDelivery?.restaurant_lng;
    const dropLat   = myDelivery?.delivery_lat,   dropLng   = myDelivery?.delivery_lng;
    if (pickupLat != null && pickupLng != null) setMarker('business', { lat: pickupLat, lng: pickupLng, html: '🏪' });
    else removeMarker('business');
    if (dropLat != null && dropLng != null) setMarker('client', { lat: dropLat, lng: dropLng, html: '🏠' });
    else removeMarker('client');
    if (pickupLat != null && dropLat != null) {
      drawRoute('overview', [[pickupLat, pickupLng], [dropLat, dropLng]], { color: '#9CA3AF', weight: 3, opacity: 0.6, dashArray: '2,10' });
    } else {
      drawRoute('overview', null);
    }
    if (pickupLat != null || dropLat != null) fitToMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myDelivery?.delivery_id, myDelivery?.restaurant_lat, myDelivery?.restaurant_lng, myDelivery?.delivery_lat, myDelivery?.delivery_lng]);

  function recenterMap() {
    if (selfPos) panTo(selfPos.lat, selfPos.lng, 16);
  }

  async function loadAvailable() {
    try { const d = await get('/delivery/available'); setAvailable(d.available || []); } catch {}
  }

  async function loadHistory() {
    try {
      const d = await get('/delivery/history');
      setHistory(d.history || []);
      setTodaySummary(d.today_summary || null);
      // Trouver la livraison en cours
      const active = (d.history || []).find(h => !['delivered','failed'].includes(h.status));
      setMyDelivery(active || null);
    } catch {}
  }

  useEffect(() => {
    loadAvailable();
    loadHistory();
    const id = setInterval(() => { loadAvailable(); loadHistory(); }, 20000);
    return () => clearInterval(id);
  }, []);

  // Les deux endpoints ci-dessous s'appuient sur l'id de la ligne `Delivery`
  // (pas l'id de la commande) : une commande resto et une commande hanout
  // peuvent partager le même id numérique (deux séquences indépendantes),
  // seul delivery_id est sans ambiguïté — voir orderEngine.js côté backend.
  async function acceptDelivery(deliveryId) {
    setLoading(true);
    try {
      await post(`/delivery/accept/${deliveryId}`, {});
      toast('Livraison acceptée ! Bonne route 🛵');
      await loadHistory();
      await loadAvailable();
      setTab('current');
    } catch (e) {
      toast(e.message || 'Erreur', 'error');
    }
    setLoading(false);
  }

  async function updateStatus(deliveryId, newStatus) {
    setLoading(true);
    try {
      await patch(`/delivery/${deliveryId}/status`, { status: newStatus });
      if (newStatus === 'delivered') toast('Livraison terminée ! Bien joué 🎉');
      else toast('Statut mis à jour');
      await loadHistory();
      await loadAvailable();
    } catch (e) {
      toast(e.message || 'Erreur', 'error');
    }
    setLoading(false);
  }

  function getNextAction(status) {
    return DELIVERY_STATUS_FLOW.find(f => f.from === status);
  }

  // Validation de la livraison par scan du QR code du reçu (affiché au client
  // sur /track/:code) — évite qu'un livreur marque "livré" sans être
  // réellement chez le client, preuve physique minimale sans dépendance
  // supplémentaire (même lib html5-qrcode que le scan code-barres produit).
  function handleScannedCode(scannedRaw) {
    if (!myDelivery) { setShowDeliveryScanner(false); return; }
    const scanned  = String(scannedRaw || '').trim();
    const expected = String(myDelivery.pickup_code || '').trim();
    if (!expected || scanned !== expected) {
      toast("Ce reçu ne correspond pas à cette livraison — vérifiez le QR code du client.", 'error');
      return;
    }
    setShowDeliveryScanner(false);
    updateStatus(myDelivery.delivery_id, 'delivered');
  }

  const cardStyle = {
    background: '#fff', borderRadius: 14, padding: 16,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 12
  };

  return (
    <div className="dp-page">
      <style>{`
        .dp-page { max-width: 560px; width: 100%; margin: 0 auto; padding: 0 2px; box-sizing: border-box; }
        .dp-page * { box-sizing: border-box; min-width: 0; }
        @media (max-width: 480px) {
          .dp-page { padding: 0; max-width: 100%; }
        }

        @keyframes dp-offer-in { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes dp-fade-in  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dp-pulse    { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        .dp-offer-card { animation: dp-offer-in .3s cubic-bezier(.34,1.56,.64,1); }
        .dp-fade-in { animation: dp-fade-in .35s ease-out; }

        /* ── Carte héro — toujours visible, en haut de page ──
           position+z-index (pas juste position:relative) crée un vrai
           nouveau contexte d'empilement : les panes/contrôles internes de
           Leaflet (z-index jusqu'à 1000) restent confinés à l'intérieur et
           ne peuvent plus jamais passer au-dessus du menu déroulant du
           Navbar (dropdown Bootstrap, aussi z-index:1000) — sans isolation,
           l'égalité de z-index se départageait par ordre du DOM, et la
           carte, rendue après le Navbar, gagnait. */
        .dp-hero-map {
          position: relative; z-index: 0; isolation: isolate;
          border-radius: 20px; overflow: hidden;
          box-shadow: 0 10px 30px rgba(17,24,39,.10); margin-bottom: 14px;
          background: linear-gradient(135deg,#FFF7ED,#FFEDD5);
        }
        .dp-hero-map__canvas { height: 42vh; min-height: 200px; max-height: 300px; width: 100%; }
        @media (max-width: 480px) {
          .dp-hero-map { border-radius: 14px; }
          .dp-hero-map__canvas { height: 32vh; min-height: 160px; max-height: 220px; }
        }
        .dp-hero-map__footer {
          display: flex; align-items: center; gap: 8px; padding: 10px 14px;
          font-size: 12.5px; font-weight: 600; background: #fff;
        }
        .dp-hero-map__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dp-hero-map__dot.ok    { background: #22C55E; animation: dp-pulse 2s infinite; }
        .dp-hero-map__dot.error { background: #DC2626; }
        .dp-hero-map__text { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dp-recenter-btn {
          position: absolute; bottom: 54px; right: 12px; z-index: 500;
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: #fff; box-shadow: 0 4px 14px rgba(0,0,0,.2);
          font-size: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }

        /* ── Header + statut ── */
        .dp-topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
        .dp-title { font-size: 19px; font-weight: 800; margin: 0; color: #111827; display: flex; align-items: center; gap: 8px; white-space: nowrap; }

        /* Segmented control — flex:1 à parts égales garanties, jamais de
           débordement possible (contrairement à un flex-wrap imbriqué dont le
           rétrécissement dépend du navigateur) : le texte s'ellipse au pire. */
        .dp-segmented { display: flex; width: 100%; background: #F3F4F6; border-radius: 14px; padding: 4px; gap: 4px; }
        .dp-segmented button {
          flex: 1 1 0; min-width: 0; border: none; background: transparent;
          padding: 8px 4px; border-radius: 10px; font-size: 12px; font-weight: 700;
          color: #6B7280; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: flex; align-items: center; justify-content: center; gap: 5px;
          transition: background .15s, color .15s;
        }
        .dp-segmented button.active { background: #fff; color: #111827; box-shadow: 0 1px 5px rgba(0,0,0,.12); }
        .dp-segmented .dp-seg-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        /* ── Stats ── */
        .dp-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
        .dp-stat-card { min-width: 0; background: #fff; border-radius: 14px; padding: 12px 4px; text-align: center; box-shadow: 0 1px 6px rgba(0,0,0,.05); }
        .dp-stat-card__value { font-size: clamp(13px, 4.2vw, 19px); font-weight: 800; color: var(--rb-orange,#FF8A00); overflow-wrap: break-word; line-height: 1.2; }
        .dp-stat-card__label { font-size: 10.5px; color: #6B7280; margin-top: 3px; }

        @media (max-width: 480px) {
          .dp-segmented { padding: 3px; gap: 3px; }
          .dp-segmented button { padding: 7px 2px; font-size: 11px; gap: 3px; }
          .dp-stats { gap: 6px; }
          .dp-stat-card { padding: 9px 2px; border-radius: 12px; }
          .dp-stat-card__label { font-size: 9.5px; }
        }

        /* ── Cartes de contenu (listes disponibles/en cours/historique) ──
           cardStyle est appliqué en style inline (partagé avec le reste du
           fichier) ; ce !important, scopé à cette seule page, réduit son
           padding sur petit écran sans dupliquer cardStyle en JS. */
        @media (max-width: 480px) {
          .dp-card { padding: 12px !important; border-radius: 12px !important; }
        }

        /* ── Tabs (scroll horizontal assumé, avec indice visuel) ── */
        .dp-tabs-wrap { position: relative; margin-bottom: 14px; }
        .dp-tabs { display: flex; gap: 2px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; border-bottom: 2px solid #F3F4F6; }
        .dp-tabs::-webkit-scrollbar { display: none; }
        .dp-tabs button {
          flex: 0 0 auto; display: flex; align-items: center; gap: 5px;
          padding: 9px 13px; border: none; background: none; cursor: pointer;
          font-size: 12.5px; font-weight: 600; color: #6B7280;
          border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap;
        }
        .dp-tabs button.active { color: var(--rb-orange,#FF8A00); border-bottom-color: var(--rb-orange,#FF8A00); font-weight: 700; }
        @media (max-width: 480px) {
          .dp-tabs button { padding: 8px 9px; font-size: 11.5px; }
        }
        .dp-tabs-wrap::after {
          content: ''; position: absolute; top: 0; right: 0; bottom: 2px; width: 22px;
          background: linear-gradient(90deg, rgba(255,255,255,0), #fff);
          pointer-events: none;
        }
      `}</style>

      <Toast message={msg} onClose={() => setMsg('')} kind={msgKind} />

      {/* ── Carte en direct — toujours affichée en haut de page ── */}
      <div className="dp-hero-map">
        <div ref={mapRef} className="dp-hero-map__canvas" />
        {selfPos && (
          <button className="dp-recenter-btn" onClick={recenterMap} title="Recentrer sur ma position" aria-label="Recentrer sur ma position">🎯</button>
        )}
        <div className="dp-hero-map__footer">
          <span className={`dp-hero-map__dot ${gpsError ? 'error' : 'ok'}`} />
          <span className="dp-hero-map__text">
            {gpsError || (
              nextStop
                ? `🛵 ${distToNextStopKm != null ? `${distToNextStopKm.toFixed(1)} km · ~${etaToNextStopMin} min` : '…'} vers ${nextStop.kind === 'client' ? (myDelivery.guest_name || 'le client') : (myDelivery.restaurant_name || 'le commerce')}`
                : (myDelivery ? `En route · ${myDelivery.guest_name || 'client'} · ${myDelivery.delivery_address || ''}` : 'Position partagée en direct')
            )}
          </span>
        </div>
      </div>

      {/* ── Titre + statut ── */}
      <div className="dp-topbar">
        <h2 className="dp-title">🛵 Espace Livreur</h2>
      </div>
      <div className="dp-segmented" style={{ marginBottom: 14 }}>
        {COURIER_STATUS_OPTIONS.map(opt => (
          <button key={opt.value} disabled={statusSaving} onClick={() => changeCourierStatus(opt.value)}
            className={courierStatus === opt.value ? 'active' : ''}>
            <span className="dp-seg-dot" style={{ background: opt.dot }} />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Offre de dispatch en cours — moteur automatique (Phase 3) */}
      {offer && (
        <div className="dp-offer-card dp-card" style={{
          ...cardStyle, border: '2px solid var(--rb-orange,#FF8A00)',
          boxShadow: '0 4px 20px rgba(255,138,0,.25)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', minWidth: 0 }}>🔔 Nouvelle proposition</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: offerSecondsLeft <= 10 ? '#DC2626' : 'var(--rb-orange,#FF8A00)', flexShrink: 0 }}>
              {offerSecondsLeft}s
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 14, color: '#374151' }}>
            <div style={{ fontWeight: 700, overflowWrap: 'break-word' }}>{offer.restaurant_name}</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2, overflowWrap: 'break-word' }}>🏠 {offer.delivery_address}</div>
            <div style={{ fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', marginTop: 6 }}>+{Number(offer.fee).toFixed(2)} MAD</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => respondOffer('reject')} disabled={offerLoading} style={{
              flex: 1, padding: '12px', background: '#fff', border: '1.5px solid #FCA5A5', color: '#DC2626',
              borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>✕ Refuser</button>
            <button onClick={() => respondOffer('accept')} disabled={offerLoading} style={{
              flex: 2, padding: '12px', background: '#16A34A', border: 'none', color: '#fff',
              borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>{offerLoading ? '…' : '✓ Accepter'}</button>
          </div>
        </div>
      )}

      {/* Stats du jour */}
      {todaySummary && (
        <div className="dp-stats">
          {[
            { label: 'Livraisons', value: todaySummary.count },
            { label: 'Terminées', value: todaySummary.completed },
            { label: 'Gains', value: `${todaySummary.earnings?.toFixed(2)} MAD` },
          ].map(s => (
            <div key={s.label} className="dp-stat-card">
              <div className="dp-stat-card__value">{s.value}</div>
              <div className="dp-stat-card__label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="dp-tabs-wrap">
        <div className="dp-tabs">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'active' : ''}>
              <span>{t.icon}</span>
              <span>{t.label}{t.key === 'available' && available.length > 0 ? ` (${available.length})` : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Livraisons disponibles */}
      {tab === 'available' && (
        <div className="dp-fade-in">
          {available.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>🛵</div>
              <div style={{ marginTop: 8 }}>Aucune livraison disponible pour le moment</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Les nouvelles commandes apparaîtront ici</div>
            </div>
          ) : available.map(d => (
            <div key={d.order_id} className="dp-card" style={cardStyle}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', overflowWrap: 'break-word' }}>
                    {d.restaurant.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2, overflowWrap: 'break-word' }}>
                    📍 {d.restaurant.address || 'Adresse non renseignée'}
                  </div>
                  {d.restaurant.phone && (
                    <a href={`tel:${d.restaurant.phone}`} style={{ fontSize: 12, color: 'var(--rb-orange,#FF8A00)' }}>
                      {d.restaurant.phone}
                    </a>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', fontSize: 15, whiteSpace: 'nowrap' }}>
                    +{Number(d.fee).toFixed(2)} MAD
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{d.items_count} article(s)</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, fontSize: 13, color: '#374151', overflowWrap: 'break-word' }}>
                📦 Client : {d.guest_name}<br />
                🏠 {d.delivery_address}
              </div>
              <button
                onClick={() => acceptDelivery(d.delivery_id)}
                disabled={loading}
                style={{
                  marginTop: 12, width: '100%', padding: '12px', background: '#16A34A',
                  color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer'
                }}
              >
                {loading ? '…' : '✓ Accepter cette livraison'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Livraison en cours */}
      {tab === 'current' && (
        <div className="dp-fade-in">
          {!myDelivery ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ marginTop: 8 }}>Pas de livraison en cours</div>
              <button onClick={() => setTab('available')} style={{
                marginTop: 12, padding: '10px 20px', background: 'var(--rb-orange,#FF8A00)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}>
                Voir les livraisons disponibles
              </button>
            </div>
          ) : (
            <div>
              <div className="dp-card" style={cardStyle}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                  {STATUS_LABELS[myDelivery.status] || myDelivery.status}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>Code : {myDelivery.pickup_code}</div>
                <div style={{ marginTop: 10, fontSize: 14, color: '#374151', overflowWrap: 'break-word' }}>
                  <div>👤 Client : {myDelivery.guest_name}</div>
                  <div style={{ marginTop: 4 }}>🏠 Adresse : {myDelivery.delivery_address}</div>
                  {myDelivery.restaurant_name && (
                    <div style={{ marginTop: 4 }}>🏪 Restaurant : {myDelivery.restaurant_name}</div>
                  )}
                </div>
              </div>

              {getNextAction(myDelivery.status) && (
                <button
                  onClick={() => {
                    const next = getNextAction(myDelivery.status).to;
                    if (next === 'delivered') { setManualCode(''); setScannerUnavailable(false); setShowDeliveryScanner(true); }
                    else updateStatus(myDelivery.delivery_id, next);
                  }}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '15px', background: 'var(--rb-orange,#FF8A00)',
                    color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(234,88,12,0.3)'
                  }}
                >
                  {loading ? 'Mise à jour…' : (getNextAction(myDelivery.status).to === 'delivered' ? '📷 Scanner le reçu pour valider' : getNextAction(myDelivery.status).label)}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {tab === 'history' && (
        <div className="dp-fade-in">
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 32 }}>📅</div>
              <div style={{ marginTop: 8 }}>Aucune livraison dans l'historique</div>
            </div>
          ) : history.map(h => (
            <div key={h.delivery_id} className="dp-card" style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflowWrap: 'break-word' }}>{h.restaurant_name || 'Restaurant'}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {h.created_at ? new Date(h.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, overflowWrap: 'break-word' }}>{h.guest_name}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: ['delivered'].includes(h.status) ? '#16A34A' : '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {STATUS_LABELS[h.status] || h.status}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rb-orange,#FF8A00)', marginTop: 4, whiteSpace: 'nowrap' }}>
                  +{Number(h.fee).toFixed(2)} MAD
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Véhicule & Documents */}
      {tab === 'vehicle' && <div className="dp-fade-in"><VehicleDocumentsPanel /></div>}

      {/* Scanner QR — validation de la livraison par le reçu du client */}
      {showDeliveryScanner && (
        <BarcodeCameraScanner
          continuous
          includeQr
          title="📷 Scanner le reçu du client"
          hintText="Visez le QR code affiché sur le reçu / suivi de commande du client."
          onDetected={handleScannedCode}
          onClose={() => setShowDeliveryScanner(false)}
          onUnavailable={() => setScannerUnavailable(true)}
        />
      )}
      {showDeliveryScanner && scannerUnavailable && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 210,
          background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 8px 30px rgba(0,0,0,.25)',
          width: 'min(340px, calc(100vw - 32px))', display: 'flex', gap: 8,
        }}>
          <input
            value={manualCode} onChange={e => setManualCode(e.target.value)}
            placeholder="Code du reçu (ex: A1B2C3)"
            style={{ flex: 1, minWidth: 0, padding: '9px 10px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13 }}
          />
          <button
            onClick={() => handleScannedCode(manualCode)}
            style={{ flexShrink: 0, padding: '9px 14px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Valider
          </button>
        </div>
      )}
    </div>
  );
}
