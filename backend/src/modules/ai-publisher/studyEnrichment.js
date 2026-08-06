'use strict';

// Enrichissement Study — s'exécute juste après que le publish générique (runtime.js,
// modelKind==='study') a créé/mis à jour la leçon + sa traduction. Contrairement au reste du
// pipeline (Metadata/ContentPackage, contrat fermé partagé par tous les modules), ce fichier lit
// directement le metadata.json brut et les fichiers extraits du ZIP — c'est le seul endroit où
// les champs propres à Study (subject/grade/objectifs/prérequis/ressources optionnelles...)
// existent. Best-effort partout : une erreur ici ne doit jamais faire échouer un import déjà
// publié avec succès (voir AI_IMPORT_MUST_TOLERATE_OPTIONAL_FILES dans le plan Study).

const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { StudyLesson, StudyLessonTranslation, StudyLessonResource } = require('../../../models');
const { getStorageProvider } = require('../digitalProducts/storage');

// Fichiers optionnels reconnus par le Study Editor — tout fichier absent de cette liste (et qui
// n'est pas l'un des 4 fichiers requis ou une image*.webp) est simplement laissé de côté : rien
// n'itère la liste complète en cherchant l'absence d'une correspondance, donc un fichier futur
// inconnu du Study Editor n'a jamais besoin d'un changement de code pour être toléré.
const OPTIONAL_RESOURCE_FILES = {
  'quiz.json': { type: 'quiz', format: 'json' },
  'exercises.json': { type: 'exercises', format: 'json' },
  'answers.json': { type: 'answers', format: 'json' },
  'flashcards.json': { type: 'flashcards', format: 'json' },
  'glossary.json': { type: 'glossary', format: 'json' },
  'teacher_notes.md': { type: 'teacher_notes', format: 'markdown' },
  'parent_guide.md': { type: 'parent_guide', format: 'markdown' },
  'certificate.json': { type: 'certificate', format: 'json' },
  'learning_path.json': { type: 'learning_path', format: 'json' },
  'lesson.json': { type: 'lesson', format: 'json' },
  'activities.json': { type: 'activities', format: 'json' },
  'sources.md': { type: 'sources', format: 'markdown' },
};

const DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced']);

function toStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.map(String).map(v => v.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

async function applyLessonMetadata(lesson, metadata, publisher) {
  const updates = {};
  if (typeof metadata.subject === 'string' && metadata.subject.trim()) updates.subject = metadata.subject.trim();
  if (typeof metadata.grade === 'string' && metadata.grade.trim()) updates.grade = metadata.grade.trim();
  if (typeof metadata.difficulty === 'string' && DIFFICULTIES.has(metadata.difficulty)) updates.difficulty = metadata.difficulty;

  const duration = toPositiveInt(metadata.estimatedDuration ?? metadata.estimated_duration_minutes ?? metadata.duration);
  if (duration !== undefined) updates.estimated_duration_minutes = duration;

  if (typeof metadata.premium === 'boolean') updates.premium = metadata.premium;

  const prerequisites = toStringArray(metadata.prerequisites);
  if (prerequisites) updates.prerequisites = prerequisites;
  const nextLessons = toStringArray(metadata.nextLessons ?? metadata.next_lessons);
  if (nextLessons) updates.next_lessons = nextLessons;
  const relatedLessons = toStringArray(metadata.relatedLessons ?? metadata.related_lessons);
  if (relatedLessons) updates.related_lessons = relatedLessons;
  const keywords = toStringArray(metadata.keywords);
  if (keywords) updates.keywords = keywords;

  if (typeof metadata.learningPathSlug === 'string' && metadata.learningPathSlug.trim()) updates.learning_path_slug = metadata.learningPathSlug.trim();
  const lessonOrder = toPositiveInt(metadata.lessonOrder ?? metadata.lesson_order);
  if (lessonOrder !== undefined) updates.lesson_order = lessonOrder;

  if (publisher && typeof publisher === 'object' && (publisher.name || publisher.logo || publisher.url)) {
    updates.publisher = { name: publisher.name, logo: publisher.logo, url: publisher.url };
  }

  if (Object.keys(updates).length) await lesson.update(updates);
}

async function applyTranslationMetadata(lessonId, language, metadata) {
  const translation = await StudyLessonTranslation.findOne({ where: { study_lesson_id: lessonId, language } });
  if (!translation) return;
  const updates = {};
  const objectives = toStringArray(metadata.objectives ?? metadata.learningObjectives);
  if (objectives) updates.objectives = objectives;
  const skills = toStringArray(metadata.skills);
  if (skills) updates.skills = skills;
  const competencies = toStringArray(metadata.competencies);
  if (competencies) updates.competencies = competencies;
  if (Object.keys(updates).length) await translation.update(updates);
}

async function generateThumbnail(lesson, workspace, files) {
  if (!files.includes('cover.webp')) return;
  try {
    const targetDir = path.resolve(__dirname, '../../../uploads/study');
    await fs.mkdir(targetDir, { recursive: true });
    const thumbName = `study-${lesson.id}-thumb-${Date.now()}.webp`;
    await sharp(path.join(workspace, 'cover.webp'))
      .resize(480, 320, { fit: 'cover' })
      .webp({ quality: 78 })
      .toFile(path.join(targetDir, thumbName));
    await lesson.update({ thumbnail_url: `/uploads/study/${thumbName}` });
  } catch (error) {
    console.error('[study] Génération de la miniature échouée :', error.message);
  }
}

async function importResourceFiles(lessonId, workspace, files) {
  const storage = getStorageProvider();
  for (const filename of files) {
    const known = OPTIONAL_RESOURCE_FILES[filename.toLowerCase()];
    if (!known) continue; // Fichier non reconnu par le Study Editor — ignoré, jamais une erreur.
    try {
      const buffer = await fs.readFile(path.join(workspace, filename));
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
      const storagePath = `study/${lessonId}/${known.type}${path.extname(filename) || ''}`;
      await storage.save(buffer, storagePath);
      const [resource, created] = await StudyLessonResource.findOrCreate({
        where: { study_lesson_id: lessonId, language: null, type: known.type },
        defaults: {
          study_lesson_id: lessonId, language: null, type: known.type, format: known.format,
          storage_path: storagePath, checksum, size: buffer.length, version: 1,
        },
      });
      if (!created) {
        await resource.update({
          format: known.format, storage_path: storagePath, checksum, size: buffer.length,
          version: resource.version + 1,
        });
      }
    } catch (error) {
      console.error(`[study] Import de la ressource "${filename}" échoué :`, error.message);
    }
  }
}

/**
 * @param {{lessonId:number, language:string, metadata:Record<string,unknown>,
 *   publisher:Record<string,unknown>, workspace:string, files:readonly string[]}} params
 */
async function enrichStudyLesson({ lessonId, language, metadata = {}, publisher = {}, workspace, files = [] }) {
  const lesson = await StudyLesson.findByPk(lessonId);
  if (!lesson) return;

  try { await applyLessonMetadata(lesson, metadata, publisher); }
  catch (error) { console.error('[study] Mise à jour des métadonnées de la leçon échouée :', error.message); }

  try { await applyTranslationMetadata(lessonId, language, metadata); }
  catch (error) { console.error('[study] Mise à jour des métadonnées de traduction échouée :', error.message); }

  await generateThumbnail(lesson, workspace, files);
  await importResourceFiles(lessonId, workspace, files);
}

module.exports = { enrichStudyLesson, OPTIONAL_RESOURCE_FILES };
