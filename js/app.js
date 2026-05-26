/**
 * Побег из Тавриды — главное приложение
 * Модульная архитектура с ES6 import/export
 */

import { CONFIG } from './modules/config.js';
import {
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
} from './modules/storage.js';
import {
  createFuseIndex,
  runSearch as runSearchUtil,
  highlightHtml,
} from './modules/search.js';
import { loadData } from './modules/data.js';
import {
  $,
  $$,
  esc,
  snippet,
  toast,
  copyText,
  itemUrl,
  md,
  hideElement,
  showElement,
} from './modules/ui.js';
import {
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
} from './modules/navigation.js';

// Глобальное состояние данных
let theory = { questions: [], blocks: [] };
let practice = { categories: [], tasks: [], methodology: {}, plan14: [] };
let fuseTheory = null;
let fusePractice = null;

// DOM элементы
const searchInput = $('#search');
const searchClearBtn = $('#search-clear');
const sectionTabs = $('#section-tabs');
const sidebarNav = $('#sidebar-nav');
const hero = $('#hero');
const listView = $('#list-view');
const detailView = $('#detail-view');
const shortcutsDialog = $('#shortcuts-dialog');

// ============================================================================
// Инициализация
// ============================================================================

async function init() {
  try {
    // Показываем индикатор загрузки
    showLoading(hero, 'Загрузка данных...');
    
    // Загружаем данные с retry-логикой
    const data = await loadData();
    theory = data.theory;
    practice = data.practice;

    // Создаём поисковые индексы
    fuseTheory = createFuseIndex(theory.questions, [
      'title',
      'answer',
      'searchText',
      'blockShortName',
    ]);
    fusePractice = createFuseIndex(practice.tasks, [
      'title',
      'description',
      'approach',
      'pattern',
      'searchText',
      'categoryTitle',
    ]);

    // Инициализируем тему
    initTheme();
    
    // Привязываем обработчики событий
    bindGlobalUi();
    bindSectionTabs();
    
    // Рендерим интерфейс
    renderSidebar();
    renderHero();
    
    // Обрабатываем текущий hash
    handleHash();
    
  } catch (err) {
    console.error('Ошибка инициализации:', err);
    hero.innerHTML = `
      <div class="error" role="alert">
        <h3>Ошибка загрузки</h3>
        <p>${esc(err.message)}</p>
        <p class="error-hint">Откройте сайт через локальный сервер или GitHub Pages (не как file://)</p>
      </div>
    `;
  }
}

function showLoading(container, message) {
  container.innerHTML = `
    <div class="loading" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>${esc(message)}</span>
    </div>
  `;
}

// ============================================================================
// Тема
// ============================================================================

function initTheme() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME);
  if (saved === 'dark' || saved === 'light') {
    setTheme(saved);
  }
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
}

// ============================================================================
// Глобальные UI обработчики
// ============================================================================

function bindGlobalUi() {
  searchClearBtn?.addEventListener('click', clearSearch);
  $('#shortcuts-btn')?.addEventListener('click', () => {
    shortcutsDialog?.showModal();
  });
  searchInput.addEventListener('input', handleSearchInput);
  
  // Обработка горячих клавиш
  document.addEventListener('keydown', handleKeydown);
  
  // Hash navigation
  window.addEventListener('hashchange', handleHash);
}

function bindSectionTabs() {
  sectionTabs.querySelectorAll('.section-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSectionState(btn.dataset.section);
    });
  });
  
  $('#brand-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    setSectionState('theory');
    goHome();
  });
}

let searchTimer;
function handleSearchInput() {
  clearTimeout(searchTimer);
  const v = searchInput.value;
  updateSearchClear();
  searchTimer = setTimeout(() => {
    if (v.trim()) {
      runSearch(v);
    } else {
      clearSearch();
    }
  }, CONFIG.SEARCH.DEBOUNCE_MS);
}

