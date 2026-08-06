import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { useAuth } from '../../../contexts/AuthContext';
import { API, ASSET } from '../../../api';

const CATEGORIES = [
  'guide', 'recette', 'promotion', 'conseil', 'actualite',
  'nouveau_commerce', 'nouveau_produit', 'vie_locale', 'portrait',
];

const RUBRIQUES = [
  ['restaurants_food', 'Food & Restaurants'], ['courses_epiceries', 'Courses'],
  ['boucheries', 'Boucheries'], ['boulangeries', 'Boulangeries'], ['patisseries', 'Pâtisseries'],
  ['cafes', 'Cafés'], ['sante_pharmacies', 'Santé'], ['beaute_bien_etre', 'Beauté & Bien-être'],
  ['sport_forme', 'Sport & Forme'], ['famille_enfants', 'Famille'], ['maison_deco', 'Maison'],
  ['sorties_loisirs', 'Sorties & Loisirs'], ['shopping', 'Shopping'], ['evenements', 'Événements'],
  ['villes', 'Guides locaux'], ['maroc', 'Voyage & Découvertes'], ['conseils_astuces', 'Conseils & Astuces'],
  ['promotions', 'Bons plans'],
];

const LANGUAGES = [
  { key: 'ar', label: '🇸🇦 العربية', dir: 'rtl' },
  { key: 'fr', label: '🇫🇷 Français', dir: 'ltr' },
  { key: 'en', label: '🇬🇧 English', dir: 'ltr' },
];
const LANGUAGE_SHORT_LABELS = {
  ar: 'Arabe',
  fr: 'Français',
  en: 'Anglais',
};
const EMPTY_TRANSLATION = { title: '', slug: '', excerpt: '', content_md: '', seo_title: '', seo_description: '', tags: '' };

const DEFAULT_FORM = {
  title: '', excerpt: '', category: 'guide', rubrique: 'conseils_astuces', body: '',
  tags: '', related_products_text: '', related_businesses_text: '', faq_text: '', sources_text: '',
  seo_title: '', seo_description: '', cover_image_url: '', image_prompt: '', image_alt_text: '', image_assets: null, gallery: [],
  recipe_duration: '', recipe_difficulty: 'facile', recipe_ingredients_text: '', recipe_steps_text: '',
};

function AiSpinner() {
  return <span className="if-spinner if-spinner-sm ai-button-spinner" aria-hidden="true" />;
}

function AiButton({ loading, children, loadingLabel, className = 'btn btn-outline-primary', disabled = false, ...props }) {
  return (
    <button {...props} className={`${className} ai-button${loading ? ' ai-button-loading' : ''}`} disabled={loading || disabled}>
      {loading && <AiSpinner />}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}

function IllustrationInsertModal({ illustrations, selectedKey, title, uploading, onUpload, onSelect, onTitleChange, onClose, onInsert }) {
  const selected = illustrations.find(item => (item.key || item.url) === selectedKey);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="illustration-insert-title" style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }} onMouseDown={onClose}>
      <div className="card" style={{ width: 720, maxWidth: '96vw', maxHeight: '88vh', overflow: 'auto', padding: 20 }} onMouseDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h3 id="illustration-insert-title" style={{ margin: 0, fontSize: 18 }}>Insérer une illustration</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--rb-muted, #64748B)', fontSize: 13 }}>L’image sera insérée exactement à la position du curseur dans le Markdown.</p>
          </div>
          <button type="button" className="btn btn-outline-primary btn-xs" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ border: '1px dashed var(--rb-border, #CBD5E1)', borderRadius: 12, padding: 12, marginBottom: 14, background: '#F8FAFC' }}>
          <label className="form-label" htmlFor="illustration-modal-upload" style={{ marginBottom: 6 }}>Uploader une nouvelle illustration</label>
          <input
            id="illustration-modal-upload"
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={e => { onUpload(e.target.files); e.target.value = ''; }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--rb-muted, #64748B)' }}>
            {uploading ? 'Upload en cours...' : 'Les images ajoutées ici seront disponibles immédiatement dans cette modale.'}
          </div>
        </div>

        {illustrations.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 10 }}>
            {illustrations.map((asset, index) => {
              const key = asset.key || asset.url || String(index);
              const active = key === selectedKey;
              return (
                <button key={key} type="button" onClick={() => onSelect(key, asset)} style={{ textAlign: 'left', padding: 0, border: active ? '2px solid #FF8A00' : '1px solid var(--rb-border, #E5E7EB)', borderRadius: 10, background: '#fff', cursor: 'pointer', overflow: 'hidden', boxShadow: active ? '0 0 0 3px rgba(255,138,0,.14)' : 'none' }}>
                  <img src={ASSET(asset.url)} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: '#F8FAFC' }} />
                  <span style={{ display: 'block', padding: '7px 8px', fontSize: 12, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.alt_text || asset.title || asset.source_name || `Illustration ${index + 1}`}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-state__title">Aucune illustration uploadée</div>
            <div className="empty-state__desc">Ajoutez d’abord une illustration dans le panneau Images iFilino Discover.</div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label className="form-label" htmlFor="illustration-insert-title-input">Titre de l’illustration</label>
          <input id="illustration-insert-title-input" className="form-control" value={title} onChange={e => onTitleChange(e.target.value)} placeholder="Ex. Marché local à Rabat" autoFocus />
        </div>

        {selected?.url && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--rb-muted, #64748B)', overflowWrap: 'anywhere' }}>Image sélectionnée : {selected.url}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn btn-outline-primary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={onInsert} disabled={!selected?.url}>Insérer à la position du curseur</button>
        </div>
      </div>
    </div>
  );
}

// "Question ?|Réponse." par ligne <-> [{question, answer}]
function parseFaq(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [question, ...rest] = line.split('|');
    return { question: question.trim(), answer: rest.join('|').trim() };
  }).filter(f => f.question && f.answer);
}
function faqToText(faq) {
  return (faq || []).map(f => `${f.question}|${f.answer}`).join('\n');
}

