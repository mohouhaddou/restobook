import { useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icône Leaflet par défaut cassée avec Vite — même correctif que
// GeocodingPicker.jsx, centralisé ici pour ne pas le dupliquer par composant.
let iconFixed = false;
function ensureDefaultIcon() {
  if (iconFixed) return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
  iconFixed = true;
}

/**
 * useLeafletMap — hook Leaflet vanilla réutilisable pour le module delivery.
 * Ce codebase n'utilise jamais react-leaflet (voir GeocodingPicker.jsx) :
 * ce hook généralise le même pattern impératif (L.map géré via useRef/useEffect)
 * pour gérer plusieurs marqueurs nommés (livreur/commerce/client) + un trajet,
 * plutôt que de le dupliquer dans chaque nouvelle carte.
 *
 * Usage :
 *   const { containerRef, setMarker, fitToMarkers } = useLeafletMap();
 *   <div ref={containerRef} style={{ height: 300 }} />
 *   setMarker('courier', { lat, lng, html: '🛵', rotation: heading });
 *
 * `containerRef` est une callback ref (pas un useRef simple) : plusieurs
 * consommateurs de ce hook ne rendent le <div> qu'après coup (ex: seulement
 * une fois un onglet actif, ou une fois une position GPS reçue). Un useRef +
 * useEffect(,[]) classique initialiserait la carte AVANT que ce <div> existe
 * dans le DOM (le node vaudrait encore null) et ne se redéclencherait jamais
 * ensuite → carte blanche/vide en permanence (bug constaté sur
 * DeliveryPage.jsx et OrderTrackingPage.jsx). Une callback ref est rappelée
 * par React exactement quand le node est monté/démonté, quel que soit le
 * moment — c'est le seul point d'init fiable ici.
 */
export function useLeafletMap({ center = [33.5731, -7.5898], zoom = 13, tileUrl, attribution } = {}) {
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const circlesRef = useRef({});
  const routesRef = useRef({});
  const markerDragHandlersRef = useRef({});
  const mapClickHandlerRef = useRef(null);

  const containerRef = useCallback((node) => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = {};
      circlesRef.current = {};
      routesRef.current = {};
    }
    if (!node) return; // démonté (changement d'onglet, disparition des données, etc.)

    ensureDefaultIcon();
    const map = L.map(node, { center, zoom });
    L.tileLayer(tileUrl || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: attribution || '&copy; <a href="https://carto.com">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    map.on('click', (e) => mapClickHandlerRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback toujours à jour (pas de fermeture obsolète) — le listener 'click'
  // n'est attaché qu'une fois à la création de la carte, mais lit cette ref
  // à chaque clic, donc `onClick` peut changer librement entre les rendus.
  const setOnMapClick = useCallback((fn) => { mapClickHandlerRef.current = fn; }, []);

  const setMarker = useCallback((key, { lat, lng, html, rotation = 0, zIndexOffset = 0, draggable = false, onDragEnd }) => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    if (onDragEnd) markerDragHandlersRef.current[key] = onDragEnd;
    const pos = [lat, lng];
    const icon = html
      ? L.divIcon({ html: `<div style="transform:rotate(${rotation}deg)">${html}</div>`, className: 'dv-marker', iconSize: [32, 32], iconAnchor: [16, 16] })
      : undefined;
    const existing = markersRef.current[key];
    if (existing) {
      existing.setLatLng(pos);
      if (icon) existing.setIcon(icon);
    } else {
      // icon omis (pas juste `undefined`) quand `html` n'est pas fourni : une
      // clé `icon: undefined` explicite ecrase quand meme l'icone par defaut
      // de Leaflet lors du merge d'options, ce qui casse _initIcon/_removeIcon
      // (AreaRadiusPicker est le premier appelant sans `html`, d'ou le crash).
      const markerOptions = { zIndexOffset, draggable };
      if (icon) markerOptions.icon = icon;
      const marker = L.marker(pos, markerOptions).addTo(map);
      if (draggable) {
        marker.on('dragend', (e) => {
          const p = e.target.getLatLng();
          markerDragHandlersRef.current[key]?.(p.lat, p.lng);
        });
      }
      markersRef.current[key] = marker;
    }
  }, []);

  const removeMarker = useCallback((key) => {
    const m = markersRef.current[key];
    if (m && mapRef.current) { mapRef.current.removeLayer(m); delete markersRef.current[key]; }
  }, []);

  const setCircle = useCallback((key, { lat, lng, radiusKm, color = '#FF8A00', fillOpacity = 0.15, dashArray, popupHtml }) => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null || radiusKm == null) return;
    const existing = circlesRef.current[key];
    if (existing) {
      existing.setLatLng([lat, lng]);
      existing.setRadius(radiusKm * 1000);
      existing.setStyle({ color, fillColor: color, fillOpacity, dashArray });
    } else {
      const circle = L.circle([lat, lng], { radius: radiusKm * 1000, color, fillColor: color, fillOpacity, weight: 2, dashArray }).addTo(map);
      circlesRef.current[key] = circle;
    }
    if (popupHtml) circlesRef.current[key].bindPopup(popupHtml);
  }, []);

  const removeCircle = useCallback((key) => {
    const c = circlesRef.current[key];
    if (c && mapRef.current) { mapRef.current.removeLayer(c); delete circlesRef.current[key]; }
  }, []);

  // Clé (comme setMarker/setCircle) : plusieurs trajets peuvent coexister,
  // ex. un tracé "vue d'ensemble commerce→client" en pointillés discret et un
  // tracé "itinéraire actif moi→prochain arrêt" en trait plein, mis à jour à
  // des rythmes différents (le 2e bouge à chaque tick GPS, pas le 1er).
  const drawRoute = useCallback((key, points, opts = {}) => {
    const map = mapRef.current;
    if (!map) return;
    const existing = routesRef.current[key];
    if (existing) { map.removeLayer(existing); delete routesRef.current[key]; }
    if (!points || points.length < 2) return;
    routesRef.current[key] = L.polyline(points, {
      color: opts.color || '#FF8A00', weight: opts.weight || 4,
      opacity: opts.opacity ?? 0.8, dashArray: opts.dashArray,
    }).addTo(map);
  }, []);

  const removeRoute = useCallback((key) => {
    const r = routesRef.current[key];
    if (r && mapRef.current) { mapRef.current.removeLayer(r); delete routesRef.current[key]; }
  }, []);

  const fitToMarkers = useCallback((padding = [40, 40]) => {
    const map = mapRef.current;
    const markers = Object.values(markersRef.current);
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
      return;
    }
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2), { padding });
  }, []);

  const panTo = useCallback((lat, lng, z) => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    map.setView([lat, lng], z || map.getZoom(), { animate: true });
  }, []);

  return { containerRef, mapRef, setMarker, removeMarker, setCircle, removeCircle, setOnMapClick, drawRoute, removeRoute, fitToMarkers, panTo };
}

export default useLeafletMap;
