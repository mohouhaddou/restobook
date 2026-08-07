import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ASSET } from '../../../api';
import { useAuth } from '../../../contexts/AuthContext';
import { Toast } from '../../../shared/components/ui/Toast';
import { BarcodeCameraScanner } from '../../../shared/components/ui/BarcodeCameraScanner';
import { playBeep } from '../../../shared/utils/beep';
import { PERMISSIONS } from '../../../shared/modules/core/permissions';
import { usePosApi, buildTicketPayload } from './posApi';
import { PosReceipt } from './PosReceipt';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Espèces', icon: 'wallet' },
  { value: 'CARD', label: 'Carte', icon: 'card' },
  { value: 'CREDIT', label: 'Crédit', icon: 'book' },
];

const ERROR_MESSAGES = {
  NO_OPEN_SESSION: "Aucune session de caisse ouverte — ouvrez la caisse avant de vendre.",
  INSUFFICIENT_STOCK: 'Stock insuffisant pour un des articles du panier.',
  CUSTOMER_REQUIRED_FOR_CREDIT: 'Sélectionnez un client pour une vente à crédit.',
  CUSTOMER_NOT_FOUND: 'Client introuvable.',
  EMPTY_CART: 'Le panier est vide.',
  INVALID_CARD_CODE: 'Code carte invalide.',
  CARD_CUSTOMER_NOT_FOUND: 'Client carte introuvable.',
  CARD_REQUIRED_FOR_CASHBACK: 'Scannez la carte du client avant d\'utiliser du cashback.',
  INSUFFICIENT_CASHBACK: 'Ce client n\'a pas de cashback disponible.',
};

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function ProductThumb({ imageUrl, size = 64 }) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--il-radius-sm)', overflow: 'hidden', flexShrink: 0,
      background: showImage ? 'transparent' : 'var(--il-primary-lighter)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: showImage || size > 40 ? '0 auto 8px' : 0,
    }}>
      {showImage
        ? <img src={ASSET(imageUrl)} alt="" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <PremiumIcon name="utensils" size={Math.max(22, size / 2.3)} />}
    </div>
  );
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, kind = 'success') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4500); };
  return { toast, show };
}

