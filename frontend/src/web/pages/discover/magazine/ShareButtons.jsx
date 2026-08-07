import React from 'react';
import { ASSET } from '../../../../api';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 8.8V7.2c0-.7.5-1 1.1-1H17V3h-2.7C11.5 3 10 4.7 10 7v1.8H7.8V12H10v9h3.5v-9h2.8l.5-3.2H13.5Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.4 10.5 21 3h-1.6l-5.7 6.5L9.1 3H4l6.9 9.8L4 21h1.6l6-7 4.8 7h5.1Zm-2.1 2.4-.7-1L6 4.2h2.3l4.5 6.3.7 1 5.9 8.3H17Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3a8.7 8.7 0 0 0-7.5 13.1L3.3 21l5-1.2A8.8 8.8 0 1 0 12 3Zm0 1.6a7.2 7.2 0 0 1 0 14.4 7.1 7.1 0 0 1-3.4-.9l-.3-.2-3 .8.8-2.9-.2-.3A7.2 7.2 0 0 1 12 4.6Zm-3.2 3.8c-.2 0-.5.1-.7.3-.3.3-.9.8-.9 2s.9 2.4 1 2.6c.1.1 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3-1.7-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2-1.2-.8-.7-1.3-1.5-1.4-1.8-.2-.2 0-.4.1-.5l.4-.5.2-.4c.1-.2 0-.4 0-.5l-.8-1.9c-.2-.3-.4-.3-.6-.3Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.8 3h8.4A4.8 4.8 0 0 1 21 7.8v8.4a4.8 4.8 0 0 1-4.8 4.8H7.8A4.8 4.8 0 0 1 3 16.2V7.8A4.8 4.8 0 0 1 7.8 3Zm0 1.8a3 3 0 0 0-3 3v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm8.7 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10.4 13.6a1 1 0 0 1 0-1.4l3.8-3.8a3 3 0 0 1 4.2 4.2l-2.1 2.1a1 1 0 1 0 1.4 1.4l2.1-2.1a5 5 0 0 0-7-7l-3.8 3.8a1 1 0 0 0 1.4 1.4Zm3.2-3.2a1 1 0 0 1 0 1.4l-3.8 3.8a3 3 0 0 1-4.2-4.2l2.1-2.1a1 1 0 1 0-1.4-1.4L4.2 10a5 5 0 0 0 7 7l3.8-3.8a1 1 0 0 0-1.4-1.4Z" />
    </svg>
  );
}

function ShareImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-9A2.5 2.5 0 0 1 5 18.5v-13Zm2.5-.7a.7.7 0 0 0-.7.7v8.2l2.5-2.4a1.5 1.5 0 0 1 2.1 0l1.3 1.3 2.1-2.1a1.5 1.5 0 0 1 2.2.1l.2.3V5.5a.7.7 0 0 0-.7-.7h-9Zm9.7 13.7v-4.8l-1.3-1.5-2.1 2.1a1.5 1.5 0 0 1-2.1 0L10.3 13l-3.5 3.4v2.1c0 .4.3.7.7.7h9a.7.7 0 0 0 .7-.7ZM9.7 7.2a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z" />
    </svg>
  );
}

function getShareImages(article) {
  const assets = article?.image_assets || {};
  const images = [];
  if (assets.hero?.url || article?.cover_image_url) {
    images.push({ url: assets.hero?.url || article.cover_image_url, name: 'hero' });
  }
  (assets.illustrations || []).forEach((img, index) => {
    if (img?.url) images.push({ url: img.url, name: img.key || `illustration-${index + 1}` });
  });
  return images;
}

function extensionFromType(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  return 'webp';
}

async function buildShareFiles(images) {
  const files = [];
  for (const image of images.slice(0, 10)) {
    const response = await fetch(ASSET(image.url));
    if (!response.ok) continue;
    const blob = await response.blob();
    const type = blob.type || 'image/webp';
    files.push(new File([blob], `${image.name}.${extensionFromType(type)}`, { type }));
  }
  return files;
}

function versionedShareUrl(url, article) {
  const version = article?.updated_at || article?.published_at || article?.id || '';
  if (!version || !url) return url;
  try {
    const next = new URL(url);
    next.searchParams.set('share', String(version).replace(/[^0-9A-Za-z_.:-]/g, ''));
    return next.toString();
  } catch {
    const sep = String(url).includes('?') ? '&' : '?';
    return `${url}${sep}share=${encodeURIComponent(String(version))}`;
  }
}

async function shareWithImages({ article, title, url, instagram = false }) {
  const images = getShareImages(article);
  try {
    const files = await buildShareFiles(images);
    const payload = {
      title: title || 'iFilino Discover',
      text: instagram ? `${title || 'Article iFilino Discover'} ${url}` : (title || ''),
      url,
      ...(files.length ? { files } : {}),
    };
    if (navigator.share && (!files.length || !navigator.canShare || navigator.canShare({ files }))) {
      await navigator.share(payload);
      return;
    }
  } catch {
    // Fallback below.
  }

  if (instagram) {
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export default function ShareButtons({ url, title, article, onCopyLink }) {
  const socialUrl = versionedShareUrl(url, article);
  const encodedUrl = encodeURIComponent(socialUrl);
  const encodedTitle = encodeURIComponent(title || '');
  const hasImages = getShareImages(article).length > 0;

  return (
    <div className="ifm-share-row" aria-label="Partager cet article">
      <a className="ifm-share-btn ifm-share-btn--facebook" aria-label="Partager sur Facebook" title="Partager sur Facebook" target="_blank" rel="noopener noreferrer"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}><FacebookIcon /></a>
      <a className="ifm-share-btn ifm-share-btn--x" aria-label="Partager sur X" title="Partager sur X" target="_blank" rel="noopener noreferrer"
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}><XIcon /></a>
      <a className="ifm-share-btn ifm-share-btn--whatsapp" aria-label="Partager sur WhatsApp" title="Partager sur WhatsApp" target="_blank" rel="noopener noreferrer"
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}><WhatsAppIcon /></a>
      {hasImages && (
        <button type="button" className="ifm-share-btn ifm-share-btn--native" aria-label="Partager avec l'image de l'article" title="Partager avec l'image de l'article" onClick={() => shareWithImages({ article, title, url })}>
          <ShareImageIcon />
        </button>
      )}
      {hasImages && (
        <button type="button" className="ifm-share-btn ifm-share-btn--instagram" aria-label="Partager sur Instagram" title="Partager sur Instagram" onClick={() => shareWithImages({ article, title, url, instagram: true })}>
          <InstagramIcon />
        </button>
      )}
      {onCopyLink ? (
        <button type="button" className="ifm-share-btn ifm-share-btn--link" aria-label="Copier le lien" title="Copier le lien" onClick={onCopyLink}><LinkIcon /></button>
      ) : (
        <a className="ifm-share-btn ifm-share-btn--link" aria-label="Copier le lien" title="Copier le lien" href={url}><LinkIcon /></a>
      )}
    </div>
  );
}