function parseSources(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [label, ...rest] = line.split('|');
    return { label: label.trim(), url: rest.join('|').trim() };
  }).filter(s => s.label && s.url);
}
function sourcesToText(sources) {
  return (sources || []).map(s => `${s.label}|${s.url}`).join('\n');
}

// "resto:pizza-margherita" par ligne <-> [{module:'resto', slug:'pizza-margherita'}]
function parseRefs(text, keyName) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [key, slug] = line.split(':').map(s => s.trim());
    return { [keyName]: key, slug };
  }).filter(r => r[keyName] && r.slug);
}
function refsToText(refs, keyName) {
  return (refs || []).map(r => `${r[keyName]}:${r.slug}`).join('\n');
}
// "2 tasses|farine" par ligne <-> [{quantity:'2 tasses', name:'farine'}]
function parseIngredients(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [quantity, name] = line.split('|').map(s => s?.trim());
    return name ? { quantity: quantity || '', name } : { quantity: '', name: quantity };
  });
}
function ingredientsToText(ingredients) {
  return (ingredients || []).map(i => i.quantity ? `${i.quantity}|${i.name}` : i.name).join('\n');
}

function imageAlt(asset, index) {
  return String(asset?.alt_text || asset?.title || `Illustration ${index + 1}`)
    .replace(/\s+/g, " ")
    .replace(/[\[\]\n\r]/g, "")
    .trim() || `Illustration ${index + 1}`;
}

function imageSnippet(asset, index, altOverride = null) {
  const alt = altOverride ? String(altOverride).replace(/[\[\]\n\r]/g, '').trim() : imageAlt(asset, index);
  return '![' + (alt || imageAlt(asset, index)) + '](' + asset.url + ')';
}

