/**
 * Модуль навигации - управление состоянием и роутингом
 */

export const NAV_STATE = {
  section: 'theory',
  filterBlock: null,
  filterCategory: null,
  navContext: { kind: null, prevId: null, nextId: null },
  mockHidden: false,
  currentDetailOpts: {},
};

export function setSection(section) {
  NAV_STATE.section = section;
  NAV_STATE.filterBlock = null;
  NAV_STATE.filterCategory = null;
}

export function getSection() {
  return NAV_STATE.section;
}

export function setFilterBlock(blockId) {
  NAV_STATE.filterBlock = blockId;
}

export function getFilterBlock() {
  return NAV_STATE.filterBlock;
}

export function setFilterCategory(catId) {
  NAV_STATE.filterCategory = catId;
}

export function getFilterCategory() {
  return NAV_STATE.filterCategory;
}

export function setNavContext(kind, prevId, nextId) {
  NAV_STATE.navContext = { kind, prevId, nextId };
}

export function getNavContext() {
  return NAV_STATE.navContext;
}

export function setMockHidden(hidden) {
  NAV_STATE.mockHidden = hidden;
}

export function isMockHidden() {
  return NAV_STATE.mockHidden;
}

export function setCurrentDetailOpts(opts) {
  NAV_STATE.currentDetailOpts = opts;
}

export function getCurrentDetailOpts() {
  return NAV_STATE.currentDetailOpts;
}

export function parseHash() {
  const hash = location.hash.slice(1);
  
  if (hash.startsWith('q-')) {
    return { type: 'theory-detail', id: parseInt(hash.slice(2), 10) };
  } else if (hash.startsWith('p-')) {
    return { type: 'practice-detail', id: parseInt(hash.slice(2), 10) };
  } else if (hash === 'practice') {
    return { type: 'practice' };
  } else if (hash === 'plan') {
    return { type: 'theory' };
  } else if (hash.startsWith('search-')) {
    return { type: 'search', query: decodeURIComponent(hash.slice(7)) };
  } else if (hash === 'home' || hash === '') {
    return { type: 'home' };
  }
  
  return { type: 'home' };
}

export default {
  NAV_STATE,
  setSection,
  getSection,
  setFilterBlock,
  getFilterBlock,
  setFilterCategory,
  getFilterCategory,
  setNavContext,
  getNavContext,
  setMockHidden,
  isMockHidden,
  setCurrentDetailOpts,
  getCurrentDetailOpts,
  parseHash,
};