export default function PosPage() {
  const { user, hasPermission } = useAuth();
  const api = usePosApi();
  const { toast, show } = useToast();
  const isMobile = useIsMobile();

  const [session, setSession] = useState(undefined);
  const [business, setBusiness] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState([]); // [{ id, name, price, unit, image_url, quantity, discount_percent, track_stock, stock_quantity }]
  const [customer, setCustomer] = useState(null);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [discountAmount, setDiscountAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastTicket, setLastTicket] = useState(null);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // La pharmacie a sa propre caisse (gestion des lots/péremption FEFO,
  // voir Dashboard Pharmacie > Vente) — le backend rejette explicitement
  // ce module générique pour elle (PHARMACY_NOT_SUPPORTED). Sans ce state,
  // l'erreur était avalée silencieusement et la page semblait juste "vide".
  const [pharmacyRedirect, setPharmacyRedirect] = useState(false);

  // Carte iFilino (client marketplace) — identification + cashback en caisse,
  // distincte du client crédit hanout (customer/custQuery ci-dessus).
  const [cardUser, setCardUser] = useState(null);
  const [cardCode, setCardCode] = useState('');
  const [cardCameraOpen, setCardCameraOpen] = useState(false);
  const [cardLookupLoading, setCardLookupLoading] = useState(false);
  const [cashbackUsed, setCashbackUsed] = useState('');

  const custDebRef = useRef(null);

  useEffect(() => {
    api.getCurrentSession().then(d => setSession(d.session || null)).catch(() => setSession(null));
    api.getBusinessInfo().then(d => setBusiness(d.business)).catch(err => {
      if (err.message === 'PHARMACY_NOT_SUPPORTED') setPharmacyRedirect(true);
    });
    api.getCatalog().then(d => { setProducts(d.products || []); setCategories(d.categories || []); }).catch(err => {
      if (err.message === 'PHARMACY_NOT_SUPPORTED') setPharmacyRedirect(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pharmacyRedirect) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center' }}>
        <div style={{ color: '#0EA5E9' }}><PremiumIcon name="medicine" size={48} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Cette caisse n'est pas celle de la pharmacie</div>
        <p style={{ fontSize: 14, color: '#64748B', maxWidth: 420, margin: 0 }}>
          La pharmacie a sa propre caisse (gestion des lots et des dates de péremption) — utilisez l'onglet
          « Vente (POS) » du Dashboard Pharmacie plutôt que cette page.
        </p>
        <Link to="/pharmacy-dashboard?tab=pos" style={{ padding: '12px 24px', background: '#0EA5E9', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
          Aller à la caisse pharmacie
        </Link>
      </div>
    );
  }

  function searchCustomer(text) {
    setCustQuery(text);
    clearTimeout(custDebRef.current);
    custDebRef.current = setTimeout(async () => {
      if (!text.trim()) { setCustResults([]); return; }
      try { const d = await api.searchCustomers(text); setCustResults(d.customers || []); } catch { /* ignore */ }
    }, 200);
  }

  function addToCart(p) {
    setCart(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, unit: p.unit, image_url: p.image_url, track_stock: p.track_stock, stock_quantity: p.stock_quantity, quantity: 1, discount_percent: 0 }];
    });
  }
  function updateQty(id, qty) {
    setCart(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }
  function removeItem(id) { setCart(prev => prev.filter(i => i.id !== id)); }

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory !== 'all') list = list.filter(p => (p.category_id || 0) === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase() === q) || (p.barcode && p.barcode === search.trim()));
    }
    return list;
  }, [products, activeCategory, search]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity * (1 - i.discount_percent / 100), 0);
  const cashbackUsedNum = cardUser ? Math.min(Number(cashbackUsed || 0), cardUser.cashback_balance) : 0;
  const total = Math.max(0, subtotal - Number(discountAmount || 0) - cashbackUsedNum);

  function resetSale() {
    setCart([]); setCustomer(null); setCustQuery(''); setPaymentMethod('CASH'); setDiscountAmount(''); setShowCartMobile(false);
    setCardUser(null); setCardCode(''); setCashbackUsed('');
  }

  async function lookupCard(code) {
    if (!code?.trim()) return;
    setCardLookupLoading(true);
    try {
      const card = await api.lookupCard(code.trim());
      setCardUser(card);
      setCashbackUsed('');
      show(`Carte reconnue — ${card.user.nom}`);
    } catch (err) {
      show(ERROR_MESSAGES[err.message] || err.message, 'error');
    }
    setCardLookupLoading(false);
  }

  // Recherche un produit par code-barres et l'ajoute au panier (ou incrémente
  // sa quantité) — appelée par la douchette USB/Bluetooth (Enter clavier) ET
  // par le scan caméra (BarcodeCameraScanner), même logique dans les deux cas.
  async function scanCode(code) {
    if (!code) return;
    setNotFoundCode(null);
    setScanning(true);
    try {
      const { product } = await api.scanBarcode(code);
      const existing = cart.find(i => i.id === product.id);
      const nextQty = (existing?.quantity || 0) + 1;
      if (product.track_stock && product.stock_quantity !== null && nextQty > product.stock_quantity) {
        show(`Stock insuffisant pour "${product.name}" (disponible : ${product.stock_quantity})`, 'error');
      } else {
        addToCart(product);
        show(`${product.name} ajouté au panier`);
      }
      setSearch('');
    } catch (err) {
      if (err.message === 'NOT_FOUND') {
        setNotFoundCode(code);
        show(`Produit introuvable pour le code ${code}`, 'error');
      } else {
        show(err.message, 'error');
      }
    }
    setScanning(false);
  }

  // Douchette USB/Bluetooth : tape le code puis envoie Enter, exactement comme une saisie clavier.
  function handleScan(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    scanCode(search.trim());
  }

  async function submitSale() {
    if (cart.length === 0) { show('Panier vide', 'error'); return; }
    if (paymentMethod === 'CREDIT' && !customer) { show(ERROR_MESSAGES.CUSTOMER_REQUIRED_FOR_CREDIT, 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        items: cart.map(i => ({ catalog_item_id: i.id, quantity: i.quantity, discount_percent: i.discount_percent })),
        payment_method: paymentMethod,
        customer_id: customer?.id || undefined,
        discount_amount: Number(discountAmount || 0),
        customer_user_id: cardUser?.user?.id || undefined,
        cashback_used: cashbackUsedNum > 0 ? cashbackUsedNum : undefined,
      };
      const sale = await api.createSale(payload);
      const cashbackNote = sale.cashback_used > 0 ? ` — cashback utilisé : ${fmt(sale.cashback_used)} MAD` : '';
      const pointsNote = sale.points_earned > 0 ? ` — +${sale.points_earned} pts` : '';
      show(`Vente #${sale.ticket_number} enregistrée — ${fmt(sale.total_amount)} MAD${cashbackNote}${pointsNote}`);
      setLastTicket(buildTicketPayload({
        sale, items: sale.items, business, cashierName: user?.nom,
      }));
      resetSale();
      api.getCurrentSession().then(d => setSession(d.session || null)).catch(() => {});
    } catch (e) {
      show(ERROR_MESSAGES[e.message] || e.message, 'error');
    }
    setSaving(false);
  }

  const cartPanel = (
    <div className="if-card" style={{ padding: 18, position: isMobile ? 'static' : 'sticky', top: 80 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="cart" size={17} /> Panier</h3>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--il-muted)', fontSize: 13 }}>Panier vide</div>
      ) : (
        <div style={{ maxHeight: isMobile ? 'none' : 340, overflowY: 'auto', marginBottom: 12 }}>
          {cart.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--il-border)' }}>
              <ProductThumb imageUrl={i.image_url} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{fmt(i.price)} MAD/u</div>
              </div>
              <button onClick={() => updateQty(i.id, i.quantity - 1)} style={{ width: 26, height: 26, border: '1px solid var(--il-border)', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>−</button>
              <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>{i.quantity}</span>
              <button onClick={() => updateQty(i.id, i.quantity + 1)} style={{ width: 26, height: 26, border: '1px solid var(--il-border)', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>+</button>
              <span style={{ fontSize: 13, fontWeight: 800, minWidth: 65, textAlign: 'right' }}>{fmt(i.price * i.quantity)}</span>
              <button onClick={() => removeItem(i.id)} aria-label="Retirer" style={{ background: 'none', border: 'none', color: 'var(--il-muted)', cursor: 'pointer', width: 30, height: 30, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Client (optionnel, requis si crédit)</label>
        {customer ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--il-primary-lighter)', borderRadius: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{customer.name}</span>
            <button onClick={() => { setCustomer(null); setCustQuery(''); }} aria-label="Retirer le client" style={{ background: 'none', border: 'none', color: 'var(--il-primary-dark)', cursor: 'pointer', width: 30, height: 30, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={15} /></button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input value={custQuery} onChange={e => searchCustomer(e.target.value)} placeholder="Nom ou téléphone…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 13 }} />
            {custResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1.5px solid var(--il-border)', borderRadius: 10, boxShadow: 'var(--il-shadow-md)', maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                {custResults.map(c => (
                  <button key={c.id} onClick={() => { setCustomer(c); setCustResults([]); }} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '9px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--il-border)' }}>
                    {c.name} — {c.phone}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Carte iFilino (optionnel)</label>
        {cardUser ? (
          <div style={{ padding: '10px 12px', background: 'var(--il-primary-lighter)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{cardUser.tier.icon} {cardUser.user.nom}</span>
              <button onClick={() => { setCardUser(null); setCashbackUsed(''); }} aria-label="Retirer la carte" style={{ background: 'none', border: 'none', color: 'var(--il-primary-dark)', cursor: 'pointer', width: 30, height: 30, display: 'grid', placeItems: 'center' }}><PremiumIcon name="close" size={15} /></button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--il-muted)', marginTop: 2 }}>
              Niveau {cardUser.tier.name} · {cardUser.loyalty_points} pts · {fmt(cardUser.cashback_balance)} MAD cashback
            </div>
            {cardUser.cashback_balance > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Utiliser le cashback (MAD)</label>
                <input
                  type="number" min="0" step="0.01" max={cardUser.cashback_balance}
                  value={cashbackUsed} onChange={e => setCashbackUsed(e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--il-border)', fontSize: 12 }}
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={cardCode} onChange={e => setCardCode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') lookupCard(cardCode); }}
                placeholder="IFILINO-… ou scanner"
                disabled={cardLookupLoading}
                style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 12 }}
              />
              <button type="button" onClick={() => setCardCameraOpen(true)} title="Scanner la carte par caméra"
                style={{ padding: '0 12px', border: '1.5px solid var(--il-border)', borderRadius: 'var(--il-radius-sm)', background: '#fff', cursor: 'pointer' }}>
                <PremiumIcon name="scan" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mode de paiement</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.value} onClick={() => setPaymentMethod(m.value)}
              style={{ padding: '9px 6px', border: `1.5px solid ${paymentMethod === m.value ? 'var(--il-primary)' : 'var(--il-border)'}`, borderRadius: 10, background: paymentMethod === m.value ? 'var(--il-primary-lighter)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}><PremiumIcon name={m.icon} size={14} /> {m.label}</span>
            </button>
          ))}
        </div>
        {paymentMethod === 'CREDIT' && !customer && <div style={{ fontSize: 11, color: 'var(--il-danger)', marginTop: 6 }}>Un client est requis pour une vente à crédit.</div>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Remise globale (MAD)</label>
        <input type="number" min="0" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)}
          placeholder="0.00" style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 13 }} />
      </div>

      <div style={{ borderTop: '1px solid var(--il-border)', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 20 }}>
          <span>Total</span><span style={{ color: 'var(--il-primary)' }}>{fmt(total)} MAD</span>
        </div>
      </div>

      <button onClick={submitSale} disabled={saving || cart.length === 0} className="if-btn if-btn-primary if-btn-lg" style={{ width: '100%' }}>
        {saving ? 'Validation…' : 'Valider la vente'}
      </button>
    </div>
  );

  return (
    <div style={{ padding: '20px 16px', paddingBottom: isMobile ? 90 : 20 }}>
      <Toast msg={toast?.msg} kind={toast?.kind} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 10 }}><PremiumIcon name="receipt" size={24} /> Vente rapide</h2>
        {session === null && (
          <Link to="/pos/session" className="if-btn if-btn-outline if-btn-sm"><PremiumIcon name="alert" size={14} /> Ouvrir la caisse</Link>
        )}
      </div>

      <div style={{ display: 'inline-flex', border: '1.5px solid var(--il-border)', borderRadius: 'var(--il-radius-sm)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ padding: '4px 10px', background: 'var(--il-primary)', color: '#fff', fontWeight: 700, fontSize: 11 }}>
          Scanner / Recherche
        </div>
        <button type="button" onClick={() => setCameraOpen(true)} title="Scanner par caméra"
          style={{ padding: '4px 10px', border: 'none', background: '#fff', color: 'var(--il-primary)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          Caméra
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setNotFoundCode(null); }}
          onKeyDown={handleScan}
          placeholder="Rechercher un produit ou scanner un code-barres… (Entrée pour valider)"
          disabled={scanning}
          style={{ flex: 1, padding: '13px 16px', borderRadius: 'var(--il-radius-sm)', border: '1.5px solid var(--il-border)', fontSize: 15 }}
        />
      </div>
      {cameraOpen && (
        <BarcodeCameraScanner
          continuous
          onDetected={(code) => scanCode(code)}
          onClose={() => setCameraOpen(false)}
        />
      )}
      {cardCameraOpen && (
        <BarcodeCameraScanner
          includeQr
          title="Scanner la carte client"
          hintText="Présentez le QR code de la carte iFilino du client."
          onDetected={(code) => { setCardCameraOpen(false); lookupCard(code); }}
          onClose={() => setCardCameraOpen(false)}
        />
      )}

      {notFoundCode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--il-danger-light, #FEF2F2)', border: '1px solid var(--il-danger, #EF4444)', borderRadius: 'var(--il-radius-sm)', marginBottom: 14, fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PremiumIcon name="alert" size={16} /> Produit introuvable pour le code <strong>{notFoundCode}</strong>.</span>
          {hasPermission(PERMISSIONS.HANOUT_PRODUCT_MANAGE) && (
            <Link to="/hanout-dashboard?tab=products" className="if-btn if-btn-outline if-btn-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
              + Ajouter ce produit
            </Link>
          )}
        </div>
      )}

      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          <button onClick={() => setActiveCategory('all')} style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${activeCategory === 'all' ? 'var(--il-primary)' : 'var(--il-border)'}`, background: activeCategory === 'all' ? 'var(--il-primary-lighter)' : '#fff', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>Tous</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${activeCategory === c.id ? 'var(--il-primary)' : 'var(--il-border)'}`, background: activeCategory === c.id ? 'var(--il-primary-lighter)' : '#fff', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer' }}>{c.name}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => { playBeep(); addToCart(p); }} className="if-card if-pos-product-btn"
              style={{ padding: '12px 10px 14px', textAlign: 'center', cursor: 'pointer', border: '1.5px solid var(--il-border)', minHeight: 150 }}>
              <ProductThumb imageUrl={p.image_url} size={64} />
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>{p.name}</div>
              <div className="if-pos-product-price" style={{ fontSize: 14, fontWeight: 800 }}>{fmt(p.price)} MAD</div>
              {p.track_stock && <div style={{ fontSize: 10, color: 'var(--il-muted)', marginTop: 4 }}>Stock : {p.stock_quantity}</div>}
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--il-muted)' }}>Aucun produit trouvé.</div>
          )}
        </div>

        {!isMobile && cartPanel}
      </div>

      {isMobile && (
        <>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--il-border)', padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 -4px 16px rgba(0,0,0,.08)', zIndex: 40 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--il-muted)' }}>{cart.reduce((s, i) => s + i.quantity, 0)} article(s)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--il-primary)' }}>{fmt(total)} MAD</div>
            </div>
            <button onClick={() => setShowCartMobile(true)} className="if-btn if-btn-primary" disabled={cart.length === 0}>Voir le panier</button>
          </div>
          {showCartMobile && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowCartMobile(false)}>
              <div style={{ background: '#fff', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 16 }} onClick={e => e.stopPropagation()}>
                {cartPanel}
              </div>
            </div>
          )}
        </>
      )}

      <PosReceipt ticket={lastTicket} />
      {lastTicket && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={() => window.print()} className="if-btn if-btn-outline"><PremiumIcon name="printer" size={16} /> Imprimer le ticket</button>
        </div>
      )}
    </div>
  );
}
