export function statusKey(status, domain = 'common') {
  const value = String(status || 'unknown').trim().toLowerCase();
  return `status.${domain}.${value || 'unknown'}`;
}

export function translateStatus(t, status, domain = 'common') {
  const value = String(status || 'unknown').trim().toLowerCase();
  return t(statusKey(value, domain)) || t(`status.common.${value}`) || t('status.common.unknown');
}

export function translateOrderStatus(t, status) {
  return translateStatus(t, status, 'order');
}

export function translatePaymentStatus(t, status) {
  return translateStatus(t, status, 'payment');
}

export function translateStoreStatus(t, status) {
  return translateStatus(t, status, 'store');
}


export function translatePharmacyStatus(t, status) {
  return translateStatus(t, status, 'pharmacy');
}

export function translatePharmacyPrescriptionStatus(t, status) {
  return translateStatus(t, status, 'pharmacy_prescription');
}

export function translatePharmacyPurchaseOrderStatus(t, status) {
  return translateStatus(t, status, 'pharmacy_purchase_order');
}

export function translateStockStatus(t, status) {
  return translateStatus(t, status, 'stock');
}

export function translateTableStatus(t, status) {
  return translateStatus(t, status, 'table');
}

export function translateReservationStatus(t, status) {
  return translateStatus(t, status, 'reservation');
}

export function inventoryMovementKey(type) {
  const value = String(type || 'adjustment').trim().toLowerCase();
  return `inventory.movement.${value || 'adjustment'}`;
}

export function translateInventoryMovement(t, type) {
  return t(inventoryMovementKey(type));
}

export function unitKey(unit) {
  const raw = String(unit || 'unit').trim().toLowerCase();
  const normalized = {
    '': 'unit',
    unite: 'unit',
    unitee: 'unit',
    unité: 'unit',
    piece: 'piece',
    pièce: 'piece',
    pieces: 'piece',
    pièces: 'piece',
    l: 'liter',
    litre: 'liter',
    liter: 'liter',
    litres: 'liter',
    paquet: 'pack',
    pack: 'pack',
    boite: 'box',
    boîte: 'box',
    box: 'box',
    bouteille: 'bottle',
    bottle: 'bottle',
    sac: 'bag',
    bag: 'bag',
    plateau: 'tray',
    tray: 'tray',
    douzaine: 'dozen',
    dozen: 'dozen',
  }[raw] || raw;
  return `unit.${normalized}`;
}

export function translateUnit(t, unit) {
  return t(unitKey(unit));
}

export function rtlAwareIcon(icon, dir) {
  if (!icon || dir !== 'rtl') return icon;
  const map = {
    '←': '→',
    '→': '←',
    '‹': '›',
    '›': '‹',
    'chevron-left': 'chevron-right',
    'chevron-right': 'chevron-left',
    'arrow-left': 'arrow-right',
    'arrow-right': 'arrow-left',
  };
  return map[icon] || icon;
}


export function fulfillmentKey(type) {
  const value = String(type || 'pickup').trim().toLowerCase();
  return `fulfillment.type.${value || 'pickup'}`;
}

export function translateFulfillmentType(t, type) {
  return t(fulfillmentKey(type));
}

export function orderActionKey(action) {
  const value = String(action || '').trim().toLowerCase();
  return `orders.actions.${value || 'unknown'}`;
}

export function translateOrderActionLabel(t, action) {
  return t(orderActionKey(action));
}

export function translateBusinessType(t, type, fallback = '') {
  const key = `marketplace.type.${String(type || 'autre').trim().toLowerCase()}`;
  const translated = t(key);
  return translated || fallback || String(type || '');
}
