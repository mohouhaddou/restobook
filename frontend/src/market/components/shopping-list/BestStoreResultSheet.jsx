import React from 'react';
import { Portal } from '../../../shared/components/ui/Portal';
import { useMkTheme } from '../../../shared/hooks/useMkTheme';
import { PremiumIcon } from '../../../shared/components/ui/PremiumIcon';

/**
 * "Trouver les meilleurs commerces" — recommande UN SEUL commerce (décision
 * verrouillée, pas de découpage/checkout multi-vendeur réel). Les économies
 * potentielles sont un texte informatif seul, jamais un flux d'action.
 */
export function BestStoreResultSheet({ result, onClose, onOrder }) {
  const [theme] = useMkTheme();
  if (!result) return null;
  const { recommended, missing_items = [], excluded_pharmacy_items = [], potential_savings_if_split = 0 } = result;

  return (
    <Portal>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 900, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className={`mk-wrap mk-${theme}`} style={{
        background: 'var(--mk-surface)', width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
        borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', animation: 'mk-fadeUp .25s',
      }}>
        <div style={{ width: 40, height: 4, background: 'var(--mk-border)', borderRadius: 4, margin: '0 auto 16px' }} />
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--mk-text)', display:'flex', alignItems:'center', gap:8 }}><PremiumIcon name="store" size={18} />Meilleur commerce</h3>

        {!recommended ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--mk-muted)', fontSize: 13 }}>
            Aucun commerce ne couvre les articles de cette liste pour le moment.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--mk-muted)', marginBottom: 16 }}>
              {recommended.coverage_count} / {recommended.total_items} articles disponibles chez ce commerce
            </div>

            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--mk-border)', background: 'var(--mk-card)', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--mk-text)' }}>{recommended.business_name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', display: 'flex', gap: 10, marginTop: 4 }}>
                {recommended.distance_km != null && <span className="premium-inline-icon"><PremiumIcon name="mapPin" size={13} />{recommended.distance_km} km</span>}
                {recommended.eta_range && <span className="premium-inline-icon"><PremiumIcon name="clock" size={13} />{recommended.eta_range}</span>}
                {recommended.delivery_fee != null && <span className="premium-inline-icon"><PremiumIcon name="truck" size={13} />{Number(recommended.delivery_fee).toFixed(2)} MAD</span>}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--mk-orange)', marginTop: 8 }}>
                {Number(recommended.total_price).toFixed(2)} MAD
              </div>
            </div>

            {potential_savings_if_split > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginBottom: 14, padding: '8px 10px', background: 'var(--mk-bg)', borderRadius: 10 }}>
                Vous pourriez économiser jusqu'à {potential_savings_if_split.toFixed(2)} MAD en répartissant vos achats entre plusieurs commerces (non proposé automatiquement).
              </div>
            )}

            {missing_items.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginBottom: 10 }}>
                Non trouvés chez ce commerce : {missing_items.map(i => i.name).join(', ')}
              </div>
            )}

            {excluded_pharmacy_items.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--mk-muted)', marginBottom: 14 }}>
                {excluded_pharmacy_items.length} article{excluded_pharmacy_items.length > 1 ? 's' : ''} pharmacie non inclus{excluded_pharmacy_items.length > 1 ? 's' : ''} dans la commande automatique — à traiter séparément.
              </div>
            )}

            <button onClick={() => onOrder(recommended)} style={{
              width: '100%', padding: 13, borderRadius: 12, border: 'none', background: 'var(--mk-orange)',
              color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
            }}>
              Commander chez {recommended.business_name}
            </button>
          </>
        )}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid var(--mk-border)',
          background: 'transparent', color: 'var(--mk-text2)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>Fermer</button>
      </div>
    </div>
    </Portal>
  );
}
