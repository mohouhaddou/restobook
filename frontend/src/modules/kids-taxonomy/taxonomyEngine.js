import { GLOBAL_TAXONOMY } from "./taxonomyConfig";

const text = value => String(value ?? '').trim().toLocaleLowerCase();
const array = value => Array.isArray(value) ? value : value == null ? [] : [value];
const meta = item => item.metadata || {};

function valuesFor(item, field) {
  const source = {
    age: [item.age, item.ageRange, meta(item).age, meta(item).ageRange],
    grade: [item.grade, meta(item).grade],
    subject: [item.subject, item.category, meta(item).subject],
    difficulty: [item.difficulty, meta(item).difficulty],
    learningPath: [item.learningPathSlug, item.learning_path_slug, meta(item).learningPath, meta(item).learningPathSlug],
    skills: [item.skills, meta(item).skills, item.keywords],
    themes: [meta(item).themes, meta(item).theme, item.tags, item.category],
  }[field];
  if (field?.startsWith('metadata.')) return array(meta(item)[field.slice(9)]);
  return array(source ?? [item[field], meta(item)[field], item.tags]).flat(3).filter(Boolean);
}

export function matchesTaxonomy(item, criterion) {
  if (!criterion) return true;
  if (criterion.field === '$featured') return Boolean(item.featured);
  if (criterion.field === '$popular') return Number(item.view_count || item.views || 0) > 0;
  if (criterion.field === '$recommended') return Boolean(item.recommended || meta(item).recommended);
  if (criterion.field === "$favorites") { try { return Boolean(item.favorite || item.isFavorite || localStorage.getItem(`ifilino:kids:favorite:${item.type || "content"}:${item.slug}`) === "1"); } catch { return Boolean(item.favorite || item.isFavorite); } }
  if (criterion.field === "$continue") return Number(item.progress?.percent ?? item.progressPercent ?? 0) > 0;
  if (criterion.field === '$collections') return Boolean(meta(item).collection || meta(item).collections);
  if (criterion.field === '$search' || criterion.field === '$latest') return true;
  if (criterion.field === '$duration' || criterion.field === '$readingTime') {
    const duration = Number(criterion.field === '$readingTime'
      ? (meta(item).readingMinutes || item.readingTime || item.reading_time)
      : (item.estimatedDurationMinutes || item.duration || meta(item).duration));
    return Number.isFinite(duration) && duration >= criterion.values[0] && duration <= criterion.values[1];
  }
  const needles = criterion.values.map(text);
  return valuesFor(item, criterion.field).some(value => {
    const candidate = text(typeof value === 'object' ? (value.slug || value.name || value.label) : value);
    return needles.some(needle => candidate === needle || candidate.includes(needle) || needle.includes(candidate));
  });
}

export function taxonomyCounts(items, config) {
  return new Map([...GLOBAL_TAXONOMY, ...config.groups.flatMap(group => group.items)].map(criterion => [
    criterion.slug,
    criterion.field === '$search' ? items.length : items.filter(item => matchesTaxonomy(item, criterion)).length,
  ]));
}

export function filterByTaxonomy(items, criterion, query = '') {
  const normalized = text(query);
  return items.filter(item => matchesTaxonomy(item, criterion) && (!normalized || text([
    item.title, item.excerpt, item.summary, item.subject, item.grade, JSON.stringify(item.metadata || {}), ...array(item.tags), ...array(item.keywords),
  ].flat().join(' ')).includes(normalized)));
}