function handleKeydown(e) {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA';

  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
  
  if (e.key === '?' && !typing) {
    e.preventDefault();
    shortcutsDialog?.showModal();
  }
  
  if (e.key === 'Escape') {
    if (searchInput.value.trim()) {
      clearSearch();
    } else {
      goHome();
    }
  }
  
  if (!typing && !detailView.hidden) {
    const navContext = getNavContext();
    if (e.key === 'ArrowLeft' && navContext.prevId) {
      e.preventDefault();
      navContext.kind === 'theory'
        ? showTheoryDetail(navContext.prevId)
        : showPracticeDetail(navContext.prevId);
    }
    if (e.key === 'ArrowRight' && navContext.nextId) {
      e.preventDefault();
      navContext.kind === 'theory'
        ? showTheoryDetail(navContext.nextId)
        : showPracticeDetail(navContext.nextId);
    }
  }
}

// ============================================================================
// Поиск
// ============================================================================

function updateSearchClear() {
  const active = !!searchInput.value.trim();
  if (searchClearBtn) searchClearBtn.hidden = !active;
}

function clearSearch() {
  searchInput.value = '';
  updateSearchClear();
  const section = getSection();
  const filterBlock = getFilterBlock();
  const filterCategory = getFilterCategory();
  
  if (section === 'theory') {
    if (filterBlock) onSidebarClick(filterBlock);
    else onSidebarClick('all');
  } else if (section === 'practice') {
    if (filterCategory) onSidebarClick(filterCategory);
    else onSidebarClick('all');
  } else {
    goHome();
  }
  location.hash = section === 'theory' ? 'home' : section;
}

function runSearch(query) {
  const q = query.trim();
  updateSearchClear();
  
  if (!q) {
    clearSearch();
    return;
  }
  
  const tRes = runSearchUtil(fuseTheory, q);
  const pRes = runSearchUtil(fusePractice, q);
  
  hideElement(hero);
  hideElement(detailView);
  showElement(listView);
  
  listView.innerHTML = `
    <div class="list-header-row" role="search" aria-label="Результаты поиска">
      <span class="list-header">Поиск: «${esc(q)}» — теория ${tRes.length}, практика ${pRes.length}</span>
      <button type="button" class="chip-clear" id="list-search-clear" aria-label="Сбросить поиск">✕ Сбросить</button>
    </div>
    ${tRes.length ? `<h4 class="list-sub">Теория</h4>` + tRes.map((x) => cardTheory(x, { highlight: q })).join('') : ''}
    ${pRes.length ? `<h4 class="list-sub">Практика</h4>` + pRes.map((x) => cardPractice(x, { highlight: q })).join('') : ''}
    ${!tRes.length && !pRes.length ? '<p class="empty" role="status">Ничего не найдено</p>' : ''}
  `;
  
  $('#list-search-clear')?.addEventListener('click', clearSearch);
  bindListCards();
  location.hash = `search-${encodeURIComponent(q)}`;
}

// ============================================================================
// Навигация по разделам
// ============================================================================

function setSectionState(section) {
  setSection(section);
  setFilterBlock(null);
  setFilterCategory(null);
  searchInput.value = '';
  updateSearchClear();
  
  sectionTabs.querySelectorAll('.section-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.section === section);
  });
  
  renderSidebar();
  renderHero();
  hideDetail();
  hideElement(listView);
  showElement(hero);
  location.hash = section === 'theory' ? 'home' : section;
}

function handleHash() {
  const parsed = parseHash();
  
  switch (parsed.type) {
    case 'theory-detail':
      setSectionState('theory');
      showTheoryDetail(parsed.id);
      break;
    case 'practice-detail':
      setSectionState('practice');
      showPracticeDetail(parsed.id);
      break;
    case 'practice':
      setSectionState('practice');
      break;
    case 'theory':
    case 'plan':
      setSectionState('theory');
      break;
    case 'search':
      searchInput.value = parsed.query;
      runSearch(parsed.query);
      break;
    case 'home':
    default:
      goHome();
      break;
  }
}

// ============================================================================
// Сайдбар
// ============================================================================

