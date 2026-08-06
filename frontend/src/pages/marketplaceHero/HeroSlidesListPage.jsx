import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Reorder } from 'framer-motion';
import { useApi } from '../../hooks/useApi';
import { ASSET } from '../../api';
import { Toast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeroManagerLayout } from './HeroManagerLayout';
import { DashboardIcon } from '../../shared/components/ui/DashboardIcon';
import { PremiumIcon } from '../../shared/components/ui/PremiumIcon';

const TYPE_LABELS = {
  seasonal_campaign: 'Campagne saisonnière', promotion: 'Promotion', category: 'Catégorie',
  business: 'Commerce', brand: 'Marque', product: 'Produit', new_arrival: 'Nouveauté',
  announcement: 'Annonce', event: 'Événement', custom_offer: 'Offre personnalisée',
};
const STATUS_META = {
  draft: { label: 'Brouillon', color: '#6B7280', bg: '#F3F4F6' },
  active: { label: 'Actif', color: '#16A34A', bg: '#F0FDF4' },
  paused: { label: 'En pause', color: '#D97706', bg: '#FFFBEB' },
  archived: { label: 'Archivé', color: '#9CA3AF', bg: '#F9FAFB' },
};

function SlideCard({ slide, onEdit, onDuplicate, onDelete, onToggle, onPreview, onStats, reorderMode }) {
  const st = STATUS_META[slide.status] || STATUS_META.draft;
  return (
    <div className="if-card" style={{ padding: 14, display: 'flex', gap: 14, alignItems: 'center', cursor: reorderMode ? 'grab' : 'default' }}>
      <div style={{ width: 96, height: 54, borderRadius: 8, background: '#F3F4F6', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {slide.image_desktop ? <img src={ASSET(slide.image_desktop)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <DashboardIcon icon="image" size={22} style={{ opacity: .45 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{slide.title}</strong>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
          {slide.is_active_now && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#16A34A', background: '#F0FDF4' }}>Actif maintenant</span>}
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{TYPE_LABELS[slide.slide_type]}</span>
        </div>
        {slide.subtitle && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{slide.subtitle}</div>}
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>Ordre : {slide.position}</span>
          {(slide.start_date || slide.end_date) && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PremiumIcon name="calendar" size={12} /> {slide.start_date || '…'} → {slide.end_date || '…'}</span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PremiumIcon name="eye" size={12} /> {slide.impressions} · <PremiumIcon name="target" size={12} /> {slide.clicks} · CTR {(slide.ctr * 100).toFixed(1)}%</span>
        </div>
      </div>
      {!reorderMode && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onPreview(slide)}><PremiumIcon name="eye" size={14} /> Aperçu</button>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onStats(slide)}><PremiumIcon name="chart" size={14} /> Stats</button>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onEdit(slide)}><PremiumIcon name="edit" size={14} /> Modifier</button>
          <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onDuplicate(slide)}><PremiumIcon name="copy" size={14} /> Dupliquer</button>
          {['active', 'paused'].includes(slide.status) && (
            <button className="if-btn if-btn-outline if-btn-sm" onClick={() => onToggle(slide)}>
              <><PremiumIcon name={slide.status === 'active' ? 'pause' : 'play'} size={14} /> {slide.status === 'active' ? 'Désactiver' : 'Activer'}</>
            </button>
          )}
          <button className="if-btn if-btn-outline if-btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => onDelete(slide)}><PremiumIcon name="trash" size={14} /> Supprimer</button>
        </div>
      )}
    </div>
  );
}

export default function HeroSlidesListPage() {
  const { get, post, patch, del } = useApi();
  const navigate = useNavigate();
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(''); const [kind, setKind] = useState('success');
  const [reorderMode, setReorderMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [previewSlide, setPreviewSlide] = useState(null);

  function load() {
    setLoading(true);
    get('/superadmin/hero/slides').then(d => { setSlides(d.slides || []); setLoading(false); }).catch(e => { setMsg(e.message); setKind('error'); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function handleDuplicate(slide) {
    try {
      await post(`/superadmin/hero/slides/${slide.id}/duplicate`, {});
      setMsg('Slide dupliqué en brouillon.'); setKind('success');
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function handleToggle(slide) {
    try {
      await patch(`/superadmin/hero/slides/${slide.id}/toggle-active`, {});
      load();
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    try {
      await del(`/superadmin/hero/slides/${id}`);
      setMsg('Slide supprimé.'); setKind('success');
      setSlides(prev => prev.filter(s => s.id !== id));
    } catch (e) { setMsg(e.message); setKind('error'); }
  }

  async function handleReorder(newOrder) {
    setSlides(newOrder);
    try { await post('/superadmin/hero/slides/reorder', { order: newOrder.map(s => s.id) }); }
    catch (e) { setMsg(e.message); setKind('error'); }
  }

  return (
    <HeroManagerLayout
      title="Hero Manager" icon="image"
      actions={
        <>
          {slides.length > 1 && (
            <button className={`if-btn if-btn-sm ${reorderMode ? 'if-btn-primary' : 'if-btn-outline'}`} onClick={() => setReorderMode(m => !m)}>
              {reorderMode ? 'Terminer le tri' : 'Réorganiser'}
            </button>
          )}
          <button className="if-btn if-btn-primary if-btn-sm" onClick={() => navigate('/marketplace-hero/slides/new')}><PremiumIcon name="plus" size={14} /> Nouveau slide</button>
        </>
      }
    >
      {reorderMode && (
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>
          Glissez les cartes pour changer l'ordre d'affichage dans le carousel public, puis appuyez sur « Terminer le tri ».
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : slides.length === 0 ? (
        <EmptyState icon="image" title="Aucun slide configuré" subtitle="Créez votre premier slide pour animer le Hero de la marketplace." />
      ) : reorderMode ? (
        <Reorder.Group axis="y" values={slides} onReorder={handleReorder} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slides.map(slide => (
            <Reorder.Item key={slide.id} value={slide} style={{ listStyle: 'none' }}>
              <SlideCard slide={slide} reorderMode onEdit={() => {}} onDuplicate={() => {}} onDelete={() => {}} onToggle={() => {}} onPreview={() => {}} onStats={() => {}} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {slides.map(slide => (
            <SlideCard
              key={slide.id} slide={slide}
              onEdit={s => navigate(`/marketplace-hero/slides/${s.id}/edit`)}
              onDuplicate={handleDuplicate}
              onDelete={setPendingDelete}
              onToggle={handleToggle}
              onPreview={setPreviewSlide}
              onStats={s => navigate(`/marketplace-hero/slides/${s.id}/stats`)}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!pendingDelete}
        title="Supprimer ce slide ?"
        message={`« ${pendingDelete?.title} » sera définitivement supprimé, avec ses statistiques.`}
        confirmLabel="Supprimer" confirmClass="btn-danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />

      {previewSlide && (
        <div onClick={() => setPreviewSlide(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', position: 'relative', background: '#111' }}>
            {previewSlide.image_desktop && <img src={ASSET(previewSlide.image_desktop)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: previewSlide.gradient || 'linear-gradient(135deg, rgba(255,138,0,.85), rgba(230,114,0,.5))', opacity: .45 }} />
            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 40px', gap: 10 }}>
              {previewSlide.badge && <span style={{ display: 'inline-block', width: 'fit-content', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.22)', color: '#fff' }}>{previewSlide.badge}</span>}
              <h2 style={{ margin: 0, color: previewSlide.text_color || '#fff', fontSize: 32, fontWeight: 800, maxWidth: 420 }}>{previewSlide.title}</h2>
              {previewSlide.subtitle && <p style={{ margin: 0, color: 'rgba(255,255,255,.85)', maxWidth: 380 }}>{previewSlide.subtitle}</p>}
              {previewSlide.cta_text && <button style={{ marginTop: 8, width: 'fit-content', padding: '10px 22px', borderRadius: 12, border: 'none', fontWeight: 800, color: '#fff', background: previewSlide.button_color || '#FF8A00' }}>{previewSlide.cta_text}</button>}
            </div>
          </div>
        </div>
      )}

      <Toast msg={msg} kind={kind} onClose={() => setMsg('')} />
    </HeroManagerLayout>
  );
}
