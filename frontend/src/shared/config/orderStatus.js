// Source unique des statuts de commande — badges compacts (Activité, Wallet)
// et timelines détaillées (suivi de commande), pour éviter la double
// définition qui existait entre OrderTrackingPage.jsx et CustomerProfilePage.jsx.

export const STATUS_META = {
  pending:          { label: 'En attente',     color: '#9CA3AF', icon: '📥' },
  confirmed:        { label: 'Confirmée',      color: '#2563EB', icon: '✅' },
  preparing:        { label: 'En préparation', color: '#FF8A00', icon: '👨‍🍳' },
  ready:            { label: 'Prête',          color: '#16A34A', icon: '🛎️' },
  picked_up:        { label: 'Récupérée',      color: '#7C3AED', icon: '🎉' },
  on_the_way:       { label: 'En route',       color: '#7C3AED', icon: '🛵' },
  out_for_delivery: { label: 'En livraison',   color: '#7C3AED', icon: '🛵' },
  delivered:        { label: 'Livrée',         color: '#16A34A', icon: '🎉' },
  served:           { label: 'Servie',         color: '#16A34A', icon: '🍽️' },
  cancelled:        { label: 'Annulée',        color: '#DC2626', icon: '❌' },
};

export const TYPE_ICONS = { dine_in: '🍽️', takeaway: '🛍️', click_collect: '🏃', delivery: '🛵' };

// Timelines par mode de service — utilisées par OrderTrackingPage et la
// section "commandes actives" de l'Accueil du dashboard.
export const STATUS_STEPS = {
  TABLE_QR: [
    { key: 'pending',   label: 'Reçue',            icon: '📥', desc: 'Votre commande a bien été reçue par le restaurant' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le personnel a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation en cuisine' },
    { key: 'ready',     label: 'En cours de service', icon: '🍽️', desc: 'Vos plats arrivent à votre table' },
    { key: 'delivered', label: 'Servie',           icon: '🎉', desc: 'Bon appétit ! Paiement auprès du serveur.' },
  ],
  delivery: [
    { key: 'pending',    label: 'Reçue',            icon: '📥', desc: 'Votre commande a bien été reçue' },
    { key: 'confirmed',  label: 'Confirmée',         icon: '✅', desc: 'Le restaurant a confirmé votre commande' },
    { key: 'preparing',  label: 'En préparation',   icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation' },
    { key: 'ready',      label: 'Prête',             icon: '🛎️', desc: 'Votre commande attend le livreur' },
    { key: 'on_the_way', label: 'En livraison',     icon: '🛵', desc: 'Votre livreur est en chemin' },
    { key: 'delivered',  label: 'Livrée',            icon: '🎉', desc: 'Bon appétit !' },
  ],
  takeaway: [
    { key: 'pending',   label: 'Reçue',           icon: '📥', desc: 'Votre commande a bien été reçue' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le restaurant a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Vos plats sont en cours de préparation' },
    { key: 'ready',     label: 'Prête à emporter', icon: '🛎️', desc: 'Votre commande est prête, venez la récupérer' },
    { key: 'picked_up', label: 'Récupérée',       icon: '🎉', desc: 'Bonne dégustation !' },
  ],
  // Commerces (hanout/épicerie…) : leur statut passe directement de "ready" à
  // "delivered" (pas d'étape "picked_up"/"on_the_way" distincte dans HanoutOrder.status).
  hanout_pickup: [
    { key: 'pending',   label: 'Reçue',            icon: '📥', desc: 'Votre commande a bien été reçue par le commerce' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le commerce a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Votre commande est en cours de préparation' },
    { key: 'ready',     label: 'Prête',            icon: '🛎️', desc: 'Votre commande est prête, venez la récupérer' },
    { key: 'delivered', label: 'Récupérée',       icon: '🎉', desc: 'Merci pour votre achat !' },
  ],
  hanout_delivery: [
    { key: 'pending',   label: 'Reçue',            icon: '📥', desc: 'Votre commande a bien été reçue par le commerce' },
    { key: 'confirmed', label: 'Confirmée',        icon: '✅', desc: 'Le commerce a confirmé votre commande' },
    { key: 'preparing', label: 'En préparation',  icon: '👨‍🍳', desc: 'Votre commande est en cours de préparation' },
    { key: 'ready',     label: 'Prête',            icon: '🛎️', desc: 'Votre commande attend le livreur' },
    { key: 'delivered', label: 'Livrée',           icon: '🎉', desc: 'Merci pour votre achat !' },
  ],
};

export function getStatusSteps(order) {
  if (!order) return STATUS_STEPS.takeaway;
  if (order.engine === 'hanout') return order.type === 'delivery' ? STATUS_STEPS.hanout_delivery : STATUS_STEPS.hanout_pickup;
  if (order.order_source === 'TABLE_QR') return STATUS_STEPS.TABLE_QR;
  if (order.type === 'delivery') return STATUS_STEPS.delivery;
  return STATUS_STEPS.takeaway;
}
