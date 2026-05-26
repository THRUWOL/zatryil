import { CONFIG } from './config.js';

/**
 * Модуль для поиска через Fuse.js
 */

export function createFuseIndex(data, keys) {
  if (typeof Fuse === 'undefined') {
    console.error('Fuse.js не загружен');
    return null;
  }
  return new Fuse(data, {
    keys,
    threshold: CONFIG.SEARCH.THRESHOLD,
    ignoreLocation: true,
  });
}

export function runSearch(fuse, query) {
  const q = (query || '').trim();
  if (!q || !fuse) return [];
  return fuse.search(q).map((r) => r.item);
}

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightHtml(text, query) {
  if (!query || !text) return escapeHtml(text);
  const terms = query.trim().split(/\s+/).filter((t) => t.length >= CONFIG.SEARCH.MIN_TERM_LENGTH);
  if (!terms.length) return escapeHtml(text);
  let html = escapeHtml(text);
  terms.forEach((term) => {
    const re = new RegExp(`(${escapeRegex(term)})`, 'gi');
    html = html.replace(re, '<mark class="hl">$1</mark>');
  });
  return html;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export default {
  createFuseIndex,
  runSearch,
  escapeRegex,
  highlightHtml,
};
