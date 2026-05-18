(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const searchInput = $("#search");
  const sectionTabs = $("#section-tabs");
  const sidebarNav = $("#sidebar-nav");
  const hero = $("#hero");
  const listView = $("#list-view");
  const detailView = $("#detail-view");

  let theory = { questions: [], blocks: [] };
  let practice = { categories: [], tasks: [], methodology: {}, plan14: [] };
  let section = "theory"; // theory | practice | plan
  let fuseTheory = null;
  let fusePractice = null;
  let filterBlock = null;
  let filterCategory = null;

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
    renderSidebar();
    renderHero();
    handleHash();
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
      sidebarNav.innerHTML =
        `<p class="nav-label">Блоки теории · ${theory.questions.length} вопр.</p>` +
        navBtn("all", "Все вопросы", true) +
        blocks
          .map((b) =>
            navBtn(b.id, `${b.id}. ${esc(b.shortName || b.name)}`)
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
      btn.addEventListener("click", () => onSidebarClick(btn.dataset.nav));
    });
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
          <button type="button" class="btn-primary" data-action="all-theory">Все вопросы</button>
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

  function cardTheory(q) {
    return `<a class="card" href="#q-${q.id}" data-kind="theory" data-id="${q.id}">
      <div class="card-meta"><span class="tag tag-theory">#${q.id}</span><span class="tag">${esc(q.blockShortName || `Блок ${q.block}`)}</span></div>
      <h3>${esc(q.title)}</h3>
      <p>${esc(snippet(q.answer))}</p>
    </a>`;
  }

  function cardPractice(t) {
    const lc = t.leetcodeUrl
      ? `<span class="tag tag-lc">LeetCode</span>`
      : `<span class="tag tag-interview">Собес</span>`;
    const pattern = t.pattern
      ? `<span class="tag tag-pattern">${esc(t.pattern)}</span>`
      : "";
    return `<a class="card card-practice" href="#p-${t.num}" data-kind="practice" data-id="${t.num}">
      <div class="card-meta"><span class="tag tag-practice">${esc(t.categoryTitle)}</span>${pattern}${lc}</div>
      <h3>${esc(t.title)}</h3>
      <p class="card-desc">${esc(snippet(t.description || t.approach || t.title, 160))}</p>
      ${t.complexity ? `<p class="card-complexity">Сложность: <code>${esc(t.complexity)}</code></p>` : ""}
    </a>`;
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

  function showTheoryDetail(id) {
    const q = theory.questions.find((x) => x.id === id);
    if (!q) return;
    const idx = theory.questions.findIndex((x) => x.id === id);
    const prev = theory.questions[idx - 1];
    const next = theory.questions[idx + 1];

    listView.hidden = true;
    hero.hidden = true;
    detailView.hidden = false;
    detailView.innerHTML = detailShell(
      "theory",
      q.id,
      `Вопрос ${q.id}`,
      q.blockTitle,
      q.title,
      [
        ["Ответ", "answer", md(q.answer)],
        ["Источники", "sources", renderSources(q.sources)],
      ],
      prev ? { id: prev.id, title: prev.title, kind: "theory" } : null,
      next ? { id: next.id, title: next.title, kind: "theory" } : null
    );
    bindDetailNav();
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
      next ? { id: next.num, title: next.title, kind: "practice" } : null
    );
    bindDetailNav();
    location.hash = `p-${num}`;
  }

  function detailShell(kind, id, badge, block, title, sections, prev, next) {
    return `
      <button type="button" class="back-btn" id="back-btn">← К списку</button>
      <header class="detail-header">
        <div class="card-meta">
          <span class="tag ${kind === "theory" ? "tag-theory" : "tag-practice"}">${esc(badge)}</span>
          <span class="tag">${esc(block)}</span>
        </div>
        <h2>${esc(title)}</h2>
      </header>
      ${sections.map(([h, cls, body]) => `<section class="detail-block ${cls}"><h3>${h}</h3><div class="detail-body">${body}</div></section>`).join("")}
      <nav class="detail-nav">
        <button type="button" class="nav-prev" ${prev ? "" : "disabled"}>${prev ? `← #${prev.id} ${esc(snippet(prev.title, 35))}` : "—"}</button>
        <button type="button" class="nav-next" ${next ? "" : "disabled"}>${next ? `${esc(snippet(next.title, 35))} #${next.id} →` : "—"}</button>
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
      const kind = section === "theory" || location.hash.startsWith("#q-") ? "theory" : "practice";
      const m = prev.textContent.match(/#(\d+)/);
      if (!m) return;
      kind === "theory" ? showTheoryDetail(parseInt(m[1], 10)) : showPracticeDetail(parseInt(m[1], 10));
    });
    next?.addEventListener("click", () => {
      if (next.disabled) return;
      const kind = location.hash.startsWith("#q-") ? "theory" : "practice";
      const m = next.textContent.match(/#(\d+)/);
      if (!m) return;
      kind === "theory" ? showTheoryDetail(parseInt(m[1], 10)) : showPracticeDetail(parseInt(m[1], 10));
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
    if (!query) {
      goHome();
      return;
    }
    const tRes = fuseTheory.search(query).map((r) => r.item);
    const pRes = fusePractice.search(query).map((r) => r.item);
    hero.hidden = true;
    detailView.hidden = true;
    listView.hidden = false;
    listView.innerHTML =
      `<p class="list-header">Поиск: «${esc(query)}» — теория ${tRes.length}, практика ${pRes.length}</p>` +
      (tRes.length ? `<h4 class="list-sub">Теория</h4>` + tRes.map((x) => cardTheory(x)).join("") : "") +
      (pRes.length ? `<h4 class="list-sub">Практика</h4>` + pRes.map((x) => cardPractice(x)).join("") : "") +
      (!tRes.length && !pRes.length ? `<p class="empty">Ничего не найдено</p>` : "");
    bindListCards();
    location.hash = `search-${encodeURIComponent(q)}`;
  }

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(searchInput.value), 200);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === "Escape") {
      searchInput.value = "";
      goHome();
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
