import { CONFIG } from './config.js';

/**
 * Модуль для работы с localStorage
 */

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function favKey(kind, id) {
  return `${kind}:${id}`;
}

export function isLearned(id) {
  return loadJson(CONFIG.STORAGE_KEYS.LEARNED, []).includes(id);
}

export function isFavorite(kind, id) {
  return loadJson(CONFIG.STORAGE_KEYS.FAVORITE, []).includes(favKey(kind, id));
}

export function toggleLearned(id) {
  const set = loadJson(CONFIG.STORAGE_KEYS.LEARNED, []);
  const i = set.indexOf(id);
  if (i >= 0) set.splice(i, 1);
  else set.push(id);
  saveJson(CONFIG.STORAGE_KEYS.LEARNED, set);
  return set.length;
}

export function toggleFavorite(kind, id) {
  const key = favKey(kind, id);
  const set = loadJson(CONFIG.STORAGE_KEYS.FAVORITE, []);
  const i = set.indexOf(key);
  if (i >= 0) set.splice(i, 1);
  else set.push(key);
  saveJson(CONFIG.STORAGE_KEYS.FAVORITE, set);
  return set.includes(key);
}

export function learnedCount() {
  return loadJson(CONFIG.STORAGE_KEYS.LEARNED, []).length;
}

export function pushRecent(kind, id, title) {
  let list = loadJson(CONFIG.STORAGE_KEYS.RECENT, []);
  list = list.filter((x) => !(x.kind === kind && x.id === id));
  list.unshift({ kind, id, title });
  saveJson(CONFIG.STORAGE_KEYS.RECENT, list.slice(0, CONFIG.RECENT_MAX));
}

export function getRecent() {
  return loadJson(CONFIG.STORAGE_KEYS.RECENT, []);
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, t);
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export default {
  loadJson,
  saveJson,
  favKey,
  isLearned,
  isFavorite,
  toggleLearned,
  toggleFavorite,
  learnedCount,
  pushRecent,
  getRecent,
  getTheme,
  setTheme,
  toggleTheme,
};