function renderSidebar() {
  const section = getSection();
  const filterBlock = getFilterBlock();
  
  if (section === 'theory') {
    const blocks = theory.blocks.filter(
      (b) => !CONFIG.EXCLUDED_BLOCKS.includes(b.id)
    );
    const learned = learnedCount();
    const total = theory.questions.length;
    
    sidebarNav.innerHTML = `
      <p class="nav-progress" aria-label="Прогресс обучения">Выучено: ${learned}/${total}</p>
      <button type="button" class="nav-item nav-item-random" data-nav="random" aria-label="Случайный вопрос для мок-собеседования">
        Случайный вопрос
      </button>
      ${renderRecentBlock()}
      <p class="nav-label">Блоки теории · ${total} вопр.</p>
      ${navBtn('all', 'Все вопросы', !filterBlock)}
      ${blocks
        .map((b) =>
          navBtn(b.id, `${b.id}. ${esc(b.shortName || b.name)}`, filterBlock === b.id)
        )
        .join('')}
    `;
  } else if (section === 'practice') {
    sidebarNav.innerHTML = `
      <p class="nav-label">Категории · ${practice.tasks.length} задач</p>
      ${navBtn('all', 'Все задачи', true)}
      ${navBtn('method', 'Методология', false)}
      ${practice.categories
        .map((c) => navBtn(c.id, c.title, false, practiceBadge(c.id)))
        .join('')}
    `;
  }
  
  sidebarNav.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.nav === 'random') {
        showRandomMock();
      } else {
        onSidebarClick(btn.dataset.nav);
      }
    });
  });
  
  bindRecentClicks();
}

function navBtn(id, label, active, badge = '') {
  return `<button type="button" class="nav-item${active ? ' active' : ''}" data-nav="${id}" aria-current="${active ? 'true' : 'false'}">${badge}${esc(label)}</button>`;
}

function practiceBadge(id) {
  const icons = {
    hashmap: '🗂',
    window: '↔',
    intervals: '📊',
    graph: '🌐',
    strings: 'Aa',
    java: '☕',
  };
  const ic = icons[id] || '•';
  return `<span class="nav-icon" aria-hidden="true">${ic}</span>`;
}

