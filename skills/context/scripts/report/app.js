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
  };
  const icon = (name) => `<svg class="nav-icon" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

  const nodes = new Map(D.links.nodes.map((n) => [n.id, n]));
  const adj = new Map();
  for (const e of D.links.edges) {
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

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1) || '/');
    let selected = null;
    let html;
    if (hash === '/' || hash === '') html = homePage();
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
  for (const n of D.links.nodes) if (!D.pages[n.id]) corpus.push({ id: n.id, kind: n.kind, title: n.label, text: n.path || '' });

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
    }
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
