import { CONFIG } from './config.js';

/**
 * UI модуль - рендеринг и взаимодействие с DOM
 */

export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export function snippet(t, n = CONFIG.SEARCH.SNIPPET_LENGTH) {
  const p = (t || '').replace(/\*\*/g, '').replace(/`/g, '');
  return p.length > n ? p.slice(0, n) + '…' : p;
}

let toastTimeout;
export function toast(msg, duration = CONFIG.TOAST_DURATION) {
  const toastEl = $('#toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано');
  } catch {
    toast('Не удалось скопировать');
  }
}

export function itemUrl(kind, id) {
  return `${location.origin}${location.pathname}#${kind === 'theory' ? 'q' : 'p'}-${id}`;
}

export function md(t) {
  if (typeof marked === 'undefined') {
    console.error('Marked.js не загружен');
    return t || '';
  }
  return t ? marked.parse(t) : '';
}

export function showLoading(container, message = 'Загрузка...') {
  container.innerHTML = `<div class="loading" role="status" aria-live="polite">
    <span class="loading-spinner" aria-hidden="true"></span>
    <span>${esc(message)}</span>
  </div>`;
  container.hidden = false;
}

export function hideElement(el) {
  if (el) el.hidden = true;
}

export function showElement(el) {
  if (el) el.hidden = false;
}

export function setAriaLive(element, message, polite = true) {
  if (!element) return;
  element.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  element.textContent = message;
}

export default {
  $,
  $$,
  esc,
  snippet,
  toast,
  copyText,
  itemUrl,
  md,
  showLoading,
  hideElement,
  showElement,
  setAriaLive,
};
