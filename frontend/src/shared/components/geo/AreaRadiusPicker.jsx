import React, { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { useLeafletMap } from '../../hooks/useLeafletMap';

const DEFAULT_CENTER = [33.5731, -7.5898]; // Casablanca — repli si aucun centre choisi

/**
 * AreaRadiusPicker — carte + slider pour choisir un centre (clic ou glisser
 * le marqueur) et un rayon (cercle synchronise en direct), reutilise
 * useLeafletMap (meme pattern que DeliveryPage/OrderTrackingPage) plutot que
 * de dupliquer l'init Leaflet deja faite dans GeocodingPicker.jsx.
 */
export function AreaRadiusPicker({ lat, lng, radiusKm, onCenterChange, onRadiusChange, minRadius = 0.2, maxRadius = 5 }) {
  const { containerRef, setMarker, setCircle, setOnMapClick, panTo } = useLeafletMap({
    center: (lat != null && lng != null) ? [Number(lat), Number(lng)] : DEFAULT_CENTER,
    zoom: (lat != null && lng != null) ? 13 : 6,
  });
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    setOnMapClick((la, lo) => onCenterChange(la, lo));
  }, [setOnMapClick, onCenterChange]);

  useEffect(() => {
    if (lat == null || lng == null) return;
    setMarker('center', { lat: Number(lat), lng: Number(lng), draggable: true, onDragEnd: onCenterChange });
    setCircle('radius', { lat: Number(lat), lng: Number(lng), radiusKm: Number(radiusKm) || minRadius });
  }, [lat, lng, radiusKm, minRadius, setMarker, setCircle, onCenterChange]);

  function useGPS() {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsLoading(false);
        const { latitude: la, longitude: lo } = pos.coords;
        onCenterChange(la, lo);
        panTo(la, lo, 13);
      },
      () => setGpsLoading(false),
      { timeout: 10000 }
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Cliquez pour placer le centre · glissez le marqueur pour ajuster
        </label>
        <button type="button" onClick={useGPS} disabled={gpsLoading} style={{ border: 'none', background: 'none', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: gpsLoading ? 'default' : 'pointer', padding: 0 }}>
          {gpsLoading ? '⏳' : '📡'} Ma position
        </button>
      </div>
      <div ref={containerRef} style={{ height: 240, borderRadius: 12, overflow: 'hidden', border: '1.5px solid #E5E7EB' }} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#4B5563', fontWeight: 700, marginBottom: 4 }}>
          <span>Rayon</span>
          <span>{Number(radiusKm || minRadius).toFixed(1)} km</span>
        </div>
        <input
          type="range"
          min={minRadius}
          max={maxRadius}
          step="0.1"
          value={radiusKm || minRadius}
          onChange={e => onRadiusChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {lat != null && lng != null && (
        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>{Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}</div>
      )}
    </div>
  );
}

export default AreaRadiusPicker;
