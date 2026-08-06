'use strict';
const { DataTypes, Model } = require('sequelize');
const sequelize = require('./db');

// iFilino Discover — articles éditoriaux (guides, recettes, promotions...).
// Produits/commerces liés référencés par slug en JSON (voir
// backend/src/modules/discover/articleService.js), pas de table de jointure —
// résolus à la lecture via les services marketplace déjà existants
// (productDetailService, publicDataService), même convention que
// HanoutProduct.tags/.images.
class Article extends Model {}

Article.init({
  id:               { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  slug:             { type: DataTypes.STRING(191), unique: true, allowNull: false },
  title:            { type: DataTypes.STRING(191), allowNull: false },
  excerpt:          { type: DataTypes.STRING(500), allowNull: true },
  cover_image_url:  { type: DataTypes.STRING(500), allowNull: true },
  image_prompt:     { type: DataTypes.TEXT, allowNull: true },
  image_alt_text:   { type: DataTypes.STRING(191), allowNull: true },
  image_assets:     { type: DataTypes.JSON, allowNull: true },       // {hero, thumbnail, og, illustrations[]} — moteur OpenAI Images
  category: {
    type: DataTypes.ENUM(
      'guide', 'recette', 'promotion', 'conseil', 'actualite',
      'nouveau_commerce', 'nouveau_produit', 'vie_locale', 'portrait'
    ),
    allowNull: false,
  },
  // Taxonomie de navigation iFilino Discover (sidebar/breadcrumb) — dimension
  // distincte de `category` (type de contenu). Voir discover/rubriques.js
  // pour la liste canonique (labels/icônes/mapping vertical).
  rubrique: {
    type: DataTypes.ENUM(
      'restaurants_food', 'courses_epiceries', 'boucheries', 'boulangeries',
      'patisseries', 'cafes', 'sante_pharmacies', 'beaute_bien_etre',
      'sport_forme', 'famille_enfants', 'maison_deco', 'sorties_loisirs',
      'shopping', 'evenements', 'villes', 'maroc', 'conseils_astuces', 'promotions'
    ),
    allowNull: false,
    defaultValue: 'conseils_astuces',
  },
  body:                  { type: DataTypes.TEXT('long'), allowNull: true }, // Markdown
  gallery:               { type: DataTypes.JSON, defaultValue: [] },       // [url, ...]
  tags:                  { type: DataTypes.JSON, defaultValue: [] },       // [string, ...]
  related_product_refs:  { type: DataTypes.JSON, defaultValue: [] },       // [{module, slug}, ...]
  related_business_refs: { type: DataTypes.JSON, defaultValue: [] },       // [{vertical, slug}, ...]
  city_id:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  recipe_meta:            { type: DataTypes.JSON, allowNull: true },        // {duration_minutes, difficulty, ingredients:[], steps:[]}
  status:                 { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  author_id:               { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  published_at:            { type: DataTypes.DATE, allowNull: true },
  seo_title:               { type: DataTypes.STRING(191), allowNull: true },
  seo_description:         { type: DataTypes.STRING(500), allowNull: true },
  generated_by_ai:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // brouillon issu du moteur IA — voir discover/aiDraftService.js
  faq:                     { type: DataTypes.JSON, allowNull: true },       // [{question, answer}] — source légitime du FAQPage schema
  sources:                 { type: DataTypes.JSON, allowNull: true },       // [{label, url}] — uniquement sources reconnues, jamais inventées
  view_count:              { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  modelName: 'article',
  tableName: 'articles',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['status', 'category'] },
    { fields: ['status', 'city_id'] },
    { fields: ['status', 'rubrique'] },
  ],
});

module.exports = Article;
