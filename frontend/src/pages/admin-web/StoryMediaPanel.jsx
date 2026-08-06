import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, GripVertical, Play, Plus, Star, Trash2 } from 'lucide-react';
import { useApi } from '../../shared/hooks/useApi';
import './story-media-panel.css';

export default function StoryMediaPanel({ story }) {
  const { get, post, put, del } = useApi();
  const [items, setItems] = useState([]);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);

  const load = useCallback(async () => {
    const data = await get(`/media?module=${story.portal}&entity_type=${story.content_type}&entity_id=${story.id}&limit=100`);
    const media = (data.items || []).map(asset => {
      const link = (asset.links || []).find(candidate => Number(candidate.entity_id) === Number(story.id));
      return { ...asset, ...(link || {}), id: asset.id, link_id: link?.id };
    });
    setItems(media.sort((first, second) => (first.sort_order || 0) - (second.sort_order || 0)));
  }, [get, story.content_type, story.id, story.portal]);

  useEffect(() => {
    load().catch(error => setMessage(error.message));
  }, [load]);

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await post('/media', {
        module: story.portal,
        entity_type: story.content_type,
        entity_id: story.id,
        media_type: 'youtube',
        provider: 'youtube',
        url,
        language: 'en',
        sort_order: items.length,
      });
      setUrl('');
      setMessage('Vidéo ajoutée avec succès.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateLink(item, values) {
    if (!item.link_id) return setMessage('Lien média introuvable. Rechargez la page.');
    try {
      await put(`/media/${item.id}/links/${item.link_id}`, values);
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function remove(item) {
    if (!item.link_id || !window.confirm(`Retirer « ${item.title} » de cet article ?`)) return;
    try {
      await del(`/media/${item.id}/links/${item.link_id}`);
      setMessage('Vidéo retirée de cet article.');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function drop(target) {
    if (!draggedItem || draggedItem.id === target.id) return;
    const next = [...items];
    const from = next.findIndex(item => item.id === draggedItem.id);
    const to = next.findIndex(item => item.id === target.id);
    next.splice(to, 0, next.splice(from, 1)[0]);
    setItems(next);
    setDraggedItem(null);
    try {
      await put('/media/bulk/order', {
        items: next.map((item, index) => ({ id: item.id, link_id: item.link_id, sort_order: index })),
      });
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="card portal-admin-panel story-media-panel">
      <header className="story-media-panel-head">
        <div>
          <span className="story-media-eyebrow">Médias de l’article</span>
          <h2>Vidéos</h2>
          <p>Ajoutez des vidéos YouTube sans enregistrer leurs URL dans les métadonnées.</p>
        </div>
        {!!items.length && <span className="story-media-count">{items.length} vidéo{items.length > 1 ? 's' : ''}</span>}
      </header>

      <form onSubmit={add} className="story-media-add">
        <label className="form-label">
          URL YouTube
          <input className="form-control" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://youtu.be/xxxxx" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Plus size={17}/>{busy ? 'Récupération…' : 'Ajouter la vidéo'}
        </button>
      </form>

      {message && <div className="alert alert-info" role="status">{message}</div>}

      <div className="story-media-admin-list">
        {items.map(item => (
          <article key={item.id} draggable onDragStart={() => setDraggedItem(item)} onDragEnd={() => setDraggedItem(null)} onDragOver={event => event.preventDefault()} onDrop={() => drop(item)}>
            <span className="story-media-drag" title="Glisser pour réordonner" aria-hidden="true"><GripVertical size={20}/></span>
            <img src={item.thumbnail} alt="" loading="lazy" />
            <div className="story-media-item-copy">
              <strong>{item.title}</strong>
              <small>{item.duration || 'Durée indisponible'}</small>
            </div>
            <div className="story-media-actions">
              <button type="button" className="btn btn-secondary" onClick={() => updateLink(item, { visible: !item.visible })} aria-label={item.visible ? 'Masquer la vidéo' : 'Afficher la vidéo'} title={item.visible ? 'Masquer' : 'Afficher'}>{item.visible ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
              <button type="button" className={`btn ${item.featured ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateLink(item, { featured: !item.featured })} aria-label={item.featured ? 'Retirer des favoris' : 'Mettre en favori'} title="Vidéo vedette"><Star size={18}/></button>
              <a className="btn btn-secondary" href={item.url} target="_blank" rel="noreferrer" aria-label="Prévisualiser la vidéo" title="Prévisualiser"><Play size={18}/></a>
              <button type="button" className="btn btn-danger" onClick={() => remove(item)} aria-label="Retirer la vidéo" title="Retirer"><Trash2 size={18}/></button>
            </div>
          </article>
        ))}
      </div>

      {!items.length && <div className="portal-empty"><strong>Aucune vidéo</strong><p>Ajoutez une URL YouTube pour créer la galerie média de cet article.</p></div>}
    </section>
  );
}
