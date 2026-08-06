/**
 * Logique panier des options produit (taille/quantité/poids/accompagnements/
 * suppléments/variantes) — partagée entre MenuItemModal (resto), ProductModal
 * (hanout) et ProductDetailPage (toutes catégories), au lieu de dupliquer les
 * mêmes règles de calcul de prix et de validation dans chaque écran. Le
 * vocabulaire d'option_type (single_choice/multi_choice/quantity/weight/text/
 * date_slot) est déjà générique côté backend (ProductOption.entity_type).
 */

/**
 * Clé de ligne panier — deux sélections d'options différentes pour le même
 * produit doivent rester deux lignes distinctes (ex. 2kg vs 2.5kg, ou tailles
 * différentes), sinon fusionner leurs quantités n'aurait aucun sens. Prend le
 * payload déjà construit par buildSelectedOptionsPayload (option_id/value_id/
 * numeric_value/text_value), pas les options brutes du produit.
 */
export function computeCartKey(productId, selectedOptions) {
  if (!selectedOptions || !selectedOptions.length) return `${productId}`;
  const sig = selectedOptions.map(o => `${o.option_id}:${o.value_id || ''}:${o.numeric_value || ''}:${o.text_value || ''}`).sort().join('|');
  return `${productId}::${sig}`;
}

export function clamp(v, min, max) {
  if (min != null && v < min) return min;
  if (max != null && v > max) return max;
  return v;
}

export function initOptionSelections(options) {
  const init = {};
  (options || []).forEach(opt => {
    if (opt.type === 'quantity' || opt.type === 'weight') init[opt.id] = opt.min_value ?? 1;
  });
  return init;
}

/**
 * Calcule le prix total à partir du prix de base + options sélectionnées.
 * Retourne aussi qtyOpt/qtyVal (option poids/quantité, s'il y en a une — elle
 * multiplie le prix de base, contrairement aux extra_price des choix qui
 * s'additionnent).
 */
export function computeOptionsPrice(basePrice, options, selections) {
  const base = Number(basePrice || 0);
  let total = base;

  const qtyOpt = (options || []).find(o => o.type === 'quantity' || o.type === 'weight');
  const qtyVal = qtyOpt ? (selections[qtyOpt.id] ?? (qtyOpt.min_value ?? 1)) : 1;
  if (qtyOpt) total = base * qtyVal;

  (options || []).forEach(opt => {
    if (opt.type === 'single_choice') {
      const vid = selections[opt.id];
      if (vid) {
        const v = opt.values.find(v => v.id === vid);
        if (v) total += Number(v.extra_price) * (qtyOpt ? qtyVal : 1);
      }
    } else if (opt.type === 'multi_choice') {
      (selections[opt.id] || []).forEach(vid => {
        const v = opt.values.find(v => v.id === vid);
        if (v) total += Number(v.extra_price);
      });
    } else if (opt.type === 'text' || opt.type === 'date_slot') {
      total += Number(opt.extra_price || 0);
    }
  });

  return { total, qtyOpt, qtyVal };
}

/**
 * Valide les options requises et construit le payload `selected_options`
 * envoyé au panier/backend. Retourne { errs } non vide si des options
 * requises manquent — à afficher, ne pas ajouter au panier dans ce cas.
 */
export function buildSelectedOptionsPayload(options, selections) {
  const errs = {};
  const selected_options = [];

  (options || []).forEach(opt => {
    if (opt.type === 'single_choice') {
      const vid = selections[opt.id];
      if (!vid && opt.required) { errs[opt.id] = 'Choix requis'; return; }
      if (vid) {
        const v = opt.values.find(v => v.id === vid);
        selected_options.push({ option_id: opt.id, option_name: opt.name, option_type: opt.type, value_id: vid, value_label: v?.label, extra_price: Number(v?.extra_price || 0) });
      }
    } else if (opt.type === 'multi_choice') {
      const vids = selections[opt.id] || [];
      if (opt.required && !vids.length) { errs[opt.id] = 'Au moins un choix requis'; return; }
      vids.forEach(vid => {
        const v = opt.values.find(v => v.id === vid);
        selected_options.push({ option_id: opt.id, option_name: opt.name, option_type: opt.type, value_id: vid, value_label: v?.label, extra_price: Number(v?.extra_price || 0) });
      });
    } else if (opt.type === 'quantity' || opt.type === 'weight') {
      const num = selections[opt.id] ?? (opt.min_value ?? 1);
      selected_options.push({ option_id: opt.id, option_name: opt.name, option_type: opt.type, numeric_value: num, extra_price: 0 });
    } else if (opt.type === 'text') {
      const txt = selections[opt.id] || '';
      if (opt.required && !txt.trim()) { errs[opt.id] = 'Ce champ est requis'; return; }
      if (txt.trim()) selected_options.push({ option_id: opt.id, option_name: opt.name, option_type: opt.type, text_value: txt.trim(), extra_price: Number(opt.extra_price || 0) });
    } else if (opt.type === 'date_slot') {
      const dt = selections[opt.id] || '';
      if (opt.required && !dt) { errs[opt.id] = 'Créneau requis'; return; }
      if (dt) selected_options.push({ option_id: opt.id, option_name: opt.name, option_type: opt.type, text_value: dt, extra_price: Number(opt.extra_price || 0) });
    }
  });

  return { errs, selected_options };
}
