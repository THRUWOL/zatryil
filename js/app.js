(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const searchInput = $("#search");
  const searchClearBtn = $("#search-clear");
  const sectionTabs = $("#section-tabs");
  const sidebarNav = $("#sidebar-nav");
  const hero = $("#hero");
  const listView = $("#list-view");
  const detailView = $("#detail-view");
  const toastEl = $("#toast");
  const shortcutsDialog = $("#shortcuts-dialog");

  const LS_LEARNED = "jm_learned";
  const LS_FAVORITE = "jm_favorite";
  const LS_RECENT = "jm_recent";
  const RECENT_MAX = 10;

  let theory = { questions: [], blocks: [] };
  let practice = { categories: [], tasks: [], methodology: {}, plan14: [] };
  let section = "theory"; // theory | practice | plan
  let fuseTheory = null;
  let fusePractice = null;
  let filterBlock = null;
  let filterCategory = null;
  let navContext = { kind: null, prevId: null, nextId: null };
  let mockHidden = false;
  let currentDetailOpts = {};

  marked.setOptions({ breaks: true, gfm: true });

  function md(t) {
    return t ? marked.parse(t) : "";
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function snippet(t, n = 140) {
    const p = (t || "").replace(/\*\*/g, "").replace(/`/g, "");
    return p.length > n ? p.slice(0, n) + "…" : p;
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

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

  function favKey(kind, id) {
    return `${kind}:${id}`;
  }

  function isLearned(id) {
    return loadJson(LS_LEARNED, []).includes(id);
  }

  function isFavorite(kind, id) {
    return loadJson(LS_FAVORITE, []).includes(favKey(kind, id));
  }

  function toggleLearned(id) {
    const set = loadJson(LS_LEARNED, []);
    const i = set.indexOf(id);
    if (i >= 0) set.splice(i, 1);
    else set.push(id);
    saveJson(LS_LEARNED, set);
    return set.length;
  }

  function toggleFavorite(kind, id) {
    const key = favKey(kind, id);
    const set = loadJson(LS_FAVORITE, []);
    const i = set.indexOf(key);
    if (i >= 0) set.splice(i, 1);
    else set.push(key);
    saveJson(LS_FAVORITE, set);
    return set.includes(key);
  }

  function learnedCount() {
    return loadJson(LS_LEARNED, []).length;
  }

  function pushRecent(kind, id, title) {
    let list = loadJson(LS_RECENT, []);
    list = list.filter((x) => !(x.kind === kind && x.id === id));
    list.unshift({ kind, id, title });
    saveJson(LS_RECENT, list.slice(0, RECENT_MAX));
  }

  function getRecent() {
    return loadJson(LS_RECENT, []);
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightHtml(text, query) {
    if (!query || !text) return esc(text);
    const terms = query.trim().split(/\s+/).filter((t) => t.length > 1);
    if (!terms.length) return esc(text);
    let html = esc(text);
    terms.forEach((term) => {
      const re = new RegExp(`(${escapeRegex(term)})`, "gi");
      html = html.replace(re, "<mark class=\"hl\">$1</mark>");
    });
    return html;
  }

  function itemUrl(kind, id) {
    return `${location.origin}${location.pathname}#${kind === "theory" ? "q" : "p"}-${id}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Скопировано");
    } catch {
      toast("Не удалось скопировать");
    }
  }

  function updateSearchClear() {
    const active = !!searchInput.value.trim();
    if (searchClearBtn) searchClearBtn.hidden = !active;
  }

  function clearSearch() {
    searchInput.value = "";
    updateSearchClear();
    if (section === "theory") {
      filterBlock ? onSidebarClick(filterBlock) : onSidebarClick("all");
    } else if (section === "practice") {
      filterCategory ? onSidebarClick(filterCategory) : onSidebarClick("all");
    } else {
      goHome();
    }
    location.hash = section === "theory" ? "home" : section;
  }

  function renderRecentBlock() {
    const recent = getRecent();
    if (!recent.length) return "";
    return (
      `<div class="sidebar-recent">
        <p class="nav-label">Недавние</p>
        ${recent
          .map(
            (r) =>
              `<button type="button" class="recent-item" data-recent-kind="${r.kind}" data-recent-id="${r.id}">#${r.id} ${esc(snippet(r.title, 42))}</button>`
          )
          .join("")}
      </div>`
    );
  }

  function bindRecentClicks() {
    sidebarNav.querySelectorAll(".recent-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.recentKind;
        const id = parseInt(btn.dataset.recentId, 10);
        if (kind === "theory") {
          setSection("theory");
          showTheoryDetail(id);
        } else {
          setSection("practice");
          showPracticeDetail(id);
        }
      });
    });
  }

  function showRandomMock() {
    const qs = theory.questions;
    if (!qs.length) return;
    const q = qs[Math.floor(Math.random() * qs.length)];
    setSection("theory");
    showTheoryDetail(q.id, { mock: true });
  }

  async function load() {
    const [rq, rp] = await Promise.all([
      fetch("data/questions.json"),
      fetch("data/practice.json"),
    ]);
    if (!rq.ok || !rp.ok) {
      throw new Error(
        "Не удалось загрузить data/*.json — откройте сайт через локальный сервер или GitHub Pages, не как file://"
      );
    }
    const [tq, tp] = await Promise.all([rq.json(), rp.json()]);
    theory = tq;
    practice = tp;

    fuseTheory = new Fuse(theory.questions, {
      keys: ["title", "answer", "searchText", "blockShortName"],
      threshold: 0.38,
      ignoreLocation: true,
    });
    fusePractice = new Fuse(practice.tasks, {
      keys: [
        "title",
        "description",
        "approach",
        "pattern",
        "searchText",
        "categoryTitle",
      ],
      threshold: 0.38,
      ignoreLocation: true,
    });

    bindSectionTabs();
    bindGlobalUi();
    renderSidebar();
    renderHero();
    handleHash();
  }

  function bindGlobalUi() {
    searchClearBtn?.addEventListener("click", clearSearch);
    $("#shortcuts-btn")?.addEventListener("click", () => shortcutsDialog?.showModal());
    searchInput.addEventListener("input", updateSearchClear);
  }

  function bindSectionTabs() {
    sectionTabs.querySelectorAll(".section-tab").forEach((btn) => {
      btn.addEventListener("click", () => setSection(btn.dataset.section));
    });
    $("#brand-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      setSection("theory");
      goHome();
    });
  }

  function setSection(s) {
    section = s;
    filterBlock = null;
    filterCategory = null;
    searchInput.value = "";
    updateSearchClear();
    sectionTabs.querySelectorAll(".section-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.section === s);
    });
    renderSidebar();
    renderHero();
    hideDetail();
    listView.hidden = true;
    hero.hidden = false;
    location.hash = s === "theory" ? "home" : s;
  }

  function renderSidebar() {
    if (section === "theory") {
      const blocks = theory.blocks.filter((b) => b.id !== 12);
      const learned = learnedCount();
      const total = theory.questions.length;
      sidebarNav.innerHTML =
        `<p class="nav-progress">Выучено: ${learned}/${total}</p>` +
        `<button type="button" class="nav-item nav-item-random" data-nav="random">🎲 Случайный вопрос</button>` +
        renderRecentBlock() +
        `<p class="nav-label">Блоки теории · ${total} вопр.</p>` +
        navBtn("all", "Все вопросы", !filterBlock) +
        blocks
          .map((b) =>
            navBtn(b.id, `${b.id}. ${esc(b.shortName || b.name)}`, filterBlock === b.id)
          )
          .join("");
    } else if (section === "practice") {
      sidebarNav.innerHTML =
        `<p class="nav-label">Категории · ${practice.tasks.length} задач</p>` +
        navBtn("all", "Все задачи", true) +
        navBtn("method", "Методология", false) +
        practice.categories
          .map((c) => navBtn(c.id, c.title, false, practiceBadge(c.id)))
          .join("");
    } else {
      sidebarNav.innerHTML =
        `<p class="nav-label">Подготовка 14 дней</p>` +
        navBtn("plan", "Календарь", true) +
        navBtn("patterns", "Паттерны алгоритмов", false);
    }
    sidebarNav.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.nav === "random") showRandomMock();
        else onSidebarClick(btn.dataset.nav);
      });
    });
    bindRecentClicks();
  }

  function navBtn(id, label, active, badge = "") {
    return `<button type="button" class="nav-item${active ? " active" : ""}" data-nav="${id}">${badge}${esc(label)}</button>`;
  }

  function practiceBadge(id) {
    const icons = {
      hashmap: "🗂",
      window: "↔",
      intervals: "📊",
      graph: "🌐",
      strings: "Aa",
      java: "☕",
    };
    const ic = icons[id] || "•";
    return `<span class="nav-icon">${ic}</span>`;
  }

  function onSidebarClick(nav) {
    searchInput.value = "";
    updateSearchClear();
    if (section === "theory") {
      filterBlock = nav === "all" ? null : parseInt(nav, 10);
      setNavActive(nav);
      if (filterBlock) showTheoryList(theory.questions.filter((q) => q.block === filterBlock));
      else showTheoryList(theory.questions);
    } else if (section === "practice") {
      setNavActive(nav);
      if (nav === "method") showMethodology();
      else if (nav === "all") showPracticeList(practice.tasks);
      else {
        filterCategory = nav;
        const cat = practice.categories.find((c) => c.id === nav);
        showPracticeList(cat ? cat.tasks : practice.tasks);
      }
    } else {
      setNavActive(nav);
      if (nav === "patterns") showPatterns();
      else showPlan();
    }
  }

  function setNavActive(nav) {
    sidebarNav.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.nav === String(nav));
    });
  }

  function renderHero() {
    if (section === "theory") {
      hero.innerHTML = `
        <span class="hero-badge hero-badge-theory">Теория</span>
        <h2>91 вопрос с ответами</h2>
        <p>Java Core, Spring, SQL, Kafka — 91 вопрос по темам Middle. Развёрнутые ответы и ссылки на официальную документацию и спецификации.</p>
        <div class="hero-actions">
          <button type="button" class="btn-primary" data-action="random-mock">🎲 Случайный вопрос</button>
          <button type="button" class="btn-secondary" data-action="all-theory">Все вопросы</button>
        </div>`;
    } else if (section === "practice") {
      hero.innerHTML = `
        <span class="hero-badge hero-badge-practice">Практика</span>
        <h2>32 задачи: LeetCode и собесы</h2>
        <p>Алгоритмы, live-coding, Java-специфика и SQL. С эталонным кодом и ссылками на LeetCode.</p>
        <div class="hero-actions">
          <button type="button" class="btn-primary" data-action="method">Методология решения</button>
          <button type="button" class="btn-secondary" data-action="all-practice">Все задачи</button>
        </div>`;
    } else {
      hero.innerHTML = `
        <span class="hero-badge hero-badge-plan">План</span>
        <h2>Интенсив 14 дней</h2>
        <p>Чередуйте теорию (блоки 1–11) и практику по дням. День 14 — мок-собеседование.</p>
        <div class="hero-actions">
          <button type="button" class="btn-primary" data-action="plan">Открыть календарь</button>
        </div>`;
    }
    hero.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.action;
        if (a === "random-mock") showRandomMock();
        if (a === "all-theory") onSidebarClick("all");
        if (a === "method") {
          setSection("practice");
          onSidebarClick("method");
        }
        if (a === "all-practice") onSidebarClick("all");
        if (a === "plan") {
          setSection("plan");
          onSidebarClick("plan");
        }
      });
    });
  }

  function hideDetail() {
    detailView.hidden = true;
  }

  function showList(html) {
    hero.hidden = true;
    detailView.hidden = true;
    listView.hidden = false;
    listView.innerHTML = html;
    bindListCards();
  }

  function goHome() {
    hero.hidden = false;
    listView.hidden = true;
    detailView.hidden = true;
  }

  function showTheoryList(items, title) {
    const hdr = title || `Вопросы · ${items.length}`;
    let body = "";
    const grouped =
      section === "theory" &&
      !filterBlock &&
      !searchInput.value.trim() &&
      items.length > 15;
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
          body += g.items.map((q) => cardTheory(q)).join("");
        });
    } else {
      body = items.map((q) => cardTheory(q)).join("");
    }
    showList(`<p class="list-header">${esc(hdr)}</p>` + body);
  }

  function showPracticeList(items, title) {
    const hdr = title || `Задачи · ${items.length}`;
    showList(
      `<p class="list-header">${esc(hdr)}</p>` +
        items.map((t) => cardPractice(t)).join("")
    );
  }

  function cardTheory(q, opts = {}) {
    const hl = opts.highlight;
    const learned = isLearned(q.id);
    const fav = isFavorite("theory", q.id);
    const cardCls = ["card", learned ? "card-learned" : "", fav ? "card-fav" : ""]
      .filter(Boolean)
      .join(" ");
    return `<a class="${cardCls}" href="#q-${q.id}" data-kind="theory" data-id="${q.id}">
      <div class="card-meta">
        <span class="tag tag-theory">#${q.id}</span>
        <span class="tag">${esc(q.blockShortName || `Блок ${q.block}`)}</span>
        ${learned ? '<span class="tag tag-learned">✓</span>' : ""}
        ${fav ? '<span class="tag tag-fav">★</span>' : ""}
      </div>
      <h3>${hl ? highlightHtml(q.title, hl) : esc(q.title)}</h3>
      <p>${hl ? highlightHtml(snippet(q.answer), hl) : esc(snippet(q.answer))}</p>
    </a>`;
  }

  function cardPractice(t, opts = {}) {
    const hl = opts.highlight;
    const lc = t.leetcodeUrl
      ? `<span class="tag tag-lc">LeetCode</span>`
      : `<span class="tag tag-interview">Собес</span>`;
    const pattern = t.pattern
      ? `<span class="tag tag-pattern">${esc(t.pattern)}</span>`
      : "";
    const fav = isFavorite("practice", t.num);
    return `<a class="card card-practice${fav ? " card-fav" : ""}" href="#p-${t.num}" data-kind="practice" data-id="${t.num}">
      <div class="card-meta"><span class="tag tag-practice">${esc(t.categoryTitle)}</span>${pattern}${lc}${fav ? '<span class="tag tag-fav">★</span>' : ""}</div>
      <h3>${hl ? highlightHtml(t.title, hl) : esc(t.title)}</h3>
      <p class="card-desc">${hl ? highlightHtml(snippet(t.description || t.approach || t.title, 160), hl) : esc(snippet(t.description || t.approach || t.title, 160))}</p>
      ${t.complexity ? `<p class="card-complexity">Сложность: <code>${esc(t.complexity)}</code></p>` : ""}
    </a>`;
  }

  function detailToolbar(kind, id, opts = {}) {
    const learned = kind === "theory" && isLearned(id);
    const fav = isFavorite(kind, id);
    const mock = opts.mock && kind === "theory";
    return `<div class="detail-toolbar" data-kind="${kind}" data-id="${id}">
      ${kind === "theory" ? `<button type="button" class="tool-btn${learned ? " active" : ""}" data-tool="learned" title="Выучено">✓ Выучено</button>` : ""}
      <button type="button" class="tool-btn${fav ? " active-fav" : ""}" data-tool="favorite" title="Избранное">★ Избранное</button>
      <button type="button" class="tool-btn" data-tool="copy-link">🔗 Ссылка</button>
      <button type="button" class="tool-btn" data-tool="copy-answer">📋 Копировать</button>
      ${mock ? `<button type="button" class="tool-btn tool-btn-mock" data-tool="reveal">Показать ответ</button>` : ""}
    </div>`;
  }

  function bindDetailToolbar(kind, id, qOrTask, opts = {}) {
    const bar = detailView.querySelector(".detail-toolbar");
    if (!bar) return;
    bar.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.dataset.tool;
        if (tool === "learned" && kind === "theory") {
          toggleLearned(id);
          renderSidebar();
          showTheoryDetail(id, currentDetailOpts);
        } else if (tool === "favorite") {
          toggleFavorite(kind, id);
          if (kind === "theory") showTheoryDetail(id, currentDetailOpts);
          else showPracticeDetail(id);
        } else if (tool === "copy-link") {
          copyText(itemUrl(kind, id));
        } else if (tool === "copy-answer") {
          const text =
            kind === "theory"
              ? qOrTask.answer
              : [qOrTask.description, qOrTask.approach, qOrTask.code].filter(Boolean).join("\n\n");
          copyText(text);
        } else if (tool === "reveal") {
          mockHidden = false;
          detailView.querySelector(".detail-block.answer")?.classList.remove("answer-hidden");
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
        .join("") +
      "</ul>"
    );
  }

  function bindListCards() {
    listView.querySelectorAll(".card").forEach((c) => {
      c.addEventListener("click", (e) => {
        e.preventDefault();
        if (c.dataset.kind === "theory") showTheoryDetail(parseInt(c.dataset.id, 10));
        else showPracticeDetail(parseInt(c.dataset.id, 10));
      });
    });
  }

  function showTheoryDetail(id, opts = {}) {
    const q = theory.questions.find((x) => x.id === id);
    if (!q) return;
    const idx = theory.questions.findIndex((x) => x.id === id);
    const prev = theory.questions[idx - 1];
    const next = theory.questions[idx + 1];
    currentDetailOpts = opts;
    mockHidden = !!opts.mock;
    pushRecent("theory", id, q.title);
    navContext = {
      kind: "theory",
      prevId: prev?.id ?? null,
      nextId: next?.id ?? null,
    };

    listView.hidden = true;
    hero.hidden = true;
    detailView.hidden = false;
    detailView.innerHTML = detailShell(
      "theory",
      q.id,
      opts.mock ? `Мок · вопрос ${q.id}` : `Вопрос ${q.id}`,
      q.blockTitle,
      q.title,
      [
        ["Ответ", "answer", md(q.answer)],
        ["Источники", "sources", renderSources(q.sources)],
      ],
      prev ? { id: prev.id, title: prev.title, kind: "theory" } : null,
      next ? { id: next.id, title: next.title, kind: "theory" } : null,
      { mock: opts.mock, toolbar: detailToolbar("theory", id, { mock: opts.mock }) }
    );
    bindDetailNav();
    bindDetailToolbar("theory", id, q, opts);
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
      t.pattern ? `<span class="pill">Паттерн: ${esc(t.pattern)}</span>` : "",
      t.complexity
        ? `<span class="pill">Сложность: <code>${esc(t.complexity)}</code></span>`
        : "",
    ]
      .filter(Boolean)
      .join("");
    const sections = [
      [
        "Условие",
        "task",
        `<p class="task-desc">${esc(t.description || t.title)}</p>
         ${meta ? `<div class="task-meta">${meta}</div>` : ""}
         ${
           t.leetcodeUrl
             ? `<p><a class="ext-link" href="${esc(t.leetcodeUrl)}" target="_blank" rel="noopener noreferrer">LeetCode: ${esc(t.leetcodeLabel || t.title)} →</a></p>`
             : ""
         }`,
      ],
      [
        "Подход к решению",
        "approach",
        md(t.approach || t.algorithm || "—"),
      ],
    ];
    if (t.code) {
      sections.push([
        "Эталонный код",
        "code",
        `<pre><code class="language-java">${esc(t.code)}</code></pre>`,
      ]);
    }

    pushRecent("practice", num, t.title);
    navContext = {
      kind: "practice",
      prevId: prev?.num ?? null,
      nextId: next?.num ?? null,
    };

    listView.hidden = true;
    hero.hidden = true;
    detailView.hidden = false;
    detailView.innerHTML = detailShell(
      "practice",
      t.num,
      `Задача ${t.num}`,
      t.categoryTitle,
      t.title,
      sections,
      prev ? { id: prev.num, title: prev.title, kind: "practice" } : null,
      next ? { id: next.num, title: next.title, kind: "practice" } : null,
      { toolbar: detailToolbar("practice", t.num) }
    );
    bindDetailNav();
    bindDetailToolbar("practice", num, t);
    location.hash = `p-${num}`;
  }

  function detailShell(kind, id, badge, block, title, sections, prev, next, extra = {}) {
    return `
      <button type="button" class="back-btn" id="back-btn">← К списку</button>
      <header class="detail-header">
        <div class="card-meta">
          <span class="tag ${kind === "theory" ? "tag-theory" : "tag-practice"}">${esc(badge)}</span>
          <span class="tag">${esc(block)}</span>
        </div>
        <h2>${esc(title)}</h2>
      </header>
      ${extra.toolbar || ""}
      ${sections
        .map(([h, cls, body]) => {
          const hide = cls === "answer" && extra.mock && mockHidden;
          return `<section class="detail-block ${cls}${hide ? " answer-hidden" : ""}"><h3>${h}</h3><div class="detail-body">${body}</div></section>`;
        })
        .join("")}
      <nav class="detail-nav">
        <button type="button" class="nav-prev" data-nav-id="${prev?.id ?? ""}" ${prev ? "" : "disabled"}>${prev ? `← #${prev.id} ${esc(snippet(prev.title, 35))}` : "—"}</button>
        <button type="button" class="nav-next" data-nav-id="${next?.id ?? ""}" ${next ? "" : "disabled"}>${next ? `${esc(snippet(next.title, 35))} #${next.id} →` : "—"}</button>
      </nav>`;
  }

  function bindDetailNav() {
    $("#back-btn")?.addEventListener("click", () => {
      if (section === "theory") {
        if (filterBlock) onSidebarClick(filterBlock);
        else onSidebarClick("all");
      } else if (filterCategory) onSidebarClick(filterCategory);
      else onSidebarClick("all");
    });
    const prev = detailView.querySelector(".nav-prev");
    const next = detailView.querySelector(".nav-next");
    prev?.addEventListener("click", () => {
      if (prev.disabled) return;
      const nid = parseInt(prev.dataset.navId, 10);
      if (!nid) return;
      navContext.kind === "theory" ? showTheoryDetail(nid) : showPracticeDetail(nid);
    });
    next?.addEventListener("click", () => {
      if (next.disabled) return;
      const nid = parseInt(next.dataset.navId, 10);
      if (!nid) return;
      navContext.kind === "theory" ? showTheoryDetail(nid) : showPracticeDetail(nid);
    });
  }

  function showMethodology() {
    const m = practice.methodology;
    hero.hidden = true;
    detailView.hidden = false;
    listView.hidden = true;
    detailView.innerHTML = `
      <button type="button" class="back-btn" id="back-btn">← К практике</button>
      <header class="detail-header"><h2>${esc(m.title)}</h2></header>
      <section class="detail-block"><h3>Этапы</h3><ol class="steps">${m.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
      <section class="detail-block"><h3>Паттерны</h3><p class="chips">${m.patterns.map((p) => `<span class="chip">${esc(p)}</span>`).join("")}</p></section>
      <section class="detail-block sources"><h3>Полезные ссылки</h3>
        <ul class="source-list">
          <li><a href="https://leetcode.com/problemset/" target="_blank" rel="noopener noreferrer">LeetCode Problem Set</a></li>
          <li><a href="https://neetcode.io/roadmap" target="_blank" rel="noopener noreferrer">NeetCode Roadmap</a></li>
        </ul>
      </section>`;
    $("#back-btn")?.addEventListener("click", () => {
      setSection("practice");
      onSidebarClick("all");
    });
  }

  function showPatterns() {
    const m = practice.methodology;
    showList(
      `<p class="list-header">Паттерны алгоритмов</p>
      <div class="pattern-grid">${m.patterns
        .map(
          (p) =>
            `<div class="pattern-card"><h3>${esc(p)}</h3><p>Ищите задачи в разделе «Практика» или через поиск.</p></div>`
        )
        .join("")}</div>`

    );
  }

  function showPlan() {
    hero.hidden = true;
    detailView.hidden = true;
    listView.hidden = false;
    let html = `<p class="list-header">План на 14 дней</p><div class="plan-grid">`;
    practice.plan14.forEach((d) => {
      const isTheory = d.day <= 11 && ![8, 9, 12, 13].includes(d.day);
      const type = d.day >= 12 && d.day <= 13 ? "practice" : d.day === 14 ? "mock" : d.day <= 7 ? "mixed" : "theory";
      html += `<div class="plan-day plan-${type}">
        <span class="plan-num">День ${d.day}</span>
        <p>${esc(d.tasks)}</p>
        <div class="plan-links">
          ${d.day <= 11 ? `<button type="button" class="plan-link" data-goto="theory">Теория</button>` : ""}
          <button type="button" class="plan-link" data-goto="practice">Практика</button>
        </div>
      </div>`;
    });
    html += `</div>`;
    if (practice.extras?.length) {
      html += `<p class="list-header">Дополнительно</p>`;
      practice.extras.forEach((e) => {
        html += `<a class="card" href="${esc(e.url)}" target="_blank" rel="noopener"><h3>${esc(e.title)}</h3><p>${esc(e.note)}</p></a>`;
      });
    }
    listView.innerHTML = html;
    listView.querySelectorAll("[data-goto]").forEach((b) => {
      b.addEventListener("click", () => setSection(b.dataset.goto));
    });
  }

  function runSearch(q) {
    const query = (q || "").trim();
    updateSearchClear();
    if (!query) {
      clearSearch();
      return;
    }
    const tRes = fuseTheory.search(query).map((r) => r.item);
    const pRes = fusePractice.search(query).map((r) => r.item);
    hero.hidden = true;
    detailView.hidden = true;
    listView.hidden = false;
    listView.innerHTML =
      `<div class="list-header-row">
        <span class="list-header">Поиск: «${esc(query)}» — теория ${tRes.length}, практика ${pRes.length}</span>
        <button type="button" class="chip-clear" id="list-search-clear">✕ Сбросить</button>
      </div>` +
      (tRes.length ? `<h4 class="list-sub">Теория</h4>` + tRes.map((x) => cardTheory(x, { highlight: query })).join("") : "") +
      (pRes.length ? `<h4 class="list-sub">Практика</h4>` + pRes.map((x) => cardPractice(x, { highlight: query })).join("") : "") +
      (!tRes.length && !pRes.length ? `<p class="empty">Ничего не найдено</p>` : "");
    $("#list-search-clear")?.addEventListener("click", clearSearch);
    bindListCards();
    location.hash = `search-${encodeURIComponent(q)}`;
  }

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const v = searchInput.value;
    updateSearchClear();
    searchTimer = setTimeout(() => {
      if (v.trim()) runSearch(v);
      else clearSearch();
    }, 200);
  });

  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    const typing = tag === "INPUT" || tag === "TEXTAREA";

    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === "?" && !typing) {
      e.preventDefault();
      shortcutsDialog?.showModal();
    }
    if (e.key === "Escape") {
      if (searchInput.value.trim()) {
        clearSearch();
      } else {
        goHome();
      }
    }
    if (!typing && !detailView.hidden) {
      if (e.key === "ArrowLeft" && navContext.prevId) {
        e.preventDefault();
        navContext.kind === "theory"
          ? showTheoryDetail(navContext.prevId)
          : showPracticeDetail(navContext.prevId);
      }
      if (e.key === "ArrowRight" && navContext.nextId) {
        e.preventDefault();
        navContext.kind === "theory"
          ? showTheoryDetail(navContext.nextId)
          : showPracticeDetail(navContext.nextId);
      }
    }
  });

  function handleHash() {
    const h = location.hash.slice(1);
    if (h.startsWith("q-")) {
      setSection("theory");
      showTheoryDetail(parseInt(h.slice(2), 10));
    } else if (h.startsWith("p-")) {
      setSection("practice");
      showPracticeDetail(parseInt(h.slice(2), 10));
    } else if (h === "practice") setSection("practice");
    else if (h === "plan") setSection("plan");
    else if (h.startsWith("search-")) {
      searchInput.value = decodeURIComponent(h.slice(7));
      runSearch(searchInput.value);
    }
  }

  window.addEventListener("hashchange", handleHash);

  load().catch((err) => {
    hero.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  });
})();
