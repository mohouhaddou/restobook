const L = (en, fr = en, ar = en) => ({ en, fr, ar });
const item = (slug, en, fr = en, ar = en, field = 'tags', values = []) => ({
  slug, label: L(en, fr, ar), field, values: values.length ? values : [slug, en],
});
const group = (id, en, fr, ar, items) => ({ id, label: L(en, fr, ar), items });

export const GLOBAL_TAXONOMY = [
  item('featured', 'Featured', 'À la une', 'مختارات', '$featured'),
  item('popular', 'Popular', 'Populaires', 'الأكثر شعبية', '$popular'),
  item('latest', 'New', 'Nouveautés', 'الأحدث', '$latest'),
  item('favorites', 'Favorites', 'Favoris', 'المفضلة', '$favorites'),
  item('continue-learning', 'Continue Learning', 'Continuer', 'متابعة التعلم', '$continue'),
  item('collections', 'Collections', 'Collections', 'مجموعات', '$collections'),
  item('search', 'Search', 'Recherche', 'بحث', '$search'),
];

const simple = (id, title, values) => [
  group(id, title, title, title, values.map(value => item(value[0], value[1], value[2], value[3], value[4] || id, value[5] || []))),
];

const study = [
  group('age', 'Age', 'Âge', 'العمر', ['4-5','5-6','6-7','7-8','8-9','9-10','10-11','11-12'].map(v => item(`age-${v}`, v, v, v, 'age', [v, `${v} ans`]))),
  group('grade', 'Grade', 'Classe', 'الصف', [
    ['preschool','Preschool','Préscolaire','ما قبل المدرسة'], ['kindergarten','Kindergarten','Maternelle','روضة'],
    ...[1,2,3,4,5,6].map(n => [`grade-${n}`,`Grade ${n}`,`Classe ${n}`,`الصف ${n}`]),
  ].map(v => item(v[0],v[1],v[2],v[3],'grade',[v[0],v[1],v[2]]))),
  group('subject', 'Subjects', 'Matières', 'المواد', [
    ['mathematics','Mathematics','Mathématiques','الرياضيات'],['english','English','Anglais','الإنجليزية'],['french','French','Français','الفرنسية'],['arabic','Arabic','Arabe','العربية'],
    ['science','Science','Sciences','العلوم'],['geography','Geography','Géographie','الجغرافيا'],['history','History','Histoire','التاريخ'],['technology','Technology','Technologie','التكنولوجيا'],
    ['coding','Coding','Programmation','البرمجة'],['robotics','Robotics','Robotique','الروبوتات'],['ai','AI','IA','الذكاء الاصطناعي'],['arts','Arts','Arts','الفنون'],
    ['music','Music','Musique','الموسيقى'],['health','Health','Santé','الصحة'],['financial-literacy','Financial Literacy','Éducation financière','الثقافة المالية'],
    ['digital-safety','Digital Safety','Sécurité numérique','السلامة الرقمية'],['logic','Logic','Logique','المنطق'],['critical-thinking','Critical Thinking','Esprit critique','التفكير النقدي'],
  ].map(v => item(v[0],v[1],v[2],v[3],'subject',[v[0],v[1],v[2]]))),
  group('difficulty', 'Level', 'Niveau', 'المستوى', [
    ['beginner','Beginner','Débutant','مبتدئ'],['intermediate','Intermediate','Intermédiaire','متوسط'],['advanced','Advanced','Avancé','متقدم'],
  ].map(v => item(v[0],v[1],v[2],v[3],'difficulty'))),
  group('learningPath', 'Learning paths', 'Parcours', 'مسارات التعلم', [
    ['mathematics-journey','Mathematics Journey','Parcours maths','رحلة الرياضيات'],['science-journey','Science Journey','Parcours sciences','رحلة العلوم'],
    ['reading-journey','Reading Journey','Parcours lecture','رحلة القراءة'],['writing-journey','Writing Journey','Parcours écriture','رحلة الكتابة'],
    ['coding-journey','Coding Journey','Parcours programmation','رحلة البرمجة'],['geography-journey','Geography Journey','Parcours géographie','رحلة الجغرافيا'],
  ].map(v => item(v[0],v[1],v[2],v[3],'learningPath',[v[0]]))),
  group('skills', 'Skills', 'Compétences', 'المهارات', [
    ['reading','Reading','Lecture','القراءة'],['writing','Writing','Écriture','الكتابة'],['counting','Counting','Calcul','العد'],
    ['problem-solving','Problem Solving','Résolution de problèmes','حل المشكلات'],['observation','Observation','Observation','الملاحظة'],
    ['creativity','Creativity','Créativité','الإبداع'],['memory','Memory','Mémoire','الذاكرة'],['communication','Communication','Communication','التواصل'],['logic','Logic','Logique','المنطق'],
  ].map(v => item(v[0],v[1],v[2],v[3],'skills'))),
  group('duration', 'Duration', 'Durée', 'المدة', [
    item('under-10-min','Under 10 min','Moins de 10 min','أقل من 10 دقائق','$duration',[0,9]),
    item('10-20-min','10–20 min','10–20 min','10–20 دقيقة','$duration',[10,20]),
    item('20-40-min','20–40 min','20–40 min','20–40 دقيقة','$duration',[21,40]),
    item('over-40-min','Over 40 min','Plus de 40 min','أكثر من 40 دقيقة','$duration',[41,9999]),
  ]),
];