function renderRecentBlock() {
  const recent = getRecent();
  if (!recent.length) return '';
  
  return `
    <div class="sidebar-recent" aria-label="Недавние">
      <p class="nav-label">Недавние</p>
      ${recent
        .map(
          (r) =>
            `<button type="button" class="recent-item" data-recent-kind="${r.kind}" data-recent-id="${r.id}" aria-label="Перейти к #${r.id} ${esc(snippet(r.title, 42))}">#${r.id} ${esc(snippet(r.title, 42))}</button>`
        )
        .join('')}
    </div>
  `;
}

function bindRecentClicks() {
  sidebarNav.querySelectorAll('.recent-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.recentKind;
      const id = parseInt(btn.dataset.recentId, 10);
      if (kind === 'theory') {
        setSectionState('theory');
        showTheoryDetail(id);
      } else {
        setSectionState('practice');
        showPracticeDetail(id);
      }
    });
  });
}

function onSidebarClick(nav) {
  searchInput.value = '';
  updateSearchClear();
  const section = getSection();
  
  if (section === 'theory') {
    const blockId = nav === 'all' ? null : parseInt(nav, 10);
    setFilterBlock(blockId);
    setNavActive(nav);
    if (blockId) {
      showTheoryList(theory.questions.filter((q) => q.block === blockId));
    } else {
      showTheoryList(theory.questions);
    }
  } else if (section === 'practice') {
    setNavActive(nav);
    if (nav === 'method') {
      showMethodology();
    } else if (nav === 'all') {
      showPracticeList(practice.tasks);
    } else {
      setFilterCategory(nav);
      const cat = practice.categories.find((c) => c.id === nav);
      showPracticeList(cat ? cat.tasks : practice.tasks);
    }
  }
}

function setNavActive(nav) {
  sidebarNav.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.nav === String(nav));
    b.setAttribute('aria-current', b.dataset.nav === String(nav) ? 'true' : 'false');
  });
}

// ============================================================================
// Hero секция
// ============================================================================

function renderHero() {
  const section = getSection();
  
  if (section === 'theory') {
    hero.innerHTML = `
      <span class="hero-badge hero-badge-theory">Теория</span>
      <h2>91 вопрос</h2>
      <p>Java Core, Spring, SQL, Kafka — с ответами и ссылками на документацию.</p>
      <div class="hero-actions">
        <button type="button" class="btn-primary" data-action="random-mock">Случайный вопрос</button>
        <button type="button" class="btn-secondary" data-action="all-theory">Все вопросы</button>
      </div>
    `;
  } else {
    hero.innerHTML = `
      <span class="hero-badge hero-badge-practice">Практика</span>
      <h2>32 задачи</h2>
      <p>LeetCode, live-coding и Java-специфика с эталонным кодом.</p>
      <div class="hero-actions">
        <button type="button" class="btn-primary" data-action="method">Методология</button>
        <button type="button" class="btn-secondary" data-action="all-practice">Все задачи</button>
      </div>
    `;
  }
  
  hero.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'random-mock') showRandomMock();
      if (action === 'all-theory') onSidebarClick('all');
      if (action === 'method') {
        setSectionState('practice');
        onSidebarClick('method');
      }
      if (action === 'all-practice') onSidebarClick('all');
    });
  });
}

function showRandomMock() {
  const qs = theory.questions;
  if (!qs.length) return;
  const q = qs[Math.floor(Math.random() * qs.length)];
  setSectionState('theory');
  showTheoryDetail(q.id, { mock: true });
}

// ============================================================================
// Списки и карточки
// ============================================================================

function hideDetail() {
  hideElement(detailView);
}

function showList(html) {
  hideElement(hero);
  hideElement(detailView);
  showElement(listView);
  listView.innerHTML = html;
  bindListCards();
}

function goHome() {
  showElement(hero);
  hideElement(listView);
  hideElement(detailView);
}

function showTheoryList(items, title) {
  const hdr = title || `Вопросы · ${items.length}`;
  const section = getSection();
  const filterBlock = getFilterBlock();
  const grouped =
    section === 'theory' &&
    !filterBlock &&
    !searchInput.value.trim() &&
    items.length > 15;

  let body = '';
  if (grouped) {
    const groups = new Map();
    items.forEach((q) => {
      if (!groups.has(q.block)) {
        groups.set(q.block, {
          name: q.blockShortName || q.blockName,
          items: [],
        });
      }
      groups.get(q.block).items.push(q);
    });
    
    [...groups.keys()]
      .sort((a, b) => a - b)
      .forEach((bid) => {
        const g = groups.get(bid);
        body += `<h3 class="block-group-title">Блок ${bid}. ${esc(g.name)}</h3>`;
        body += g.items.map((q) => cardTheory(q)).join('');
      });
  } else {
    body = items.map((q) => cardTheory(q)).join('');
  }
  
  showList(`<p class="list-header">${esc(hdr)}</p>` + body);
}

function showPracticeList(items, title) {
  const hdr = title || `Задачи · ${items.length}`;
  showList(`<p class="list-header">${esc(hdr)}</p>` + items.map((t) => cardPractice(t)).join(''));
}

function cardTheory(q, opts = {}) {
  const hl = opts.highlight;
  const learned = isLearned(q.id);
  const fav = isFavorite('theory', q.id);
  const cardCls = ['card', learned ? 'card-learned' : '', fav ? 'card-fav' : '']
    .filter(Boolean)
    .join(' ');
  
  return `
    <a class="${cardCls}" href="#q-${q.id}" data-kind="theory" data-id="${q.id}" tabindex="0">
      <div class="card-meta">
        <span class="tag tag-theory">#${q.id}</span>
        <span class="tag">${esc(q.blockShortName || `Блок ${q.block}`)}</span>
        ${learned ? '<span class="tag tag-learned" aria-label="Выучено">✓</span>' : ''}
        ${fav ? '<span class="tag tag-fav" aria-label="В избранном">★</span>' : ''}
      </div>
      <h3>${hl ? highlightHtml(q.title, hl) : esc(q.title)}</h3>
      <p>${hl ? highlightHtml(snippet(q.answer), hl) : esc(snippet(q.answer))}</p>
    </a>
  `;
}

function cardPractice(t, opts = {}) {
  const hl = opts.highlight;
  const lc = t.leetcodeUrl
    ? `<span class="tag tag-lc">LeetCode</span>`
    : `<span class="tag tag-interview">Собес</span>`;
  const pattern = t.pattern
    ? `<span class="tag tag-pattern">${esc(t.pattern)}</span>`
    : '';
  const fav = isFavorite('practice', t.num);
  
  return `
    <a class="card card-practice${fav ? ' card-fav' : ''}" href="#p-${t.num}" data-kind="practice" data-id="${t.num}" tabindex="0">
      <div class="card-meta">
        <span class="tag tag-practice">${esc(t.categoryTitle)}</span>
        ${pattern}
        ${lc}
        ${fav ? '<span class="tag tag-fav" aria-label="В избранном">★</span>' : ''}
      </div>
      <h3>${hl ? highlightHtml(t.title, hl) : esc(t.title)}</h3>
      <p class="card-desc">${hl ? highlightHtml(snippet(t.description || t.approach || t.title, CONFIG.SEARCH.PRACTICE_SNIPPET_LENGTH), hl) : esc(snippet(t.description || t.approach || t.title, CONFIG.SEARCH.PRACTICE_SNIPPET_LENGTH))}</p>
      ${t.complexity ? `<p class="card-complexity">Сложность: <code>${esc(t.complexity)}</code></p>` : ''}
    </a>
  `;
}

function bindListCards() {
  listView.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('click', (e) => {
      e.preventDefault();
      if (c.dataset.kind === 'theory') {
        showTheoryDetail(parseInt(c.dataset.id, 10));
      } else {
        showPracticeDetail(parseInt(c.dataset.id, 10));
      }
    });
    
    // Поддержка Enter для accessibility
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        c.click();
      }
    });
  });
}

// ============================================================================
// Детальный просмотр
// ============================================================================

function showTheoryDetail(id, opts = {}) {
  const q = theory.questions.find((x) => x.id === id);
  if (!q) return;
  
  const idx = theory.questions.findIndex((x) => x.id === id);
  const prev = theory.questions[idx - 1];
  const next = theory.questions[idx + 1];
  
  setCurrentDetailOpts(opts);
  setMockHidden(!!opts.mock);
  pushRecent('theory', id, q.title);
  setNavContext('theory', prev?.id ?? null, next?.id ?? null);

  hideElement(listView);
  hideElement(hero);
  showElement(detailView);
  
  detailView.innerHTML = detailShell(
    'theory',
    q.id,
    opts.mock ? `Мок · вопрос ${q.id}` : `Вопрос ${q.id}`,
    q.blockTitle,
    q.title,
    [
      ['Ответ', 'answer', md(q.answer)],
      ['Источники', 'sources', renderSources(q.sources)],
    ],
    prev ? { id: prev.id, title: prev.title, kind: 'theory' } : null,
    next ? { id: next.id, title: next.title, kind: 'theory' } : null,
    { mock: opts.mock, toolbar: detailToolbar('theory', id, { mock: opts.mock }) }
  );
  
  bindDetailNav();
  bindDetailToolbar('theory', id, q, opts);
  renderSidebar();
  location.hash = `q-${id}`;
}

function showPracticeDetail(num) {
  const t = practice.tasks.find((x) => x.num === num);
  if (!t) return;
  
  const idx = practice.tasks.findIndex((x) => x.num === num);
  const prev = practice.tasks[idx - 1];
  const next = practice.tasks[idx + 1];

  const meta = [
    t.pattern ? `<span class="pill">Паттерн: ${esc(t.pattern)}</span>` : '',
    t.complexity
      ? `<span class="pill">Сложность: <code>${esc(t.complexity)}</code></span>`
      : '',
  ]
    .filter(Boolean)
    .join('');
    
  const sections = [
    [
      'Условие',
      'task',
      `<p class="task-desc">${esc(t.description || t.title)}</p>
       ${meta ? `<div class="task-meta">${meta}</div>` : ''}
       ${
         t.leetcodeUrl
           ? `<p><a class="ext-link" href="${esc(t.leetcodeUrl)}" target="_blank" rel="noopener noreferrer">LeetCode: ${esc(t.leetcodeLabel || t.title)} →</a></p>`
           : ''
       }`,
    ],
    [
      'Подход к решению',
      'approach',
      md(t.approach || t.algorithm || '—'),
    ],
  ];
  
  if (t.code) {
    sections.push([
      'Эталонный код',
      'code',
      `<pre><code class="language-java">${esc(t.code)}</code></pre>`,
    ]);
  }

  pushRecent('practice', num, t.title);
  setNavContext('practice', prev?.num ?? null, next?.num ?? null);

  hideElement(listView);
  hideElement(hero);
  showElement(detailView);
  
  detailView.innerHTML = detailShell(
    'practice',
    t.num,
    `Задача ${t.num}`,
    t.categoryTitle,
    t.title,
    sections,
    prev ? { id: prev.num, title: prev.title, kind: 'practice' } : null,
    next ? { id: next.num, title: next.title, kind: 'practice' } : null,
    { toolbar: detailToolbar('practice', t.num) }
  );
  
  bindDetailNav();
  bindDetailToolbar('practice', num, t);
  location.hash = `p-${num}`;
}

function detailToolbar(kind, id, opts = {}) {
  const learned = kind === 'theory' && isLearned(id);
  const fav = isFavorite(kind, id);
  const mock = opts.mock && kind === 'theory';
  
  return `
    <div class="detail-toolbar" data-kind="${kind}" data-id="${id}" role="toolbar" aria-label="Инструменты">
      ${kind === 'theory' ? `<button type="button" class="tool-btn${learned ? ' active' : ''}" data-tool="learned" title="Выучено" aria-pressed="${learned}">✓ Выучено</button>` : ''}
      <button type="button" class="tool-btn${fav ? ' active-fav' : ''}" data-tool="favorite" title="Избранное" aria-pressed="${fav}">★ Избранное</button>
      <button type="button" class="tool-btn" data-tool="copy-link" title="Копировать ссылку">🔗 Ссылка</button>
      <button type="button" class="tool-btn" data-tool="copy-answer" title="Копировать содержимое">📋 Копировать</button>
      ${mock ? `<button type="button" class="tool-btn tool-btn-mock" data-tool="reveal">Показать ответ</button>` : ''}
    </div>
  `;
}

function bindDetailToolbar(kind, id, qOrTask, opts = {}) {
  const bar = detailView.querySelector('.detail-toolbar');
  if (!bar) return;
  
  bar.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool === 'learned' && kind === 'theory') {
        toggleLearned(id);
        renderSidebar();
        showTheoryDetail(id, getCurrentDetailOpts());
      } else if (tool === 'favorite') {
        toggleFavorite(kind, id);
        if (kind === 'theory') showTheoryDetail(id, getCurrentDetailOpts());
        else showPracticeDetail(id);
      } else if (tool === 'copy-link') {
        copyText(itemUrl(kind, id));
      } else if (tool === 'copy-answer') {
        const text =
          kind === 'theory'
            ? qOrTask.answer
            : [qOrTask.description, qOrTask.approach, qOrTask.code].filter(Boolean).join('\n\n');
        copyText(text);
      } else if (tool === 'reveal') {
        setMockHidden(false);
        detailView.querySelector('.detail-block.answer')?.classList.remove('answer-hidden');
        btn.hidden = true;
      }
    });
  });
}

function renderSources(sources) {
  const list = (sources || []).filter((s) => s && s.url);
  if (!list.length) {
    return '<p class="muted">Ссылки на источники будут добавлены.</p>';
  }
  return (
    '<ul class="source-list">' +
    list
      .map(
        (s) =>
          `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`
      )
      .join('') +
    '</ul>'
  );
}

function detailShell(kind, id, badge, block, title, sections, prev, next, extra = {}) {
  const mockHidden = isMockHidden();
  
  return `
    <button type="button" class="back-btn" id="back-btn" aria-label="Вернуться к списку">← К списку</button>
    <header class="detail-header">
      <div class="card-meta">
        <span class="tag ${kind === 'theory' ? 'tag-theory' : 'tag-practice'}">${esc(badge)}</span>
        <span class="tag">${esc(block)}</span>
      </div>
      <h2>${esc(title)}</h2>
    </header>
    ${extra.toolbar || ''}
    ${sections
      .map(([h, cls, body]) => {
        const hide = cls === 'answer' && extra.mock && mockHidden;
        return `<section class="detail-block ${cls}${hide ? ' answer-hidden' : ''}"${hide ? ' hidden' : ''}><h3>${h}</h3><div class="detail-body">${body}</div></section>`;
      })
      .join('')}
    <nav class="detail-nav" aria-label="Навигация">
      <button type="button" class="nav-prev" data-nav-id="${prev?.id ?? ''}" ${prev ? '' : 'disabled'} aria-label="${prev ? `Предыдущий: #${prev.id}` : 'Нет предыдущего'}">${prev ? `← #${prev.id} ${esc(snippet(prev.title, 35))}` : '—'}</button>
      <button type="button" class="nav-next" data-nav-id="${next?.id ?? ''}" ${next ? '' : 'disabled'} aria-label="${next ? `Следующий: #${next.id}` : 'Нет следующего'}">${next ? `${esc(snippet(next.title, 35))} #${next.id} →` : '—'}</button>
    </nav>
  `;
}

function bindDetailNav() {
  $('#back-btn')?.addEventListener('click', () => {
    const section = getSection();
    const filterBlock = getFilterBlock();
    const filterCategory = getFilterCategory();
    
    if (section === 'theory') {
      if (filterBlock) onSidebarClick(filterBlock);
      else onSidebarClick('all');
    } else if (filterCategory) {
      onSidebarClick(filterCategory);
    } else {
      onSidebarClick('all');
    }
  });
  
  const prev = detailView.querySelector('.nav-prev');
  const next = detailView.querySelector('.nav-next');
  
  prev?.addEventListener('click', () => {
    if (prev.disabled) return;
    const nid = parseInt(prev.dataset.navId, 10);
    if (!nid) return;
    const navContext = getNavContext();
    navContext.kind === 'theory' ? showTheoryDetail(nid) : showPracticeDetail(nid);
  });
  
  next?.addEventListener('click', () => {
    if (next.disabled) return;
    const nid = parseInt(next.dataset.navId, 10);
    if (!nid) return;
    const navContext = getNavContext();
    navContext.kind === 'theory' ? showTheoryDetail(nid) : showPracticeDetail(nid);
  });
}

// ============================================================================
// Методология
// ============================================================================

function showMethodology() {
  const m = practice.methodology;
  hideElement(hero);
  showElement(detailView);
  hideElement(listView);
  
  detailView.innerHTML = `
    <button type="button" class="back-btn" id="back-btn" aria-label="Вернуться к практике">← К практике</button>
    <header class="detail-header"><h2>${esc(m.title)}</h2></header>
    <section class="detail-block"><h3>Этапы</h3><ol class="steps">${m.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section>
    <section class="detail-block"><h3>Паттерны</h3><p class="chips">${m.patterns.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</p></section>
    <section class="detail-block sources"><h3>Полезные ссылки</h3>
      <ul class="source-list">
        <li><a href="https://leetcode.com/problemset/" target="_blank" rel="noopener noreferrer">LeetCode Problem Set</a></li>
        <li><a href="https://neetcode.io/roadmap" target="_blank" rel="noopener noreferrer">NeetCode Roadmap</a></li>
      </ul>
    </section>
  `;
  
  $('#back-btn')?.addEventListener('click', () => {
    setSectionState('practice');
    onSidebarClick('all');
  });
}

// Запуск приложения
init();
