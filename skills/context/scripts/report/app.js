(() => {
  'use strict';

  const D = JSON.parse(document.getElementById('context-data').textContent);
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const href = (id) => '#/n/' + encodeURIComponent(id);

  const KINDS = {
    overview: { label: 'Overview', plural: 'Overview' },
    topic: { label: 'Topic', plural: 'Topics' },
    decision: { label: 'Decision', plural: 'Decisions' },
    doc: { label: 'Context document', plural: 'Documents' },
    asset: { label: 'Asset', plural: 'Assets' },
    file: { label: 'Repository file', plural: 'Files' },
  };
  const CLAIMS = [
    ['behavior', 'Current behavior'],
    ['requirement', 'Requirements'],
    ['proposal', 'Proposals'],
    ['question', 'Open questions'],
  ];
  const EDGE_LABELS = {
    references: ['References', 'Referenced by'],
    related: ['Related context', 'Decisions about this'],
    supersedes: ['Supersedes', 'Superseded by'],
    mentions: ['Mentions', 'Mentioned by'],
  };
  const ICONS = {
    home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
    decisions: '<path d="M5 4h14v16H5z"/><path d="m9 12 2 2 4-4"/>',
    questions: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".4"/>',
    diagnostics: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4"/><circle cx="12" cy="16.9" r=".4"/>',
    graph: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="m7.4 9.1 3.4 5.7M16.6 9.1l-3.4 5.7M8.5 7h7"/>',
  };
  const icon = (name) => `<svg class="nav-icon" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  const nodes = new Map(D.graph.nodes.map((n) => [n.id, n]));
  const adj = new Map();
  for (const e of D.graph.edges) {
    if (!adj.has(e.s)) adj.set(e.s, []);
    if (!adj.has(e.t)) adj.set(e.t, []);
    adj.get(e.s).push({ e, other: e.t, out: true });
    adj.get(e.t).push({ e, other: e.s, out: false });
  }
  const labelOf = (id) => D.pages[id]?.title ?? nodes.get(id)?.label ?? id;
  const kindOf = (id) => nodes.get(id)?.kind ?? D.pages[id]?.kind ?? 'file';
  const warnings = D.diagnostics.filter((d) => d.level !== 'info').length;

  // -------------------------------------------------------------------------
  // Pages

  const page = $('#page');

  function head({ eyebrow, kind, title, sub, meta }) {
    return `<header class="page-head">
      ${eyebrow ? `<div class="eyebrow${kind ? ' k-' + kind : ''}">${kind ? '<span class="dot"></span>' : ''}${eyebrow}</div>` : ''}
      <h1 class="page-title">${title}</h1>
      ${sub ? `<div class="page-sub">${sub}</div>` : ''}
      ${meta?.length ? `<div class="meta">${meta.filter(Boolean).join('')}</div>` : ''}
    </header>`;
  }

  function claimBar(claims, big) {
    const total = CLAIMS.reduce((n, [k]) => n + (claims?.[k] || 0), 0);
    if (!total) return '';
    const bar = CLAIMS.filter(([k]) => claims[k]).map(([k]) => `<span class="t-${k}" style="flex:${claims[k]}"></span>`).join('');
    const legend = big
      ? `<div class="claimlegend">${CLAIMS.filter(([k]) => claims[k]).map(([k, l]) => `<span class="t-${k}"><i></i>${claims[k]} ${l.toLowerCase()}</span>`).join('')}</div>`
      : '';
    return `<div class="claimbar${big ? ' big' : ''}" title="${CLAIMS.filter(([k]) => claims[k]).map(([k, l]) => `${claims[k]} ${l.toLowerCase()}`).join(', ')}">${bar}</div>${legend}`;
  }

  function statusPill(p) {
    return `<span class="status status-${esc(p.status)}">${esc(p.status === 'unknown' ? 'No status' : p.status)}</span>`;
  }

  function decisionCard(id) {
    const p = D.pages[id];
    const body = p.fields.decision || '';
    return `<li class="${p.status === 'superseded' ? 'superseded' : ''}"><a class="dcard" href="${href(id)}">
      <div class="dcard-top"><span>${esc(p.date || 'Undated')}</span>${statusPill(p)}</div>
      <div class="dcard-title">${esc(p.title)}</div>
      ${body ? `<div class="dcard-body">${stripLinks(body)}</div>` : ''}
    </a></li>`;
  }

  // Cards are links themselves, so nested anchors are flattened to text.
  function stripLinks(html) {
    return html.replace(/<a\b[^>]*>/g, '<span>').replace(/<\/a>/g, '</span>');
  }

  function connections(id) {
    const list = adj.get(id) || [];
    if (!list.length) return '';
    const groups = new Map();
    for (const c of list) {
      const label = (EDGE_LABELS[c.e.type] || [c.e.type, c.e.type])[c.out ? 0 : 1];
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(c);
    }
    let html = '<section class="connections"><h2>Connections</h2>';
    for (const [label, items] of groups) {
      html += `<div class="conn-group"><div class="conn-label">${esc(label)}</div>`;
      for (const c of items) {
        const k = kindOf(c.other);
        const n = nodes.get(c.other);
        html += `<a class="conn k-${k}" href="${href(c.other)}">
          <div class="conn-head"><span class="dot${n?.exists === false ? ' ring' : ''}"></span>${esc(labelOf(c.other))}<span class="conn-kind">${esc(KINDS[k]?.label ?? k)}${n?.exists === false ? ', missing' : ''}</span></div>
          ${c.e.evidence.map((ev) => `<div class="conn-ev">${esc(ev)}</div>`).join('')}
        </a>`;
      }
      html += '</div>';
    }
    return html + '</section>';
  }

  function homePage() {
    const o = D.pages.overview;
    const st = D.stats;
    const diagClass = D.diagnostics.some((d) => d.level === 'error') ? 'error' : warnings ? 'warn' : '';
    let html = head({
      eyebrow: 'Project context',
      title: esc(D.title),
      sub: D.subtitle ? esc(D.subtitle) : '',
      meta: [
        `<span><code>${esc(D.contextPath)}/</code></span>`,
        o?.updated ? `<span>Overview updated ${esc(o.updated)}</span>` : '',
      ],
    });
    html += `<div class="stats">
      <a class="stat" href="#topics"><span class="stat-n">${st.topics}</span><span class="stat-l">Topics</span></a>
      <a class="stat" href="#/decisions"><span class="stat-n">${st.decisions}</span><span class="stat-l">Decisions, ${st.accepted} accepted</span></a>
      <a class="stat" href="#/questions"><span class="stat-n">${st.questions}</span><span class="stat-l">Open questions</span></a>
      <a class="stat ${diagClass}" href="#/diagnostics"><span class="stat-n">${D.diagnostics.length}</span><span class="stat-l">Diagnostics</span></a>
    </div>`;

    html += o ? o.html : '<p class="empty">No overview.md yet. Run "init context" to create one.</p>';

    html += `<div class="section-head" id="topics"><h2>Topics</h2></div>`;
    if (D.topics.length) {
      html += '<div class="cards">' + D.topics.map((id) => {
        const p = D.pages[id];
        const degree = (adj.get(id) || []).length;
        return `<a class="card" href="${href(id)}">
          <div class="card-title k-topic"><span class="dot"></span>${esc(p.title)}</div>
          <div class="card-desc">${p.desc ? stripLinks(p.desc) : '<span class="empty">No description in the index.</span>'}</div>
          ${claimBar(p.claims)}
          <div class="card-foot"><span>${p.updated ? 'Updated ' + esc(p.updated) : ''}</span><span>${degree} connection${degree === 1 ? '' : 's'}</span></div>
        </a>`;
      }).join('') + '</div>';
    } else {
      html += '<p class="empty">No topics yet.</p>';
    }

    if (D.decisions.length) {
      html += `<div class="section-head"><h2>Recent decisions</h2><a href="#/decisions">All ${D.decisions.length} decisions</a></div>`;
      html += '<ul class="timeline">' + D.decisions.slice(0, 4).map(decisionCard).join('') + '</ul>';
    }

    if (D.docs.length || D.background.length) {
      html += '<div class="section-head"><h2>Other background</h2></div><ul class="bg-list">';
      for (const id of D.docs) html += `<li><a href="${href(id)}">${esc(D.pages[id].title)}</a>${D.pages[id].desc ? ` <span class="desc">${D.pages[id].desc}</span>` : ''}</li>`;
      for (const b of D.background) html += `<li><a href="${esc(b.href)}" target="_blank" rel="noopener">${esc(b.label)}</a> <span class="desc">${b.desc}</span></li>`;
      html += '</ul>';
    }
    return html;
  }

  function docPage(id) {
    const p = D.pages[id];
    const kindLabel = KINDS[p.kind]?.label ?? 'Document';
    return head({
      eyebrow: kindLabel,
      kind: p.kind,
      title: esc(p.title),
      sub: p.desc || '',
      meta: [`<span><code>${esc(p.path)}</code></span>`, p.updated ? `<span>Updated ${esc(p.updated)}</span>` : '', p.load ? `<span>${p.load}</span>` : ''],
    }) + (p.kind === 'topic' ? `<div class="claimsummary">${claimBar(p.claims, true)}</div>` : '') + p.html + connections(id);
  }

  function decisionPage(id) {
    const p = D.pages[id];
    const f = p.fields;
    const rows = [
      ['Decision', f.decision], ['Why', f.why], ['Source', f.source],
      ['Related context', f.related], ['Replaces', f.replaces], ['Superseded by', f.supersededBy],
    ].filter(([, v]) => v);
    return head({
      eyebrow: 'Decision' + (p.date ? ' · ' + esc(p.date) : ''),
      kind: 'decision',
      title: esc(p.title),
      meta: [statusPill(p), p.statusText && p.status === 'unknown' ? `<span>${esc(p.statusText)}</span>` : '', `<span><code>${esc(p.path)}</code></span>`],
    }) +
      (p.status === 'accepted' ? '<p class="empty">Accepted means chosen. It does not show that the decision is implemented.</p>' : '') +
      (rows.length ? `<dl class="fields">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : '') +
      p.html + connections(id);
  }

  function filePage(id) {
    const n = nodes.get(id);
    if (!n) return notFound();
    return head({
      eyebrow: KINDS[n.kind]?.label ?? 'File',
      kind: n.kind,
      title: esc(n.label),
      meta: [`<span><code>${esc(n.path)}</code></span>`],
    }) +
      (n.exists === false ? '<div class="notice">This path does not exist. The references below may be stale.</div>' : '') +
      (n.preview ? `<div class="preview"><img src="${n.preview}" alt="${esc(n.label)}"></div>` : '') +
      (n.exists !== false ? `<p><a class="btn" href="${esc(n.href)}" target="_blank" rel="noopener">Open file</a></p>` : '') +
      connections(id);
  }

  function decisionsPage() {
    const accepted = D.decisions.filter((id) => D.pages[id].status === 'accepted').length;
    return head({
      eyebrow: 'Decisions',
      kind: 'decision',
      title: 'Decision log',
      sub: `${D.decisions.length} decisions, ${accepted} accepted. Newest first.`,
      meta: [D.decisionsUpdated ? `<span>Updated ${esc(D.decisionsUpdated)}</span>` : ''],
    }) + D.decisionsIntro +
      (D.decisions.length ? '<ul class="timeline">' + D.decisions.map(decisionCard).join('') + '</ul>' : '<p class="empty">No decisions recorded yet.</p>');
  }

  function questionsPage() {
    const total = D.stats.questions;
    let html = head({ eyebrow: 'Open questions', title: 'Unresolved questions', sub: `${total} open question${total === 1 ? '' : 's'} across ${D.questions.length} file${D.questions.length === 1 ? '' : 's'}.` });
    if (!D.questions.length) return html + '<p class="empty">No open questions recorded.</p>';
    for (const g of D.questions) {
      html += `<section class="qgroup"><h2><a href="${href(g.id)}">${esc(g.title)}</a><span class="count t-question">${g.items.length}</span></h2><ul class="qlist">${g.items.map((q) => `<li>${q}</li>`).join('')}</ul></section>`;
    }
    return html;
  }

  function diagnosticsPage() {
    let html = head({ eyebrow: 'Diagnostics', title: 'Context health', sub: 'Missing files, broken references, and gaps found while reading the context folder.' });
    if (!D.diagnostics.length) return html + '<div class="ok">No problems found.</div>';
    return html + D.diagnostics.map((d) => `<div class="diag ${d.level}"><span class="diag-level">${d.level}</span><div>${d.message}</div></div>`).join('');
  }

  function notFound() {
    return head({ title: 'Not found', sub: 'This page is not part of the context report.' }) + '<p><a href="#/">Back to overview</a></p>';
  }

  // -------------------------------------------------------------------------
  // Navigation and routing

  const nav = $('#nav');
  function renderNav() {
    const item = (to, label, extra = '', lead = '') =>
      `<a class="nav-item" href="${to}" data-to="${esc(to)}">${lead}<span class="label">${label}</span>${extra}</a>`;
    let html = '<div class="nav-group">';
    html += item('#/', 'Overview', '', icon('home'));
    html += item('#/decisions', 'Decisions', `<span class="badge">${D.decisions.length}</span>`, icon('decisions'));
    html += item('#/questions', 'Open questions', `<span class="badge">${D.stats.questions}</span>`, icon('questions'));
    html += item('#/diagnostics', 'Diagnostics', `<span class="badge${warnings ? ' warn' : ''}">${D.diagnostics.length}</span>`, icon('diagnostics'));
    html += item('#/graph', 'Graph', '', icon('graph'));
    html += '</div>';
    if (D.topics.length) {
      html += '<div class="nav-group"><div class="nav-label">Topics</div>';
      for (const id of D.topics) {
        const q = D.pages[id].claims?.question || 0;
        html += item(href(id), esc(D.pages[id].title), q ? `<span class="badge" title="${q} open question${q === 1 ? '' : 's'}">${q} open</span>` : '', '<span class="dot k-topic"></span>');
      }
      html += '</div>';
    }
    if (D.docs.length) {
      html += '<div class="nav-group"><div class="nav-label">Documents</div>';
      for (const id of D.docs) html += item(href(id), esc(D.pages[id].title), '', '<span class="dot k-doc"></span>');
      html += '</div>';
    }
    nav.innerHTML = html;
  }

  let wasFull = false;
  function route() {
    const hash = decodeURIComponent(location.hash.slice(1) || '/');
    const full = hash === '/graph';
    document.body.classList.toggle('graph-full', full);
    let selected = null;
    let html;
    if (hash === '/' || hash === '' || full) html = homePage();
    else if (hash === '/decisions') html = decisionsPage();
    else if (hash === '/questions') html = questionsPage();
    else if (hash === '/diagnostics') html = diagnosticsPage();
    else if (hash.startsWith('/n/')) {
      const id = hash.slice(3);
      selected = id;
      if (id === 'index' || id === 'overview') html = homePage();
      else if (id === 'decisions') html = decisionsPage();
      else if (D.pages[id]?.kind === 'decision') html = decisionPage(id);
      else if (D.pages[id]) html = docPage(id);
      else html = filePage(id);
      if (id === 'index') selected = 'overview';
    } else if (!hash.startsWith('/')) {
      // In-page anchor such as #topics.
      document.getElementById(hash)?.scrollIntoView();
      return;
    } else html = notFound();

    page.innerHTML = html;
    page.style.animation = 'none';
    void page.offsetWidth;
    page.style.animation = '';
    $('#main').scrollTop = 0;
    document.title = `${selected ? labelOf(selected) + ' · ' : ''}${D.title} · Project context`;

    const current = location.hash || '#/';
    for (const a of nav.querySelectorAll('.nav-item')) {
      const to = a.dataset.to;
      a.classList.toggle('active', to === current || (to === '#/' && (current === '#/n/overview' || current === '#/n/index')));
    }
    graph.select(selected && nodes.has(selected) ? selected : null);
    if (full !== wasFull) requestAnimationFrame(() => graph.fit(false));
    wasFull = full;
  }

  // -------------------------------------------------------------------------
  // Search

  const searchInput = $('#search');
  const results = $('#results');
  const corpus = Object.values(D.pages).map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    text: textOf((p.desc || '') + ' ' + (p.html || '') + ' ' + Object.values(p.fields || {}).join(' ')),
  }));
  for (const n of D.graph.nodes) if (!D.pages[n.id]) corpus.push({ id: n.id, kind: n.kind, title: n.label, text: n.path || '' });

  function textOf(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function snippet(text, terms) {
    const lower = text.toLowerCase();
    let at = -1;
    for (const t of terms) {
      at = lower.indexOf(t);
      if (at >= 0) break;
    }
    if (at < 0) return esc(text.slice(0, 110));
    const start = Math.max(0, at - 45);
    let s = (start ? '...' : '') + text.slice(start, start + 140) + (start + 140 < text.length ? '...' : '');
    s = esc(s);
    for (const t of terms) s = s.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
    return s;
  }

  let resultSel = 0;
  function search() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      results.hidden = true;
      nav.hidden = false;
      graph.highlight(null);
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const doc of corpus) {
      const title = doc.title.toLowerCase();
      const text = doc.text.toLowerCase();
      let score = 0;
      let ok = true;
      for (const t of terms) {
        const inTitle = title.includes(t);
        const inText = text.includes(t);
        if (!inTitle && !inText) { ok = false; break; }
        score += (inTitle ? 10 : 0) + (inText ? 1 : 0);
      }
      if (ok) scored.push({ doc, score: score + (doc.kind === 'topic' ? 2 : doc.kind === 'file' ? -2 : 0) });
    }
    scored.sort((a, b) => b.score - a.score);
    resultSel = 0;
    results.innerHTML = scored.length
      ? scored.slice(0, 40).map(({ doc }, i) => `<a class="result${i === 0 ? ' sel' : ''}" href="${href(doc.id)}">
          <div class="result-title k-${doc.kind}"><span class="dot"></span>${esc(doc.title)}</div>
          <div class="result-snippet">${snippet(doc.text || KINDS[doc.kind]?.label || '', terms)}</div></a>`).join('')
      : '<div class="none">No matches.</div>';
    results.hidden = false;
    nav.hidden = true;
    graph.highlight(new Set(scored.map((s) => s.doc.id)));
  }
  searchInput.addEventListener('input', search);
  searchInput.addEventListener('keydown', (ev) => {
    const items = [...results.querySelectorAll('.result')];
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!items.length) return;
      resultSel = (resultSel + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('sel', i === resultSel));
      items[resultSel].scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter' && items[resultSel]) {
      location.hash = items[resultSel].getAttribute('href');
    } else if (ev.key === 'Escape') {
      searchInput.value = '';
      search();
      searchInput.blur();
    }
  });
  results.addEventListener('click', () => {
    searchInput.value = '';
    search();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === '/' && document.activeElement !== searchInput && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      searchInput.focus();
    } else if (ev.key === 'Escape' && document.body.classList.contains('graph-full') && document.activeElement !== searchInput) {
      history.back();
    }
  });

  // -------------------------------------------------------------------------
  // Graph

  const graph = (() => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = $('#graph');
    const tip = $('#graph-tip');
    const canvas = $('#graph-canvas');
    const el = (tag, attrs = {}) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };

    const G = {
      nodes: D.graph.nodes.map((n) => ({ ...n, x: 0, y: 0, vx: 0, vy: 0 })),
      edges: [],
    };
    const byId = new Map(G.nodes.map((n) => [n.id, n]));
    G.edges = D.graph.edges.map((e) => ({ ...e, a: byId.get(e.s), b: byId.get(e.t) })).filter((e) => e.a && e.b);
    for (const n of G.nodes) n.deg = (adj.get(n.id) || []).length;
    const radius = (n) => {
      if (n.kind === 'overview') return 11;
      if (n.kind === 'topic') return 7 + Math.min(7, Math.sqrt(n.deg) * 1.8);
      if (n.kind === 'decision') return 6 + Math.min(4, Math.sqrt(n.deg));
      if (n.kind === 'doc') return 6;
      return 4.5;
    };

    const counts = {};
    for (const n of G.nodes) counts[n.kind] = (counts[n.kind] || 0) + 1;
    const hiddenKinds = new Set();
    let focus = false;
    let selected = null;
    let hits = null;
    let view = { x: 0, y: 0, k: 1 };
    let userMoved = false;
    let layer;

    // Filters and legend
    const filters = $('#graph-filters');
    filters.innerHTML = Object.keys(KINDS).filter((k) => counts[k]).map((k) =>
      `<button type="button" class="filter k-${k}" data-kind="${k}" aria-pressed="true"><span class="dot"></span>${KINDS[k].plural}<span class="n">${counts[k]}</span></button>`).join('');
    filters.addEventListener('click', (ev) => {
      const b = ev.target.closest('.filter');
      if (!b) return;
      const k = b.dataset.kind;
      if (hiddenKinds.has(k)) hiddenKinds.delete(k); else hiddenKinds.add(k);
      b.setAttribute('aria-pressed', String(!hiddenKinds.has(k)));
      rebuild(true);
    });
    const legendLine = (cls) => `<svg viewBox="0 0 22 8"><line class="edge ${cls}" x1="0" y1="4" x2="22" y2="4"/></svg>`;
    $('#graph-legend').innerHTML =
      `<span>${legendLine('')}References</span><span>${legendLine('e-related')}Related context</span>` +
      `<span>${legendLine('e-supersedes')}Supersedes</span><span>${legendLine('e-mentions')}Mentions</span>`;

    function visibleSet() {
      let vis = G.nodes.filter((n) => !hiddenKinds.has(n.kind));
      if (focus && selected && byId.has(selected)) {
        const keep = new Set([selected, ...(adj.get(selected) || []).map((c) => c.other)]);
        vis = vis.filter((n) => keep.has(n.id));
      }
      return vis;
    }

    // Deterministic force layout: same input, same picture.
    function layout(vis, visEdges) {
      const n = vis.length;
      if (!n) return;
      const golden = Math.PI * (3 - Math.sqrt(5));
      const order = [...vis].sort((a, b) => b.deg - a.deg || a.id.localeCompare(b.id));
      order.forEach((node, i) => {
        const r = 34 * Math.sqrt(i + 0.5);
        node.x = Math.cos(i * golden) * r;
        node.y = Math.sin(i * golden) * r;
        node.vx = node.vy = 0;
      });
      const iterations = n > 400 ? 160 : n > 150 ? 260 : 380;
      const springLen = (e) => (e.a.kind === 'file' || e.b.kind === 'file' || e.a.kind === 'asset' || e.b.kind === 'asset' ? 52 : 92);
      for (let it = 0; it < iterations; it++) {
        const alpha = Math.max(0.02, 1 - it / iterations);
        for (let i = 0; i < n; i++) {
          const a = vis[i];
          for (let j = i + 1; j < n; j++) {
            const b = vis[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 0.01) { dx = 0.1; dy = 0.1; d2 = 0.02; }
            if (d2 > 250000) continue;
            const f = (2600 * alpha) / d2;
            const d = Math.sqrt(d2);
            const fx = (dx / d) * f;
            const fy = (dy / d) * f;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }
        for (const e of visEdges) {
          const dx = e.b.x - e.a.x;
          const dy = e.b.y - e.a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const f = (d - springLen(e)) * 0.05 * alpha;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          e.a.vx += fx; e.a.vy += fy;
          e.b.vx -= fx; e.b.vy -= fy;
        }
        for (const node of vis) {
          node.vx -= node.x * 0.012 * alpha;
          node.vy -= node.y * 0.012 * alpha;
          node.vx *= 0.58;
          node.vy *= 0.58;
          node.x += Math.max(-30, Math.min(30, node.vx));
          node.y += Math.max(-30, Math.min(30, node.vy));
        }
      }
    }

    let visNodes = [];
    let visEdges = [];

    function rebuild(relayout) {
      const vis = visibleSet();
      const set = new Set(vis.map((n) => n.id));
      visNodes = vis;
      visEdges = G.edges.filter((e) => set.has(e.s) && set.has(e.t));
      if (relayout) layout(visNodes, visEdges);
      draw();
      $('#graph-empty').hidden = visEdges.length > 0;
      svg.style.visibility = visEdges.length ? '' : 'hidden';
      if (relayout) fit(false);
    }

    function draw() {
      svg.innerHTML = '';
      const defs = el('defs');
      const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' });
      marker.appendChild(el('path', { d: 'M0 1.5 9 5 0 8.5z', class: 'arrow' }));
      defs.appendChild(marker);
      svg.appendChild(defs);
      layer = el('g');
      const edgeLayer = el('g');
      const nodeLayer = el('g');
      layer.append(edgeLayer, nodeLayer);
      svg.appendChild(layer);

      for (const e of visEdges) {
        e.el = el('line', { class: `edge e-${e.type}`, 'marker-end': e.type === 'supersedes' ? 'url(#arrow)' : '' });
        edgeLayer.appendChild(e.el);
      }
      for (const n of [...visNodes].sort((a, b) => radius(a) - radius(b))) {
        const r = radius(n);
        const g = el('g', {
          class: `node k-${n.kind}${n.exists === false ? ' missing' : ''}${n.status === 'superseded' ? ' superseded' : ''}`,
          tabindex: '0',
          role: 'link',
          'aria-label': `${KINDS[n.kind]?.label}: ${n.label}`,
        });
        g.append(el('circle', { class: 'halo', r: r + 7 }), el('circle', { r }));
        const t = el('text', { y: r + 2, dy: '0.95em' });
        t.textContent = n.label.length > 34 ? n.label.slice(0, 32) + '...' : n.label;
        g.appendChild(t);
        g.dataset.id = n.id;
        n.el = g;
        nodeLayer.appendChild(g);
      }
      positions();
      applyClasses();
      applyView();
    }

    function positions() {
      for (const n of visNodes) n.el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      for (const e of visEdges) {
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const ra = radius(e.a) + 1;
        const rb = radius(e.b) + (e.type === 'supersedes' ? 3 : 1);
        e.el.setAttribute('x1', (e.a.x + (dx / d) * ra).toFixed(1));
        e.el.setAttribute('y1', (e.a.y + (dy / d) * ra).toFixed(1));
        e.el.setAttribute('x2', (e.b.x - (dx / d) * rb).toFixed(1));
        e.el.setAttribute('y2', (e.b.y - (dy / d) * rb).toFixed(1));
      }
    }

    function applyClasses(hover) {
      const center = hover || selected;
      const nb = new Set();
      if (center) for (const c of adj.get(center) || []) nb.add(c.other);
      const dim = Boolean(center && byId.has(center)) || Boolean(hits);
      svg.classList.toggle('dim', dim);
      for (const n of visNodes) {
        n.el.classList.toggle('sel', n.id === center);
        n.el.classList.toggle('nb', nb.has(n.id));
        n.el.classList.toggle('hit', Boolean(hits && hits.has(n.id)));
      }
      for (const e of visEdges) e.el.classList.toggle('on', Boolean(center) && (e.s === center || e.t === center));
    }

    function applyView() {
      if (!layer) return;
      layer.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
      svg.style.setProperty('--k', view.k);
      svg.classList.toggle('zoomed', view.k > 1.6);
    }

    function size() {
      return { w: canvas.clientWidth || 400, h: canvas.clientHeight || 400 };
    }

    function animateTo(target) {
      const from = { ...view };
      const start = performance.now();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const step = (now) => {
        const t = reduce ? 1 : Math.min(1, (now - start) / 320);
        const ease = 1 - Math.pow(1 - t, 3);
        view = { x: from.x + (target.x - from.x) * ease, y: from.y + (target.y - from.y) * ease, k: from.k + (target.k - from.k) * ease };
        applyView();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function fit(animate = true) {
      const { w, h } = size();
      if (!visNodes.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of visNodes) {
        x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y);
        x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y);
      }
      // Leave room for labels, which keep their screen size at any zoom.
      const k = Math.min(1.6, Math.max(0.15, Math.min((w - 170) / (x1 - x0 || 1), (h - 90) / (y1 - y0 || 1))));
      const target = { k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k - 8 };
      userMoved = false;
      if (animate) animateTo(target); else { view = target; applyView(); }
    }

    function reveal(id) {
      const n = byId.get(id);
      if (!n || !n.el || !n.el.isConnected) return;
      const { w, h } = size();
      const sx = n.x * view.k + view.x;
      const sy = n.y * view.k + view.y;
      if (sx > w * 0.15 && sx < w * 0.85 && sy > h * 0.15 && sy < h * 0.85) return;
      animateTo({ k: view.k, x: w / 2 - n.x * view.k, y: h / 2 - n.y * view.k });
    }

    // Interaction: pan, zoom, drag, click, hover.
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      const g = ev.target.closest('.node');
      svg.setPointerCapture(ev.pointerId);
      drag = { id: g?.dataset.id ?? null, sx: ev.clientX, sy: ev.clientY, moved: false, vx: view.x, vy: view.y };
      if (!g) svg.classList.add('panning');
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) {
        const g = ev.target.closest('.node');
        showTip(g ? g.dataset.id : null, ev);
        return;
      }
      const dx = ev.clientX - drag.sx;
      const dy = ev.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      tip.hidden = true;
      if (drag.id) {
        const n = byId.get(drag.id);
        const rect = svg.getBoundingClientRect();
        n.x = (ev.clientX - rect.left - view.x) / view.k;
        n.y = (ev.clientY - rect.top - view.y) / view.k;
        positions();
      } else {
        view.x = drag.vx + dx;
        view.y = drag.vy + dy;
        userMoved = true;
        applyView();
      }
    });
    svg.addEventListener('pointerup', () => {
      if (drag && !drag.moved && drag.id) {
        location.hash = href(drag.id);
        if (window.matchMedia('(max-width: 1180px)').matches && !document.body.classList.contains('graph-full')) {
          document.body.classList.remove('graph-open');
        }
      }
      drag = null;
      svg.classList.remove('panning');
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; if (!drag) applyClasses(); });
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const rect = svg.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const k = Math.min(5, Math.max(0.12, view.k * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015))));
      view.x = px - ((px - view.x) / view.k) * k;
      view.y = py - ((py - view.y) / view.k) * k;
      view.k = k;
      userMoved = true;
      applyView();
    }, { passive: false });
    svg.addEventListener('keydown', (ev) => {
      const g = ev.target.closest?.('.node');
      if (g && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        location.hash = href(g.dataset.id);
      }
    });

    let tipFor = null;
    function showTip(id, ev) {
      if (id !== tipFor) {
        tipFor = id;
        applyClasses(id || undefined);
      }
      if (!id) { tip.hidden = true; return; }
      const n = byId.get(id);
      tip.innerHTML = `<b>${esc(n.label)}</b><span>${esc(KINDS[n.kind]?.label ?? n.kind)}${n.path && n.kind !== 'topic' ? ' · ' + esc(n.path) : ''}${n.exists === false ? ' · missing' : ''} · ${n.deg} connection${n.deg === 1 ? '' : 's'}</span>`;
      const rect = canvas.getBoundingClientRect();
      tip.hidden = false;
      const x = Math.min(ev.clientX - rect.left + 14, rect.width - tip.offsetWidth - 8);
      const y = Math.min(ev.clientY - rect.top + 14, rect.height - tip.offsetHeight - 8);
      tip.style.left = Math.max(8, x) + 'px';
      tip.style.top = Math.max(8, y) + 'px';
    }

    $('#graph-fit').addEventListener('click', () => fit());
    $('#graph-expand').addEventListener('click', () => {
      if (document.body.classList.contains('graph-full')) history.back();
      else location.hash = '#/graph';
    });
    const focusBtn = $('#graph-focus');
    focusBtn.addEventListener('click', () => {
      focus = !focus;
      focusBtn.setAttribute('aria-pressed', String(focus));
      rebuild(true);
    });
    new ResizeObserver(() => { if (!userMoved) fit(false); }).observe(canvas);

    rebuild(true);

    return {
      fit,
      select(id) {
        const changed = id !== selected;
        selected = id;
        if (focus && changed) rebuild(true);
        else applyClasses();
        if (id) reveal(id);
      },
      highlight(set) {
        hits = set && set.size ? set : null;
        applyClasses();
      },
    };
  })();

  $('#graph-toggle').addEventListener('click', () => {
    document.body.classList.toggle('graph-open');
    requestAnimationFrame(() => graph.fit(false));
  });

  // -------------------------------------------------------------------------
  // Theme and startup

  $('#theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('context-report-theme', next); } catch { /* private mode */ }
  });
  const generated = new Date(D.generated);
  $('#generated').textContent = 'Generated ' + generated.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  $('#generated').title = generated.toLocaleString();

  renderNav();
  window.addEventListener('hashchange', route);
  route();
})();
