import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API } from '../../../shared/services/api';

// ── Styles inline ────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB',
  borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit',
  color: '#111827', background: '#fff', boxSizing: 'border-box',
};

/**
 * GeocodingPicker — composant réutilisable de saisie géographique
 *
 * Props :
 *   lat, lng           : coordonnées actuelles (number|null)
 *   address            : adresse texte (string)
 *   city               : ville (string)
 *   district           : quartier (string)
 *   formattedAddress   : adresse formatée Nominatim (string)
 *   geocodingSource    : 'nominatim'|'manual'|'gps'|null
 *   onUpdate(data)     : callback appelé avec { lat, lng, address, city, district, formatted_address, geocoding_source }
 *   compact            : boolean (carte plus petite)
 */
export function GeocodingPicker({
  lat, lng, address, city, district,
  formattedAddress, geocodingSource,
  onUpdate, compact = false,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const debRef       = useRef(null);
  const addrDebRef   = useRef(null);

  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,    setSearching]    = useState(false);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [revLoading,   setRevLoading]   = useState(false);
  const [showManual,   setShowManual]   = useState(false);

  // ── Fix icône Leaflet avec Vite ──────────────────────────────────────────
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // ── Initialisation carte ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = (lat && lng) ? [parseFloat(lat), parseFloat(lng)] : [33.5731, -7.5898];
    const zoom   = (lat && lng) ? 14 : 6;

    const map = L.map(containerRef.current, { center, zoom });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (lat && lng) {
      markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)], { draggable: true }).addTo(map);
      markerRef.current.on('dragend', e => {
        const { lat: la, lng: lo } = e.target.getLatLng();
        handleCoords(la, lo, 'nominatim');
      });
    }

    map.on('click', e => {
      const { lat: la, lng: lo } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([la, lo]);
      } else {
        markerRef.current = L.marker([la, lo], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', ev => {
          const { lat: dla, lng: dlo } = ev.target.getLatLng();
          handleCoords(dla, dlo, 'nominatim');
        });
      }
      handleCoords(la, lo, 'nominatim');
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mise à jour position marker quand lat/lng change de l'extérieur ─────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lat || !lng) return;
    const pos = [parseFloat(lat), parseFloat(lng)];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { draggable: true }).addTo(map);
      markerRef.current.on('dragend', e => {
        const { lat: la, lng: lo } = e.target.getLatLng();
        handleCoords(la, lo, 'nominatim');
      });
    }
    map.setView(pos, map.getZoom() < 12 ? 14 : map.getZoom(), { animate: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // ── Reverse geocode via /api/marketplace/geocode ──────────────────────────
  const reverseGeocode = useCallback(async (la, lo, source) => {
    setRevLoading(true);
    try {
      const url = API(`/marketplace/geocode?lat=${la}&lon=${lo}`);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const a = data.address || {};
      const resolvedCity    = a.city || a.town || a.village || '';
      const resolvedDistr   = a.suburb || a.neighbourhood || a.quarter || '';
      const resolvedAddress = a.road
        ? `${a.house_number ? a.house_number + ' ' : ''}${a.road}`.trim()
        : (data.display_name || '');
      onUpdate?.({
        lat: la,
        lng: lo,
        address:           resolvedAddress,
        city:              resolvedCity,
        district:          resolvedDistr,
        formatted_address: data.display_name || '',
        geocoding_source:  source || 'nominatim',
      });
    } catch {
      // reverse geocode silently fails — still update coords
      onUpdate?.({
        lat: la, lng: lo,
        address: address || '',
        city: city || '',
        district: district || '',
        formatted_address: formattedAddress || '',
        geocoding_source: source || 'nominatim',
      });
    } finally {
      setRevLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, city, district, formattedAddress]);

  // Debounced version of reverse geocode
  function handleCoords(la, lo, source) {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => reverseGeocode(la, lo, source), 400);
  }

  // ── GPS ──────────────────────────────────────────────────────────────────
  function handleGPS() {
    if (!navigator.geolocation) return alert('Géolocalisation non supportée par ce navigateur.');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: la, longitude: lo } = pos.coords;
        setGpsLoading(false);
        reverseGeocode(la, lo, 'gps');
      },
      () => {
        setGpsLoading(false);
        alert('Impossible de récupérer la position.');
      },
      { timeout: 10000 }
    );
  }

  // ── Recherche d'adresse ──────────────────────────────────────────────────
  async function searchAddress(q) {
    if (!q || q.length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const url = API(`/marketplace/geocode?q=${encodeURIComponent(q)}`);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickResult(item) {
    const la = parseFloat(item.lat);
    const lo = parseFloat(item.lon);
    const a  = item.address || {};
    const resolvedCity   = a.city || a.town || a.village || '';
    const resolvedDistr  = a.suburb || a.neighbourhood || a.quarter || '';
    const resolvedAddr   = a.road
      ? `${a.house_number ? a.house_number + ' ' : ''}${a.road}`.trim()
      : (item.display_name || '');

    setSearchQuery(item.display_name || '');
    setSearchResults([]);
    onUpdate?.({
      lat: la,
      lng: lo,
      address:           resolvedAddr,
      city:              resolvedCity,
      district:          resolvedDistr,
      formatted_address: item.display_name || '',
      geocoding_source:  'nominatim',
    });
  }

  const mapHeight = compact ? 200 : 300;
  const hasCoords = lat != null && lng != null && lat !== '' && lng !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Barre de recherche ── */}
      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>
          Rechercher une adresse
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            style={{ ...inp, flex: 1 }}
            type="text"
            placeholder="Ex : Rue Mohammed V, Casablanca…"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              clearTimeout(addrDebRef.current);
              addrDebRef.current = setTimeout(() => searchAddress(e.target.value), 500);
            }}
            onBlur={() => setTimeout(() => setSearchResults([]), 200)}
          />
          {searching && (
            <span style={{ fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>⏳</span>
          )}
        </div>
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
          }}>
            {searchResults.map((item, i) => (
              <button
                key={i} type="button"
                onMouseDown={() => pickResult(item)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', background: 'none',
                  padding: '9px 14px', cursor: 'pointer', fontSize: 12, color: '#374151',
                  borderBottom: i < searchResults.length - 1 ? '1px solid #F3F4F6' : 'none',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                📍 {item.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Bouton GPS ── */}
      <button
        type="button"
        onClick={handleGPS}
        disabled={gpsLoading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 16px', border: 'none', borderRadius: 10, cursor: gpsLoading ? 'default' : 'pointer',
          background: gpsLoading ? '#F1F5F9' : 'linear-gradient(135deg,#3B82F6,#2563EB)',
          color: gpsLoading ? '#94A3B8' : '#fff', fontWeight: 700, fontSize: 13,
          fontFamily: 'inherit', transition: 'all .15s',
          boxShadow: gpsLoading ? 'none' : '0 4px 14px rgba(59,130,246,.3)',
        }}
      >
        {gpsLoading
          ? <><span style={{ width: 14, height: 14, border: '2px solid #CBD5E1', borderTopColor: '#64748B', borderRadius: '50%', animation: 'geo-spin .7s linear infinite', display: 'inline-block' }} /> Localisation…</>
          : <>📡 Ma position</>}
      </button>

      {/* ── Carte Leaflet ── */}
      <div style={{ position: 'relative' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>
          Cliquez pour placer · Glissez le marqueur pour ajuster
        </label>
        <div ref={containerRef} style={{ height: mapHeight, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #E5E7EB' }} />
        {revLoading && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(255,255,255,.9)', padding: '4px 10px',
            borderRadius: 8, fontSize: 11, color: '#6B7280', fontWeight: 600,
            border: '1px solid #E5E7EB',
          }}>
            ⏳ Géocodage…
          </div>
        )}
      </div>

      {/* ── Adresse résolue (chip) ── */}
      {formattedAddress && geocodingSource !== 'manual' && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8,
          background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534',
        }}>
          <span style={{ flexShrink: 0 }}>✓</span>
          <span>{formattedAddress}</span>
        </div>
      )}
      {geocodingSource === 'manual' && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8,
          background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E',
        }}>
          <span style={{ flexShrink: 0 }}>✏️</span>
          <span>Adresse saisie manuellement</span>
        </div>
      )}

      {/* ── Section saisie manuelle (repliable) ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowManual(m => !m)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
            color: '#6B7280', fontFamily: 'inherit', padding: '2px 0', textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          {showManual ? '▲ Masquer la saisie manuelle' : '▼ Saisie manuelle de l\'adresse'}
        </button>
        {showManual && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: '#F9FAFB', borderRadius: 10, border: '1.5px solid #E5E7EB' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Adresse</label>
              <input
                style={inp}
                type="text"
                placeholder="N° rue, nom de rue…"
                value={address || ''}
                onChange={e => onUpdate?.({ lat, lng, address: e.target.value, city: city || '', district: district || '', formatted_address: formattedAddress || '', geocoding_source: 'manual' })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Ville</label>
                <input
                  style={inp}
                  type="text"
                  placeholder="Casablanca"
                  value={city || ''}
                  onChange={e => onUpdate?.({ lat, lng, address: address || '', city: e.target.value, district: district || '', formatted_address: formattedAddress || '', geocoding_source: 'manual' })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>Quartier</label>
                <input
                  style={inp}
                  type="text"
                  placeholder="Maârif, Mers Sultan…"
                  value={district || ''}
                  onChange={e => onUpdate?.({ lat, lng, address: address || '', city: city || '', district: e.target.value, formatted_address: formattedAddress || '', geocoding_source: 'manual' })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Coordonnées affichées ── */}
      {hasCoords && (
        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
          {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
        </div>
      )}

      <style>{`@keyframes geo-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default GeocodingPicker;
