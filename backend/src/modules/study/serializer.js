'use strict';

// Mirroring backend/src/modules/portals/serializer.js — parsing markdown réservé au détail
// (withBody), même moteur (backend/src/shared/markdown/markdownEngine.js) que Stories/Discover.
const { parseMarkdown } = require('../../shared/markdown/markdownEngine');
const { authorizePublication, applyPublicationAccess } = require('../portals/freemium/accessPolicy');

function serializeResource(resource) {
  const item = resource.toJSON ? resource.toJSON() : resource;
  return {
    id: item.id,
    type: item.type,
    format: item.format,
    language: item.language,
    size: item.size,
    version: item.version,
    updatedAt: item.updatedAt,
  };
}

function serializeLesson(lesson, translation, { withBody = false, resources = null, isAuthenticated = false } = {}) {
  const item = lesson.toJSON ? lesson.toJSON() : lesson;
  const tr = translation ? (translation.toJSON ? translation.toJSON() : translation) : null;
  const title = tr?.title || null;
  const previewLength = Math.max(1, Math.floor(Number(item.metadata?.previewLength ?? item.metadata?.preview_length ?? 2)));
  const authorization = authorizePublication({
    isPremium: item.premium,
    previewLength,
    premiumBadge: item.metadata?.premiumBadge ?? item.metadata?.premium_badge ?? 'Premium',
  }, { isAuthenticated });
  // La limite UI est exprimée en pages. Le serveur applique en plus une limite
  // textuelle défensive afin de ne jamais livrer le cours complet à un invité.
  const sourceBody = tr?.body || null;
  const bodyMarkdown = authorization.isPreview
    ? applyPublicationAccess(sourceBody, { ...authorization, previewLength: previewLength * 1600 })
    : sourceBody;
  const parsed = withBody && bodyMarkdown ? parseMarkdown(bodyMarkdown, { title }) : null;

  return {
    id: item.id,
    translation_group_id: item.id,
    slug: tr?.slug || item.slug,
    language: tr?.language || null,
    title,
    summary: tr?.summary || null,
    body: bodyMarkdown,
    ...(parsed ? { blocks: parsed.blocks, toc: parsed.toc, readingTime: parsed.readingTime } : {}),

    subject: item.subject,
    grade: item.grade,
    difficulty: item.difficulty,
    estimatedDurationMinutes: item.estimated_duration_minutes,
    readingTimeMinutes: tr?.reading_time_minutes || null,

    coverImageUrl: item.cover_image_url,
    thumbnailUrl: item.thumbnail_url,
    category: item.category,
    tags: item.tags || [],
    keywords: item.keywords || [],
    premium: item.premium,
    isPremium: authorization.isPremium,
    previewLength: authorization.previewLength,
    premiumBadge: authorization.premiumBadge,
    access: { hasFullAccess: authorization.hasFullAccess, isPreview: authorization.isPreview },
    featured: item.featured,
    publishedAt: item.published_at,
    viewCount: item.view_count,
    publisher: item.publisher || null,

    objectives: tr?.objectives || [],
    skills: tr?.skills || [],
    competencies: tr?.competencies || [],

    prerequisites: item.prerequisites || [],
    nextLessons: item.next_lessons || [],
    relatedLessons: item.related_lessons || [],
    lessonOrder: item.lesson_order,
    learningPathSlug: item.learning_path_slug,

    seo: {
      title: tr?.seo_title || title,
      description: tr?.seo_description || tr?.summary || null,
      keywords: tr?.seo_keywords || [],
    },

    ...(resources ? { resources: resources.map(serializeResource) } : {}),
  };
}

/** Carte compacte pour les listes/grilles (pas de body/blocks — même optimisation que Stories). */
function serializeLessonCard(lesson, translation) {
  return serializeLesson(lesson, translation, { withBody: false });
}

module.exports = { serializeLesson, serializeLessonCard, serializeResource };
