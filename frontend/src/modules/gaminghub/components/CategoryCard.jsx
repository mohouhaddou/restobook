import React from 'react';
import { Link } from 'react-router-dom';

export default function CategoryCard({ category, count }) {
  return (
    <Link to={`/gaming/jeux?category=${category.slug}`} className="gh-category-card">
      <span className="icon" aria-hidden="true">{category.icon || '🎮'}</span>
      <strong>{category.label}</strong>
      {count != null && <small>{count} jeu{count > 1 ? 'x' : ''}</small>}
    </Link>
  );
}
