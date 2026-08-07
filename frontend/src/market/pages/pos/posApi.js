import { useMemo } from 'react';
import { useApi } from '../../../shared/hooks/useApi';

/**
 * Wrapper léger autour de useApi() pour le module POS.
 * Garde les composants d'écran (PosPage, PosSessionPage, PosHistoryPage)
 * concentrés sur l'UI plutôt que sur la construction des requêtes.
 *
 * Mémoïsé avec useMemo : get/post (useApi) sont déjà stables via useCallback,
 * mais l'objet retourné ici était reconstruit à chaque rendu, ce qui cassait
 * la stabilité référentielle de `api` pour tout composant appelant qui le met
 * dans un tableau de dépendances (ex: PosSessionPage's `load` useCallback)
 * — provoquant une boucle infinie de re-render → nouvel `api` → nouveau
 * `load` → useEffect refire → nouvel appel réseau → ... jusqu'au 429 du
 * rate-limiter.
 */
export function usePosApi() {
  const { get, post } = useApi();

  return useMemo(() => ({
    getBusinessInfo:   () => get('/pos/business'),
    getCatalog:        (q) => get(`/pos/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    searchCustomers:   (q) => get(`/pos/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    getCurrentSession: () => get('/pos/session/current'),
    openSession:       (opening_amount) => post('/pos/session/open', { opening_amount }),
    closeSession:      (counted_cash, notes) => post('/pos/session/close', { counted_cash, notes }),
    createSale:        (payload) => post('/pos/sale', payload),
    scanBarcode:       (barcode) => post('/pos/scan', { barcode }),
    lookupCard:        (card_code) => post('/pos/card/lookup', { card_code }),
    listSales:         (params = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
      );
      return get(`/pos/sales${qs.toString() ? `?${qs}` : ''}`);
    },
    getSale:      (id) => get(`/pos/sales/${id}`),
    refundSale:   (id, reason) => post(`/pos/sales/${id}/refund`, { reason }),
    dailyReport:  (date) => get(`/pos/report/daily${date ? `?date=${date}` : ''}`),
  }), [get, post]);
}

/**
 * Construit le payload normalisé d'un ticket imprimable à partir d'une vente.
 * Point d'extension unique : un futur rendu ESC/POS ou pont Android
 * consommera cette même structure sans toucher au composant HTML.
 */
export function buildTicketPayload({ sale, items, business, cashierName, ticketWidth }) {
  return {
    business_name: business?.name || '—',
    logo_url: business?.logo || business?.logo_url || null,
    address: business?.address || null,
    phone: business?.phone || null,
    ticket_number: sale?.ticket_number || sale?.order_number || sale?.pickup_code,
    date: sale?.createdAt || sale?.created_at || new Date().toISOString(),
    cashier_name: cashierName || '—',
    items: (items || []).map(i => ({
      name: i.name || i.product_name || i.menu_item?.libelle,
      quantity: i.quantity,
      unit_price: Number(i.unit_price ?? i.product_price ?? 0),
      line_total: Number(i.line_total ?? (i.quantity * (i.unit_price ?? i.product_price ?? 0))),
    })),
    total_amount: Number(sale?.total_amount ?? sale?.total ?? 0),
    payment_method: sale?.payment_method,
    width: ticketWidth || '80mm',
  };
}