const storyValues = [
  ['friendship','Friendship','Amitié','الصداقة'],['kindness','Kindness','Gentillesse','اللطف'],['courage','Courage','Courage','الشجاعة'],
  ['adventure','Adventure','Aventure','مغامرة'],['fantasy','Fantasy','Fantastique','خيال'],['nature','Nature','Nature','الطبيعة'],
  ['animals','Animals','Animaux','الحيوانات'],['space','Space','Espace','الفضاء'],['magic','Magic','Magie','السحر'],
  ['learning','Learning','Apprentissage','التعلم'],['bedtime','Bedtime','Heure du coucher','وقت النوم'],['funny','Funny','Drôle','مضحك'],
  ['princesses','Princesses','Princesses','الأميرات'],['dragons','Dragons','Dragons','التنانين'],['monsters','Monsters','Monstres','الوحوش'],
  ['exploration','Exploration','Exploration','الاستكشاف'],['family','Family','Famille','العائلة'],['feelings','Feelings','Émotions','المشاعر'],
];
const stories = [
  ...simple('universe','Universe',[['universe','Universe','Univers','العالم','metadata.universe']]),
  ...simple('characters','Characters',[['characters','Characters','Personnages','الشخصيات','metadata.characters']]),
  ...simple('series','Series',[['series','Series','Séries','سلاسل','metadata.series']]),
  group('age','Age','Âge','العمر',['4-6','6-8','8-10','10-12'].map(v=>item(`age-${v}`,v,v,v,'age',[v]))),
  group('readingTime','Reading time','Temps de lecture','وقت القراءة',[
    item('under-5-min','Under 5 min','Moins de 5 min','أقل من 5 دقائق','$readingTime',[0,5]),
    item('5-10-min','5–10 min','5–10 min','5–10 دقائق','$readingTime',[6,10]),
    item('over-10-min','Over 10 min','Plus de 10 min','أكثر من 10 دقائق','$readingTime',[11,9999]),
  ]),
  group('themes','Themes','Thèmes','المواضيع',storyValues.map(v=>item(v[0],v[1],v[2],v[3],'themes'))),
];

const makeSimpleModule = (title, values) => simple('topics', title, values.map(v => [v[0],v[1],v[2] || v[1],v[3] || v[1],'tags']));
const V = (...names) => names.map(name => [name.toLowerCase().replaceAll(' ','-'), name]);

export const KIDS_TAXONOMIES = {
  study: { contentType: 'learn', groups: study },
  stories: { contentType: 'stories', groups: stories },
  science: { contentType: 'science', groups: makeSimpleModule('Science', V('Physics','Chemistry','Biology','Human Body','Earth','Space','Weather','Electricity','Magnetism','Energy','Machines','Engineering','Robotics','Artificial Intelligence','Experiments','Great Scientists','Scientific Discoveries','Everyday Science')) },
  animals: { contentType: 'animals', groups: makeSimpleModule('Animals', V('Mammals','Birds','Fish','Reptiles','Amphibians','Insects','Dinosaurs','Ocean Animals','Farm Animals','Pets','Wild Animals','Endangered Species','Animal Babies','Animal Habitats','Animal Intelligence','Animal Adaptations')) },
  space: { contentType: 'space', groups: makeSimpleModule('Space', V('Solar System','Planets','Moon','Sun','Stars','Constellations','Galaxies','Black Holes','Astronauts','Space Missions','Rockets','Satellites','Mars','Earth','Telescopes','Future Space')) },
  nature: { contentType: 'nature', groups: makeSimpleModule('Nature', V('Forests','Mountains','Oceans','Rivers','Waterfalls','Volcanoes','Deserts','Rainforests','Flowers','Trees','Plants','Insects','Climate','Weather','Seasons','Environment','Recycling','Biodiversity')) },
  videos: { contentType: 'videos', groups: makeSimpleModule('Videos', V('Lessons','Experiments','Stories','Songs','Animations','Documentaries','Crafts','Drawing','Math','Science')) },
  coloring: { contentType: 'drawing', groups: makeSimpleModule('Coloring', V('Animals','Princesses','Dragons','Nature','Space','Science','Alphabet','Numbers','Shapes','Seasonal','Holidays')) },
  audiobooks: { contentType: 'audiobooks', groups: makeSimpleModule('Audiobooks', V('Stories','Educational','Bedtime','Adventure','Nature','Science','Learning')) },
};

export const TAXONOMY_MODULES = Object.keys(KIDS_TAXONOMIES);
export const localizedLabel = (value, language) => value?.[language] || value?.en || '';
export const taxonomyFor = module => KIDS_TAXONOMIES[module] || null;
export const findTaxonomyItem = (module, slug) => {
  const config = taxonomyFor(module);
  if (!config || !slug) return null;
  return [...GLOBAL_TAXONOMY, ...config.groups.flatMap(entry => entry.items)].find(entry => entry.slug === slug) || null;
};