function imageNameToken(value) {
  return String(value || '')
    .split(/[?#]/)[0]
    .split('/')
    .pop()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function imageNumberToken(value) {
  const match = imageNameToken(value).match(/(?:^|-)0*(\d+)(?:-|$)/);
  return match ? Number(match[1]) : null;
}

function isMarkdownImagePlaceholder(src) {
  const value = String(src || '').trim();
  if (!value) return false;
  if (/^(https?:|data:|blob:|mailto:|#)/i.test(value)) return false;
  if (value.startsWith('/uploads/')) return false;
  if (value.startsWith('/brand/') || value.startsWith('/img/')) return false;
  return /(?:^|\/)[^\/]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(value);
}

function assetMatchScore(asset, src, alt) {
  const placeholder = imageNameToken(src);
  const placeholderNumber = imageNumberToken(src) ?? imageNumberToken(alt);
  const candidates = [asset.source_name, asset.title, asset.key, asset.url].map(imageNameToken).filter(Boolean);
  let score = 0;
  candidates.forEach(candidate => {
    if (candidate === placeholder) score = Math.max(score, 100);
    if (placeholder && (candidate.includes(placeholder) || placeholder.includes(candidate))) score = Math.max(score, 80);
    const candidateNumber = imageNumberToken(candidate);
    if (placeholderNumber != null && candidateNumber === placeholderNumber) score = Math.max(score, 60);
  });
  if (/hero|cover/.test(placeholder) && candidates.some(candidate => /hero|cover/.test(candidate))) score = Math.max(score, 70);
  return score;
}

function pickAssetForPlaceholder(assets, usedIndexes, src, alt) {
  let bestIndex = -1;
  let bestScore = -1;
  assets.forEach((asset, index) => {
    if (usedIndexes.has(index) || !asset?.url) return;
    const score = assetMatchScore(asset, src, alt);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestScore >= 60) return bestIndex;
  return assets.findIndex((asset, index) => !usedIndexes.has(index) && asset?.url);
}

function replaceMarkdownImagePlaceholders(markdown, assets) {
  const usedIndexes = new Set();
  const list = assets || [];
  const text = String(markdown || '');
  const next = text.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (full, alt, src) => {
    if (!isMarkdownImagePlaceholder(src)) return full;
    const assetIndex = pickAssetForPlaceholder(list, usedIndexes, src, alt);
    if (assetIndex < 0) return full;
    const asset = list[assetIndex];
    if (!asset?.url || text.includes('](' + asset.url + ')')) return full;
    usedIndexes.add(assetIndex);
    return imageSnippet(asset, assetIndex, alt);
  });
  return { markdown: next, remainingAssets: list.filter((asset, index) => asset?.url && !usedIndexes.has(index)), used: usedIndexes.size };
}

function insertTextAt(markdown, text, index) {
  const before = markdown.slice(0, index).replace(/[ \t]+$/g, '');
  const after = markdown.slice(index).replace(/^[ \t]+/g, '');
  return (before + (before ? '\n\n' : '') + text + (after ? '\n\n' : '') + after).trim();
}

function findSectionInsertions(markdown) {
  const positions = [];
  const headingRe = /^#{2,3}\s+.+$/gm;
  let match;
  while ((match = headingRe.exec(markdown))) {
    const afterHeading = match.index + match[0].length;
    const nextHeadingMatch = /^#{2,3}\s+.+$/gm;
    nextHeadingMatch.lastIndex = afterHeading;
    const nextHeading = nextHeadingMatch.exec(markdown);
    const sectionEnd = nextHeading ? nextHeading.index : markdown.length;
    const section = markdown.slice(afterHeading, sectionEnd);
    const paragraphEnd = section.search(/\n\s*\n/);
    positions.push(paragraphEnd >= 0 ? afterHeading + paragraphEnd : sectionEnd);
  }
  return positions;
}

function addIllustrationsToMarkdown(markdown, assets, selection = null) {
  const original = String(markdown || '');
  const uniqueAssets = (assets || []).filter(asset => asset?.url && !original.includes('](' + asset.url + ')'));
  const replaced = replaceMarkdownImagePlaceholders(original, uniqueAssets);
  const current = replaced.markdown.trim();
  const snippets = replaced.remainingAssets.map((asset, index) => imageSnippet(asset, replaced.used + index));
  if (!snippets.length) return replaced.used ? replaced.markdown.trim() : (markdown || '');

  const selectionLooksIntentional = !replaced.used && selection
    && Number.isInteger(selection.start)
    && Number.isInteger(selection.end)
    && selection.start >= 0
    && selection.end >= selection.start
    && (selection.start !== selection.end || (selection.start > 0 && selection.start < original.length));

  if (selectionLooksIntentional) {
    const before = original.slice(0, selection.start).replace(/[ \t]+$/g, '');
    const after = original.slice(selection.end).replace(/^[ \t]+/g, '');
    return (before + (before ? '\n\n' : '') + snippets.join('\n\n') + (after ? '\n\n' : '') + after).trim();
  }

  let next = current;
  const positions = findSectionInsertions(next);
  if (!positions.length) return (next + (next ? '\n\n' : '') + snippets.join('\n\n')).trim();

  const planned = snippets.map((snippet, index) => {
    const positionIndex = Math.min(positions.length - 1, Math.floor(((index + 1) * positions.length) / (snippets.length + 1)));
    return { position: positions[positionIndex], snippet };
  }).sort((a, b) => b.position - a.position);

  planned.forEach(item => {
    next = insertTextAt(next, item.snippet, item.position);
  });
  return next;
}

function insertImageAssetToMarkdown(markdown, asset, selection = null, index = 0) {
  const original = String(markdown || '');
  if (!asset?.url || original.includes('](' + asset.url + ')')) return original;
  const replaced = replaceMarkdownImagePlaceholders(original, [asset]);
  if (replaced.used) return replaced.markdown.trim();

  const snippet = imageSnippet(asset, index);
  const hasSelection = selection
    && Number.isInteger(selection.start)
    && Number.isInteger(selection.end)
    && selection.start >= 0
    && selection.end >= selection.start;
  const start = hasSelection ? Math.min(selection.start, original.length) : original.length;
  const end = hasSelection ? Math.min(selection.end, original.length) : original.length;
  const before = original.slice(0, start).replace(/[ \t]+$/g, '');
  const after = original.slice(end).replace(/^[ \t]+/g, '');
  return (before + (before ? '\n\n' : '') + snippet + (after ? '\n\n' : '') + after).trim();
}

function removeIllustrationFromMarkdown(markdown, url) {
  if (!url) return markdown || "";
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(markdown || "")
    .replace(new RegExp(`\\n{0,2}!\\[[^\\]\\n]*\\]\\(${escaped}\\)\\n{0,2}`, "g"), "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export default function ArticleEditorPage() {
  const { id } = useParams();
  const isNew = !id;
  const { get, post, put, patch, del } = useApi();
  const { token } = useAuth();
  const navigate = useNavigate();
  const markdownRef = useRef(null);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [activeLang, setActiveLang] = useState('ar');
  const [translations, setTranslations] = useState(Object.fromEntries(LANGUAGES.map(lang => [lang.key, { ...EMPTY_TRANSLATION }])));
  const [saving, setSaving] = useState(false);
  const [articleStatus, setArticleStatus] = useState('draft');
  const [articleSlug, setArticleSlug] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imageBusy, setImageBusy] = useState('');
  const [translationTargetLang, setTranslationTargetLang] = useState('fr');
  const [translatingLang, setTranslatingLang] = useState('');
  const [illustrationModalOpen, setIllustrationModalOpen] = useState(false);
  const [selectedIllustrationKey, setSelectedIllustrationKey] = useState('');
  const [illustrationInsertTitle, setIllustrationInsertTitle] = useState('');
  const [markdownSelection, setMarkdownSelection] = useState(null);

  function applyArticle(a) {
    setArticleStatus(a.status || 'draft');
    setArticleSlug(a.slug || '');
    const legacyIllustrations = (a.gallery || []).map((url, index) => ({
      key: `gallery-${index + 1}`,
      title: `Illustration ${index + 1}`,
      url,
      alt_text: a.image_alt_text || a.title || 'Illustration iFilino Discover',
    }));
    const imageAssets = a.image_assets || (legacyIllustrations.length ? { illustrations: legacyIllustrations } : null);
    const nextTranslations = Object.fromEntries(LANGUAGES.map(lang => [lang.key, { ...EMPTY_TRANSLATION }]));
    if (Array.isArray(a.translations) && a.translations.length) {
      a.translations.forEach(tr => {
        if (!nextTranslations[tr.language]) return;
        nextTranslations[tr.language] = {
          title: tr.title || '', slug: tr.slug || '', excerpt: tr.excerpt || '', content_md: tr.content_md || '',
          seo_title: tr.seo_title || '', seo_description: tr.seo_description || '', tags: (tr.tags || []).join(', '),
        };
      });
    } else {
      nextTranslations.ar = { title: a.title || '', slug: a.slug || '', excerpt: a.excerpt || '', content_md: a.body || '', seo_title: a.seo_title || '', seo_description: a.seo_description || '', tags: (a.tags || []).join(', ') };
    }
    setTranslations(nextTranslations);
    setActiveLang(nextTranslations.ar.title || nextTranslations.ar.content_md ? 'ar' : nextTranslations.fr.title || nextTranslations.fr.content_md ? 'fr' : 'en');
    setForm({
      title: a.title || '', excerpt: a.excerpt || '', category: a.category || 'guide',
      rubrique: a.rubrique || 'conseils_astuces', body: a.body || '',
      tags: (a.tags || []).join(', '),
      related_products_text: refsToText(a.related_product_refs, 'module'),
      related_businesses_text: refsToText(a.related_business_refs, 'vertical'),
      faq_text: faqToText(a.faq),
      sources_text: sourcesToText(a.sources),
      seo_title: a.seo_title || '', seo_description: a.seo_description || '', cover_image_url: a.cover_image_url || '',
      image_prompt: a.image_prompt || '', image_alt_text: a.image_alt_text || '', image_assets: imageAssets, gallery: a.gallery || [],
      recipe_duration: a.recipe_meta?.duration_minutes || '',
      recipe_difficulty: a.recipe_meta?.difficulty || 'facile',
      recipe_ingredients_text: ingredientsToText(a.recipe_meta?.ingredients),
      recipe_steps_text: (a.recipe_meta?.steps || []).join('\n'),
    });
  }

  useEffect(() => {
    if (isNew) return;
    get(`/superadmin/discover/articles/${id}`).then(({ article: a }) => applyArticle(a)).catch(e => setMsg(e.message));
  }, [id]);

  useEffect(() => {
    if (translationTargetLang !== activeLang) return;
    const nextLang = LANGUAGES.find(lang => lang.key !== activeLang)?.key || 'fr';
    setTranslationTargetLang(nextLang);
  }, [activeLang, translationTargetLang]);

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }
  function setTr(field, value) { setTranslations(prev => ({ ...prev, [activeLang]: { ...(prev[activeLang] || EMPTY_TRANSLATION), [field]: value } })); }
  function hasTranslation(lang) { const tr = translations[lang] || EMPTY_TRANSLATION; return !!(tr.title || tr.content_md || tr.slug || tr.excerpt); }

  function buildIllustrationAsset(url, index, sourceName = '') {
    const key = `upload-${Date.now()}-${index}`;
    return { key, title: `Illustration ${index + 1}`, url, source_name: sourceName, alt_text: '' };
  }

  function syncIllustrations(prev, nextIllustrations) {
    return {
      ...prev,
      image_assets: { ...(prev.image_assets || {}), illustrations: nextIllustrations },
      gallery: nextIllustrations.map(item => item.url).filter(Boolean),
    };
  }

  function updateNamedImageAsset(key, patch) {
    setForm(prev => ({
      ...prev,
      image_assets: {
        ...(prev.image_assets || {}),
        [key]: { ...((prev.image_assets || {})[key] || {}), ...patch },
      },
    }));
  }

  function updateIllustrationAsset(index, patch) {
    setForm(prev => {
      const illustrations = [...(prev.image_assets?.illustrations || [])];
      if (!illustrations[index]) return prev;
      illustrations[index] = { ...illustrations[index], ...patch };
      return syncIllustrations(prev, illustrations);
    });
  }


  async function handleCoverUpload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const res = await fetch(API('/superadmin/discover/articles/upload'), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Échec de l\'upload');
      set('cover_image_url', data.cover_image_url);
    } catch (e) { setMsg(e.message); }
    setUploading(false);
  }

  async function handleIllustrationUpload(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      selected.forEach(file => fd.append("gallery", file));
      const res = await fetch(API("/superadmin/discover/articles/upload"), {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Échec de l'upload");
      const urls = Array.isArray(data.gallery) ? data.gallery : [];
      const currentCount = form.image_assets?.illustrations?.length || 0;
      const additions = urls.map((url, index) => buildIllustrationAsset(url, currentCount + index, selected[index]?.name || ''));
      setForm(prev => {
        const existing = prev.image_assets?.illustrations || [];
        return syncIllustrations(prev, [...existing, ...additions]);
      });
      setMsg(urls.length > 1 ? "Illustrations ajoutées. Choisissez le texte puis cliquez Insérer." : "Illustration ajoutée. Choisissez le texte puis cliquez Insérer.");
    } catch (e) { setMsg(e.message); }
    setUploading(false);
  }

  function handleRemoveLocalIllustration(key) {
    setForm(prev => {
      const illustrations = prev.image_assets?.illustrations || [];
      const removed = illustrations.find(item => item.key === key);
      const next = illustrations.filter(item => item.key !== key);
      if (removed?.url) {
        setTranslations(current => ({
          ...current,
          [activeLang]: {
            ...(current[activeLang] || EMPTY_TRANSLATION),
            content_md: removeIllustrationFromMarkdown(current[activeLang]?.content_md, removed.url),
          },
        }));
      }
      return syncIllustrations(prev, next);
    });
    setPreview("");
  }

  async function handlePreview() {
    try {
      const { html } = await post('/superadmin/discover/preview', { body: translations[activeLang]?.content_md || '' });
      setPreview(html);
    } catch (e) { setMsg(e.message); }
  }

  function buildPayload() {
    const cleanTranslations = {};
    for (const lang of LANGUAGES.map(item => item.key)) {
      const tr = translations[lang] || EMPTY_TRANSLATION;
      if (tr.title || tr.slug || tr.excerpt || tr.content_md || tr.seo_title || tr.seo_description || tr.tags) {
        cleanTranslations[lang] = { ...tr, tags: tr.tags.split(',').map(t => t.trim()).filter(Boolean) };
      }
    }
    const primary = cleanTranslations.ar || cleanTranslations.fr || cleanTranslations.en || {};
    return {
      title: primary.title || form.title,
      excerpt: primary.excerpt || form.excerpt,
      translations: cleanTranslations,
      category: form.category,
      rubrique: form.rubrique,
      body: primary.content_md || form.body,
      cover_image_url: form.cover_image_url || null,
      image_prompt: form.image_prompt || null,
      image_alt_text: form.image_alt_text || null,
      image_assets: form.image_assets || null,
      gallery: (form.image_assets?.illustrations || []).map(item => item.url).filter(Boolean).length ? (form.image_assets?.illustrations || []).map(item => item.url).filter(Boolean) : form.gallery,
      tags: primary.tags || form.tags.split(',').map(t => t.trim()).filter(Boolean),
      related_product_refs: parseRefs(form.related_products_text, 'module'),
      related_business_refs: parseRefs(form.related_businesses_text, 'vertical'),
      faq: parseFaq(form.faq_text),
      sources: parseSources(form.sources_text),
      seo_title: primary.seo_title || form.seo_title || null,
      seo_description: primary.seo_description || form.seo_description || null,
      recipe_meta: form.category === 'recette' ? {
        duration_minutes: form.recipe_duration ? Number(form.recipe_duration) : null,
        difficulty: form.recipe_difficulty,
        ingredients: parseIngredients(form.recipe_ingredients_text),
        steps: form.recipe_steps_text.split('\n').map(s => s.trim()).filter(Boolean),
      } : null,
    };
  }

  async function handleSave({ publish = false } = {}) {
    setSaving(true); setMsg('');
    try {
      const payload = buildPayload();
      const result = isNew ? await post('/superadmin/discover/articles', payload) : await put(`/superadmin/discover/articles/${id}`, payload);
      const savedArticle = result.article;
      const savedId = savedArticle?.id || id;
      if (savedArticle) applyArticle(savedArticle);
      if (publish && savedId && (savedArticle?.status || articleStatus) !== 'published') {
        const published = await patch(`/superadmin/discover/articles/${savedId}/publish`, {});
        setArticleStatus(published.article?.status || 'published');
        setMsg('Enregistré et publié.');
      } else {
        setMsg('Enregistré.');
      }
      if (isNew && savedId) navigate(`/discover-admin/articles/${savedId}/edit`, { replace: true });
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  }

  function liveArticlePath() {
    const active = translations[activeLang] || EMPTY_TRANSLATION;
    if (active.slug) return `/discover/${activeLang}/article/${active.slug}`;
    for (const lang of LANGUAGES.map(item => item.key)) {
      const tr = translations[lang] || EMPTY_TRANSLATION;
      if (tr.slug) return `/discover/${lang}/article/${tr.slug}`;
    }
    return articleSlug ? `/discover/ar/article/${articleSlug}` : '';
  }

  function handleViewLive() {
    const path = liveArticlePath();
    if (!path) { setMsg('Enregistrez l article pour générer son lien public.'); return; }
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  function currentMarkdownSelection() {
    const textarea = markdownRef.current;
    const content = translations[activeLang]?.content_md || '';
    if (!textarea) return { start: content.length, end: content.length };
    return { start: textarea.selectionStart, end: textarea.selectionEnd };
  }

  function handleOpenIllustrationModal() {
    const illustrations = form.image_assets?.illustrations || [];
    const first = illustrations[0];
    const key = selectedIllustrationKey || first?.key || first?.url || '';
    const asset = illustrations.find(item => (item.key || item.url) === key) || first;
    setMarkdownSelection(currentMarkdownSelection());
    setSelectedIllustrationKey(key);
    setIllustrationInsertTitle(asset ? imageAlt(asset, illustrations.indexOf(asset)) : '');
    setIllustrationModalOpen(true);
  }

  function handleSelectIllustration(key, asset) {
    const illustrations = form.image_assets?.illustrations || [];
    setSelectedIllustrationKey(key);
    setIllustrationInsertTitle(asset ? imageAlt(asset, illustrations.indexOf(asset)) : '');
  }

  async function handleModalIllustrationUpload(files) {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setUploading(true);
    setMsg('');
    try {
      const fd = new FormData();
      selected.forEach(file => fd.append('gallery', file));
      const res = await fetch(API('/superadmin/discover/articles/upload'), {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Échec de l\'upload');
      const urls = Array.isArray(data.gallery) ? data.gallery : [];
      const currentCount = form.image_assets?.illustrations?.length || 0;
      const additions = urls.map((url, index) => buildIllustrationAsset(url, currentCount + index, selected[index]?.name || ''));
      setForm(prev => {
        const existing = prev.image_assets?.illustrations || [];
        return syncIllustrations(prev, [...existing, ...additions]);
      });
      if (additions[0]) {
        const key = additions[0].key || additions[0].url;
        setSelectedIllustrationKey(key);
        setIllustrationInsertTitle(imageAlt(additions[0], currentCount));
      }
      setMsg(urls.length > 1 ? 'Illustrations ajoutées.' : 'Illustration ajoutée.');
    } catch (e) { setMsg(e.message); }
    setUploading(false);
  }

  function handleInsertIllustrationFromModal() {
    const illustrations = form.image_assets?.illustrations || [];
    const assetIndex = illustrations.findIndex(item => (item.key || item.url) === selectedIllustrationKey);
    const asset = illustrations[assetIndex];
    if (!asset?.url) return;
    const content = translations[activeLang]?.content_md || '';
    const start = Math.max(0, Math.min(markdownSelection?.start ?? content.length, content.length));
    const end = Math.max(start, Math.min(markdownSelection?.end ?? start, content.length));
    const snippet = imageSnippet(asset, Math.max(0, assetIndex), illustrationInsertTitle || imageAlt(asset, assetIndex));
    const nextContent = content.slice(0, start) + snippet + content.slice(end);
    setTranslations(prev => ({
      ...prev,
      [activeLang]: {
        ...(prev[activeLang] || EMPTY_TRANSLATION),
        content_md: nextContent,
      },
    }));
    setPreview('');
    setIllustrationModalOpen(false);
    setMsg('Illustration insérée à la position du curseur.');
    setTimeout(() => {
      const textarea = markdownRef.current;
      if (!textarea) return;
      const cursor = start + snippet.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  }


  function handleInsertImageAsset(asset, index = 0) {
    if (!asset?.url) return;
    const textarea = markdownRef.current;
    const selection = textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : null;
    const sourceAsset = {
      ...asset,
      source_name: asset.source_name || asset.title || asset.key || asset.url,
    };
    setTranslations(prev => {
      const current = prev[activeLang] || EMPTY_TRANSLATION;
      const content = current.content_md || '';
      const nextContent = insertImageAssetToMarkdown(content, sourceAsset, selection, index);
      return {
        ...prev,
        [activeLang]: {
          ...current,
          content_md: nextContent,
        },
      };
    });
    setPreview('');
    setMsg('Image insérée dans le Markdown.');
    setTimeout(() => markdownRef.current?.focus(), 0);
  }

  async function handleGenerateImages(only = null, forcePrompt = false) {
    if (isNew) { setMsg('Enregistre d abord l article avant de générer les images.'); return; }
    setImageBusy(only || 'all'); setMsg('');
    try {
      const { article } = await post(`/superadmin/discover/articles/${id}/ai/generate-images`, {
        include_sections: true,
        section_count: 2,
        force_prompt: forcePrompt,
        only,
      });
      applyArticle(article);
      setMsg('Images IA générées et enregistrées.');
    } catch (e) { setMsg(e.message); }
    setImageBusy('');
  }

  async function handleTranslateArticle() {
    if (isNew) { setMsg('Enregistrez d abord l article avant de créer une copie traduite.'); return; }
    const source = translations[activeLang] || EMPTY_TRANSLATION;
    const targetLang = translationTargetLang === activeLang
      ? LANGUAGES.find(lang => lang.key !== activeLang)?.key
      : translationTargetLang;
    if (!targetLang || targetLang === activeLang) { setMsg('Choisissez une langue cible différente.'); return; }
    if (!source.title || !source.content_md) { setMsg('Ajoutez un titre et un contenu dans la langue source avant de traduire.'); return; }
    setTranslatingLang(targetLang); setMsg('');
    try {
      const { article, translation } = await post(`/superadmin/discover/articles/${id}/ai/translate`, {
        source_language: activeLang,
        target_language: targetLang,
        title: source.title,
        excerpt: source.excerpt || '',
        content_md: source.content_md,
        seo_title: source.seo_title || '',
        seo_description: source.seo_description || '',
        tags: String(source.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      });
      if (article?.id) {
        applyArticle(article);
        navigate(`/discover-admin/articles/${article.id}/edit`);
      } else if (translation) {
        setTranslations(prev => ({
          ...prev,
          [targetLang]: { ...translation, tags: (translation.tags || []).join(', ') },
        }));
      }
      setActiveLang(targetLang);
      setPreview('');
      setMsg(`Nouvel article ${LANGUAGE_SHORT_LABELS[targetLang] || targetLang} créé en brouillon. Les images sont conservées aux mêmes emplacements.`);
    } catch (e) { setMsg(e.message); }
    setTranslatingLang('');
  }

  async function handleDeleteImage(key) {
    if (isNew) return;
    setImageBusy(key); setMsg("");
    try {
      const removed = (form.image_assets?.illustrations || []).find(item => item.key === key) || form.image_assets?.[key];
      const { article } = await del(`/superadmin/discover/articles/${id}/images/${key}`);
      applyArticle(article);
      if (removed?.url) {
        setTranslations(prev => ({
          ...prev,
          [activeLang]: {
            ...(prev[activeLang] || EMPTY_TRANSLATION),
            content_md: removeIllustrationFromMarkdown(prev[activeLang]?.content_md, removed.url),
          },
        }));
      }
      setPreview("");
      setMsg("Image supprimée.");
    } catch (e) { setMsg(e.message); }
    setImageBusy("");
  }

  const imageAssets = form.image_assets || {};
  const livePath = liveArticlePath();
  const canPublish = articleStatus !== 'published';
  const canViewLive = articleStatus === 'published' && !!livePath;

  return (
    <div className="app-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isNew ? 'Nouvel article iFilino Discover' : 'Modifier l\'article iFilino Discover'}</h1>
          <p className="page-subtitle">Statut : {articleStatus === 'published' ? 'Publié' : 'Brouillon'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline-primary" onClick={() => handleSave()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="btn btn-primary" onClick={() => handleSave({ publish: true })} disabled={saving || !canPublish}>{saving ? 'Publication…' : canPublish ? 'Publier' : 'Publié'}</button>
          <button type="button" className="btn btn-outline-primary" onClick={handleViewLive} disabled={!canViewLive} title={canViewLive ? livePath : 'Disponible après publication'}>Voir live</button>
        </div>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}
      {illustrationModalOpen && (
        <IllustrationInsertModal
          illustrations={form.image_assets?.illustrations || []}
          selectedKey={selectedIllustrationKey}
          title={illustrationInsertTitle}
          uploading={uploading}
          onUpload={handleModalIllustrationUpload}
          onSelect={handleSelectIllustration}
          onTitleChange={setIllustrationInsertTitle}
          onClose={() => setIllustrationModalOpen(false)}
          onInsert={handleInsertIllustrationFromModal}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--rb-border, #E5E7EB)', paddingBottom: 10 }}>
            {LANGUAGES.map(lang => (
              <button key={lang.key} type="button" className={`btn btn-xs ${activeLang === lang.key ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setActiveLang(lang.key)}>
                {lang.label} {hasTranslation(lang.key) ? '•' : ''}
              </button>
            ))}
          </div>
          <div style={{ padding: 12, background: 'var(--rb-surface, #F8FAFC)', border: '1px solid var(--rb-border, #E5E7EB)', borderRadius: 8 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>Créer une copie traduite</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--rb-muted, #64748B)' }}>Depuis {LANGUAGE_SHORT_LABELS[activeLang] || activeLang} vers</span>
              <select className="form-select" style={{ width: 160, minHeight: 36 }} value={translationTargetLang === activeLang ? '' : translationTargetLang} onChange={e => setTranslationTargetLang(e.target.value)}>
                {LANGUAGES.filter(lang => lang.key !== activeLang).map(lang => (
                  <option key={lang.key} value={lang.key}>{LANGUAGE_SHORT_LABELS[lang.key] || lang.label}</option>
                ))}
              </select>
              <AiButton type="button" className="btn btn-primary btn-xs" onClick={handleTranslateArticle} disabled={isNew || !!translatingLang} loading={!!translatingLang} loadingLabel="Traduction...">
                Créer un nouvel article traduit
              </AiButton>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--rb-muted, #64748B)' }}>
              Crée un nouvel article brouillon : textes, FAQ, SEO et libellés d'images sont traduits, les fichiers images restent les mêmes.
            </div>
          </div>
          <div dir={LANGUAGES.find(l => l.key === activeLang)?.dir || 'ltr'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Titre</label>
              <input className="form-control" value={translations[activeLang]?.title || ''} onChange={e => setTr('title', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Slug</label>
              <input className="form-control" value={translations[activeLang]?.slug || ''} onChange={e => setTr('slug', e.target.value)} placeholder={activeLang === 'ar' ? 'العناية-بالبشرة' : activeLang === 'en' ? 'best-beaches-in-northern-morocco' : 'prendre-soin-de-sa-peau'} />
            </div>
            <div>
              <label className="form-label">Résumé</label>
              <textarea className="form-control" rows={2} value={translations[activeLang]?.excerpt || ''} onChange={e => setTr('excerpt', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Contenu Markdown</label>
              <textarea ref={markdownRef} className="form-control" rows={16} style={{ fontFamily: 'monospace', fontSize: 13 }} value={translations[activeLang]?.content_md || ''} onChange={e => setTr('content_md', e.target.value)} onSelect={() => setMarkdownSelection(currentMarkdownSelection())} onKeyUp={() => setMarkdownSelection(currentMarkdownSelection())} onClick={() => setMarkdownSelection(currentMarkdownSelection())} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="btn btn-outline-primary btn-xs" onClick={handlePreview}>Aperçu</button>
                <button type="button" className="btn btn-outline-primary btn-xs" onMouseDown={() => setMarkdownSelection(currentMarkdownSelection())} onClick={handleOpenIllustrationModal}>Insérer illustration</button>
              </div>
              {preview && <div className="card" style={{ marginTop: 10, padding: 14 }} dangerouslySetInnerHTML={{ __html: preview }} />}
            </div>
            <div>
              <label className="form-label">Tags (séparés par virgule)</label>
              <input className="form-control" value={translations[activeLang]?.tags || ''} onChange={e => setTr('tags', e.target.value)} />
            </div>
            <div>
              <label className="form-label">SEO Title</label>
              <input className="form-control" value={translations[activeLang]?.seo_title || ''} onChange={e => setTr('seo_title', e.target.value)} />
            </div>
            <div>
              <label className="form-label">SEO Description</label>
              <textarea className="form-control" rows={3} value={translations[activeLang]?.seo_description || ''} onChange={e => setTr('seo_description', e.target.value)} />
            </div>
          </div>

          {form.category === 'recette' && (
            <div className="card" style={{ padding: 14, background: 'var(--rb-surface)' }}>
              <strong>Détails recette</strong>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Durée (min)</label>
                  <input className="form-control" type="number" value={form.recipe_duration} onChange={e => set('recipe_duration', e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Difficulté</label>
                  <select className="form-select" value={form.recipe_difficulty} onChange={e => set('recipe_difficulty', e.target.value)}>
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Ingrédients (un par ligne, format « quantité|nom »)</label>
                <textarea className="form-control" rows={5} placeholder={'2 tasses|farine\n1|œuf'} value={form.recipe_ingredients_text} onChange={e => set('recipe_ingredients_text', e.target.value)} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="form-label">Étapes (une par ligne)</label>
                <textarea className="form-control" rows={5} value={form.recipe_steps_text} onChange={e => set('recipe_steps_text', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">Rubrique Discover</label>
            <select className="form-select" value={form.rubrique} onChange={e => set('rubrique', e.target.value)}>
              {RUBRIQUES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>

            <label className="form-label" style={{ marginTop: 12 }}>Catégorie (type de contenu)</label>
            <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

          </div>

          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">Génération intelligente</label>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              {[
                "Générer l'article",
                'Générer les images',
                'Générer les produits recommandés',
                'Générer les commerces recommandés',
                'Générer les liens internes',
                'Générer les FAQ',
                'Générer les encadrés',
                'Générer les CTA',
                'Générer les métadonnées SEO',
              ].map(label => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked readOnly /> {label}
                </label>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">FAQ (question|réponse, une par ligne)</label>
            <textarea className="form-control" rows={6}
              placeholder={'Quel est le prix moyen ?|Comptez entre 50 et 90 MAD selon le commerce.'}
              value={form.faq_text} onChange={e => set('faq_text', e.target.value)} />
          </div>


          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">Sources (label|URL, une par ligne)</label>
            <textarea className="form-control" rows={4}
              placeholder={'Organisation mondiale de la Santé|https://www.who.int/fr'}
              value={form.sources_text} onChange={e => set('sources_text', e.target.value)} />
          </div>

          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">Image de couverture</label>
            {form.cover_image_url && <img src={ASSET(form.cover_image_url)} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />}
            <input type="file" accept="image/*" disabled={uploading} onChange={e => handleCoverUpload(e.target.files?.[0])} />
          </div>


          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Images iFilino Discover</label>
              <AiButton type="button" className="btn btn-primary btn-xs" onClick={() => handleGenerateImages(null, false)} disabled={!!imageBusy || isNew} loading={imageBusy === 'all'} loadingLabel="Génération...">
                Générer les images
              </AiButton>
            </div>
            <textarea className="form-control" rows={4} style={{ marginTop: 10, fontSize: 12 }} placeholder="Prompt image professionnel" value={form.image_prompt} onChange={e => set('image_prompt', e.target.value)} />
            <input className="form-control" style={{ marginTop: 8 }} placeholder="Texte alternatif" value={form.image_alt_text} onChange={e => set('image_alt_text', e.target.value)} />
            <div style={{ borderTop: '1px solid var(--rb-border, #E5E7EB)', marginTop: 12, paddingTop: 12 }}>
              <label className="form-label" htmlFor="article-illustrations-upload">Illustrations de l'article</label>
              <input
                id="article-illustrations-upload"
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={e => { handleIllustrationUpload(e.target.files); e.target.value = ''; }}
                style={{ display: 'none' }}
              />
              <label className="btn btn-outline-primary btn-xs" htmlFor="article-illustrations-upload" style={{ marginBottom: 8 }}>
                {uploading ? 'Upload...' : 'Ajouter illustration'}
              </label>
              <div style={{ fontSize: 11, color: 'var(--rb-muted)', marginTop: 4 }}>
                Ajoutez une ou plusieurs images depuis le stockage interne. Elles seront utilisées dans l'article et pour le partage Instagram quand le navigateur le permet.
              </div>
            </div>

            {[
              ['hero', 'Hero'], ['thumbnail', 'Miniature'], ['og', 'Open Graph'],
            ].map(([key, label]) => {
              const asset = imageAssets[key];
              return (
                <div key={key} style={{ borderTop: '1px solid var(--rb-border, #E5E7EB)', marginTop: 12, paddingTop: 12 }}>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  {asset?.url && <img src={ASSET(asset.url)} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 8, display: 'block' }} />}
                  {asset?.url && <input className="form-control" style={{ marginTop: 8, fontSize: 12 }} placeholder="Texte à insérer dans le Markdown" value={asset.alt_text || ''} onChange={e => updateNamedImageAsset(key, { alt_text: e.target.value, title: e.target.value || label })} />}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {asset?.url && <button type="button" className="btn btn-primary btn-xs" onClick={() => handleInsertImageAsset({ ...asset, key, title: asset.title || label, source_name: asset.source_name || `${key}-image` }, 0)}>Insérer</button>}
                    {asset?.url && <a className="btn btn-outline-primary btn-xs" href={ASSET(asset.url)} target="_blank" rel="noreferrer">Prévisualiser</a>}
                    {asset?.url && <a className="btn btn-outline-primary btn-xs" href={ASSET(asset.url)} download>Télécharger</a>}
                    <AiButton type="button" className="btn btn-outline-primary btn-xs" onClick={() => handleGenerateImages(key, false)} disabled={!!imageBusy || isNew} loading={imageBusy === key} loadingLabel="Regénération...">{asset?.url ? 'Regénérer' : 'Générer'}</AiButton>
                    <AiButton type="button" className="btn btn-outline-primary btn-xs" onClick={() => handleGenerateImages(key, true)} disabled={!!imageBusy || isNew} loading={imageBusy === key} loadingLabel="Remplacement...">Remplacer</AiButton>
                    {asset?.url && <button type="button" className="btn btn-outline-danger btn-xs" onClick={() => handleDeleteImage(key)} disabled={!!imageBusy}>Supprimer</button>}
                  </div>
                </div>
              );
            })}
            {(imageAssets.illustrations || []).map((asset, index) => (
              <div key={asset.key || index} style={{ borderTop: '1px solid var(--rb-border, #E5E7EB)', marginTop: 12, paddingTop: 12 }}>
                <strong style={{ fontSize: 13 }}>Illustration {index + 1}</strong>
                {asset?.url && <img src={ASSET(asset.url)} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 8, display: 'block' }} />}
                {asset?.url && <input className="form-control" style={{ marginTop: 8, fontSize: 12 }} placeholder="Texte à insérer dans le Markdown" value={asset.alt_text || ''} onChange={e => updateIllustrationAsset(index, { alt_text: e.target.value, title: e.target.value || `Illustration ${index + 1}` })} />}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => handleInsertImageAsset(asset, index)}>Insérer</button>
                  <a className="btn btn-outline-primary btn-xs" href={ASSET(asset.url)} target="_blank" rel="noreferrer">Prévisualiser</a>
                  <a className="btn btn-outline-primary btn-xs" href={ASSET(asset.url)} download>Télécharger</a>
                  <button type="button" className="btn btn-outline-danger btn-xs" onClick={() => isNew || String(asset.key || '').startsWith('upload-') ? handleRemoveLocalIllustration(asset.key) : handleDeleteImage(asset.key)} disabled={!!imageBusy}>Supprimer</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <label className="form-label">Produits associés (module:slug, un par ligne)</label>
            <textarea className="form-control" rows={4} placeholder={'resto:pizza-margherita\nhanout:coca-cola-1l'} value={form.related_products_text} onChange={e => set('related_products_text', e.target.value)} />

            <label className="form-label" style={{ marginTop: 12 }}>Commerces associés (vertical:slug, un par ligne)</label>
            <textarea className="form-control" rows={3} placeholder={'restaurant:snack-le-rapide'} value={form.related_businesses_text} onChange={e => set('related_businesses_text', e.target.value)} />
          </div>

        </div>
      </div>
    </div>
  );
}
