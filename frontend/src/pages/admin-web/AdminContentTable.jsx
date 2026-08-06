import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import './admin-content-table.css';

const PAGE_SIZE = 10;
const text = value => String(value ?? '').toLocaleLowerCase('fr');

export function AccessBadge({ premium }) {
  return <span className={`admin-access-badge ${premium ? 'is-premium' : 'is-free'}`}><span aria-hidden="true">{premium ? '◆' : '✓'}</span>{premium ? 'Premium' : 'Gratuit'}</span>;
}

export function ArticleIdentity({ image, title, subtitle }) {
  return <div className="admin-article-identity">
    <span className="admin-article-thumb">{image ? <img src={image} alt="" width="64" height="44" loading="lazy" decoding="async"/> : <span aria-hidden="true">—</span>}</span>
    <span><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span>
  </div>;
}

export default function AdminContentTable({
  items, columns, categoryKey, categoryLabel = 'Catégories', allLabel = 'Tous',
  emptyMessage = 'Aucun contenu.', rowKey = item => item.id,
}) {
  const categories = useMemo(() => [...new Set(items.map(categoryKey).filter(Boolean))].sort((a,b) => text(a).localeCompare(text(b), 'fr')), [items, categoryKey]);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState({ key: columns.find(column => column.sortable !== false)?.key || '', direction: 'asc' });
  const [page, setPage] = useState(1);

  useEffect(() => { if (category && !categories.includes(category)) setCategory(''); }, [categories, category]);
  useEffect(() => { setPage(1); }, [category, items]);

  const filtered = useMemo(() => category ? items.filter(item => categoryKey(item) === category) : items, [items, category, categoryKey]);
  const sorted = useMemo(() => {
    const column = columns.find(candidate => candidate.key === sort.key);
    if (!column) return filtered;
    const getter = column.sortValue || column.value || (item => item[column.key]);
    return [...filtered].sort((a,b) => {
      const av = getter(a), bv = getter(b);
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : text(av).localeCompare(text(bv), 'fr', { numeric: true });
      return sort.direction === 'asc' ? result : -result;
    });
  }, [filtered, columns, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleSort(key) {
    setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  }

  return <section className="admin-content-table if-card" aria-label={categoryLabel}>
    <div className="admin-content-tabs" role="tablist" aria-label={categoryLabel}>
      <button type="button" role="tab" aria-selected={!category} className={!category ? 'active' : ''} onClick={() => setCategory('')}>{allLabel}<span>{items.length}</span></button>
      {categories.map(value => <button type="button" role="tab" aria-selected={category === value} className={category === value ? 'active' : ''} onClick={() => setCategory(value)} key={value}>{value}<span>{items.filter(item => categoryKey(item) === value).length}</span></button>)}
    </div>
    <div className="admin-table-scroll">
      <table>
        <thead><tr>{columns.map(column => {
          const active = sort.key === column.key;
          const ariaSort = column.sortable === false ? undefined : active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
          return <th key={column.key} scope="col" aria-sort={ariaSort} style={column.width ? { width: column.width } : undefined}>
            {column.sortable === false ? column.label : <button type="button" onClick={() => toggleSort(column.key)}>{column.label}{active ? (sort.direction === 'asc' ? <ArrowUp/> : <ArrowDown/>) : <ArrowUpDown/>}</button>}
          </th>;
        })}</tr></thead>
        <tbody>{visible.map(item => <tr key={rowKey(item)}>{columns.map(column => <td key={column.key}>{column.render ? column.render(item) : (column.value ? column.value(item) : item[column.key])}</td>)}</tr>)}</tbody>
      </table>
      {!visible.length && <p className="admin-table-empty">{emptyMessage}</p>}
    </div>
    <footer className="admin-table-pagination">
      <p><strong>{sorted.length}</strong> résultat{sorted.length > 1 ? 's' : ''} · page {safePage}/{pageCount}</p>
      <div><button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={safePage === 1} aria-label="Page précédente"><ChevronLeft/></button><span>{safePage}</span><button type="button" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={safePage === pageCount} aria-label="Page suivante"><ChevronRight/></button></div>
    </footer>
  </section>;
}
