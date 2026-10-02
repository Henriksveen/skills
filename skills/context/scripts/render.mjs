#!/usr/bin/env node
// Renders a project's .context/ folder as one self-contained HTML report.
// No dependencies. Requires Node 18 or newer.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `Usage: node render.mjs [options]

Options:
  -i, --input <dir>    Context folder. Default: .context
  -o, --output <file>  Report path, outside the context folder. Default: context-report.html
      --root <dir>     Repository root for resolving references. Default: parent of the context folder
      --title <name>   Project name in the report. Default: repository folder name
  -h, --help           Show this help`;

const IMAGE_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
};
const MAX_EMBED_BYTES = 3 * 1024 * 1024;

const SECTION_TYPES = [
  [/current behaviou?r|current state/i, 'behavior'],
  [/requirement|preference|constraint/i, 'requirement'],
  [/proposal|hypothes|idea/i, 'proposal'],
  [/decision/i, 'decision'],
];

const FIELD_NAMES = {
  status: 'status', decision: 'decision', why: 'why', reason: 'why', source: 'source',
  'related context': 'related', related: 'related', replaces: 'replaces', 'superseded by': 'supersededBy',
};

const FIELD_LABELS = {
  status: 'Status', decision: 'Decision', why: 'Why', source: 'Source',
  related: 'Related context', replaces: 'Replaces', supersededBy: 'Superseded by',
};

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const PATH_BODY = String.raw`(?:\.{1,2}\/|\/)?(?:[\w@.+-]+\/)+[\w@.+-]*\.[A-Za-z]\w{0,7}(?:#[\w.-]+)?(?::\d+(?:-\d+)?)?`;
const PATH_RE = new RegExp(String.raw`(^|[\s(\[,;"'])(${PATH_BODY})(?=$|[\s),;:.!?\]"'])`, 'g');
const PATH_FULL = new RegExp(`^${PATH_BODY}$`);
const URL_RE = /\bhttps?:\/\/[^\s<>)\]]*[^\s<>)\].,;:!?'"]/g;

function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        input: { type: 'string', short: 'i', default: '.context' },
        output: { type: 'string', short: 'o', default: 'context-report.html' },
        root: { type: 'string' },
        title: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (err) {
    fail(`${err.message}\n\n${USAGE}`);
  }
  if (values.help) {
    console.log(USAGE);
    return;
  }

  const contextDir = path.resolve(values.input);
  if (!fs.existsSync(contextDir) || !fs.statSync(contextDir).isDirectory()) {
    fail(`No context folder at ${contextDir}\n\n${USAGE}`);
  }
  const repoRoot = path.resolve(values.root ?? path.dirname(contextDir));
  const output = path.resolve(values.output);
  if (isInside(output, contextDir)) fail('Write the report outside the context folder. The Markdown files stay the source of truth.');

  const data = build({ contextDir, repoRoot, output, title: values.title });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderPage(data));

  const s = data.stats;
  console.log(
    `Wrote ${path.relative(process.cwd(), output) || output}: ${s.topics} topics, ${s.decisions} decisions, ` +
    `${data.diagnostics.length} diagnostics.`,
  );
  for (const d of data.diagnostics) {
    const text = d.message.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    console.log(`  ${d.level}: ${text}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build the report data

function build({ contextDir, repoRoot, output, title }) {
  const toPosix = (p) => p.split(path.sep).join('/');
  const ctxRel = (abs) => toPosix(path.relative(contextDir, abs));
  const repoRel = (abs) => toPosix(path.relative(repoRoot, abs)) || '.';
  const read = (abs) => fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n');

  const files = walk(contextDir);
  const core = {
    index: path.join(contextDir, 'index.md'),
    overview: path.join(contextDir, 'overview.md'),
    decisions: path.join(contextDir, 'decisions.md'),
  };
  const topicsDir = path.join(contextDir, 'topics');
  const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
  const topicFiles = mdFiles.filter((f) => isInside(f, topicsDir));
  const docFiles = mdFiles.filter((f) => !Object.values(core).includes(f) && !topicFiles.includes(f));

  const links = new LinkIndex();
  const pages = {};
  const diagnostics = [];
  const brokenSeen = new Set();
  const warn = (message, level = 'warning') => diagnostics.push({ level, message });

  for (const [name, abs] of Object.entries(core)) {
    if (!fs.existsSync(abs)) warn(`Missing core file <code>${esc(repoRel(abs))}</code>.`, name === 'index' || name === 'overview' ? 'error' : 'warning');
  }

  // Ids for files in and around the context folder.
  const topicIdByPath = new Map();
  for (const f of topicFiles) topicIdByPath.set(f, 'topic:' + ctxRel(f).replace(/^topics\//, '').replace(/\.md$/i, ''));

  // Decisions are parsed first so links to decisions.md#<entry> resolve to entries.
  const decisionsSrc = fs.existsSync(core.decisions) ? read(core.decisions) : '';
  const decisionLog = parseDecisions(decisionsSrc);
  const decisionBySlug = new Map();
  for (const entry of decisionLog.entries) {
    let id = 'decision:' + entry.slug;
    for (let n = 2; links.nodes.has(id); n++) id = `decision:${entry.slug}-${n}`;
    entry.id = id;
    decisionBySlug.set(entry.slug, id);
    links.node(id, { kind: 'decision', label: entry.title, status: entry.status, date: entry.date });
  }

  const idForPath = (abs, anchor) => {
    if (abs === core.index) return 'index';
    if (abs === core.overview) return 'overview';
    if (abs === core.decisions) return anchor && decisionBySlug.has(anchor) ? decisionBySlug.get(anchor) : 'decisions';
    if (topicIdByPath.has(abs)) return topicIdByPath.get(abs);
    if (isInside(abs, contextDir)) {
      return abs.toLowerCase().endsWith('.md') ? 'doc:' + ctxRel(abs) : 'asset:' + ctxRel(abs);
    }
    return 'file:' + repoRel(abs);
  };

  const resolve = (raw, fromFile) => {
    let ref = raw.trim().replace(/^<|>$/g, '');
    if (!ref) return null;
    if (/^[a-z][a-z0-9+.-]+:/i.test(ref)) return { kind: 'url', href: ref };
    let anchor = '';
    const hashAt = ref.indexOf('#');
    if (hashAt >= 0) {
      anchor = ref.slice(hashAt + 1);
      ref = ref.slice(0, hashAt);
    }
    ref = ref.replace(/:\d+(?:-\d+)?$/, '');
    try { ref = decodeURI(ref); } catch { /* keep as written */ }
    const fromDir = path.dirname(fromFile);
    let candidates;
    if (!ref) candidates = [fromFile];
    else if (ref.startsWith('/')) candidates = [path.join(repoRoot, ref), ref];
    else if (/^\.\.?\//.test(ref)) candidates = [path.resolve(fromDir, ref), path.resolve(repoRoot, ref)];
    else candidates = [path.resolve(repoRoot, ref), path.resolve(fromDir, ref), path.resolve(contextDir, ref)];
    const found = candidates.find((c) => fs.existsSync(c));
    const abs = found ?? candidates[0];
    const id = idForPath(abs, anchor);
    return {
      kind: id.split(':')[0],
      id,
      abs,
      exists: Boolean(found),
      inContext: isInside(abs, contextDir),
      href: hrefFrom(output, abs) + (anchor ? '#' + anchor : ''),
    };
  };

  const registerTarget = (res) => {
    if (links.nodes.has(res.id) || res.id === 'index' || res.id === 'decisions') return;
    const isDir = res.exists && fs.statSync(res.abs).isDirectory();
    const node = links.node(res.id, {
      kind: res.kind,
      label: path.basename(res.abs) + (isDir ? '/' : ''),
      path: repoRel(res.abs),
      href: hrefFrom(output, res.abs),
      exists: res.exists,
    });
    const type = IMAGE_TYPES[path.extname(res.abs).toLowerCase()];
    if (type && res.exists && !isDir) {
      const data = embed(res.abs, type);
      if (data) node.preview = data;
    }
  };

  // A rendering context records every reference it renders as a link between pages.
  const makeCtx = (fromId, fromFile) => ({
    fromId,
    fromFile,
    edgeType: 'references',
    evidence: '',
    resolve: (raw) => resolve(raw, fromFile),
    ref(res) {
      if (!res || res.kind === 'url') return;
      registerTarget(res);
      if (!res.exists) {
        const key = `${fromId}\u0001${res.abs}`;
        if (!brokenSeen.has(key)) {
          brokenSeen.add(key);
          warn(`<a href="#/n/${encodeURIComponent(fromId)}">${esc(links.nodes.get(fromId)?.label ?? fromId)}</a> references <code>${esc(repoRel(res.abs))}</code>, which does not exist.`);
        }
      }
      if (res.id === 'index' || res.id === 'decisions' || fromId === null) return;
      if (this.edgeType === 'superseded-by') links.edge(res.id, fromId, 'supersedes', this.evidence);
      else links.edge(fromId, res.id, this.edgeType, this.evidence);
    },
  });
  // Renders without recording edges, for content shown twice.
  const quietCtx = (fromFile) => ({ ...makeCtx(null, fromFile), ref() {} });

  const rawText = {};

  // Overview, topics, and other context documents share one structured renderer.
  const docPage = (abs, id, kind, fallbackTitle) => {
    const src = stripComments(read(abs));
    rawText[id] = src;
    const meta = docMeta(src, fallbackTitle);
    links.node(id, { kind, label: meta.title, path: repoRel(abs) });
    const ctx = makeCtx(id, abs);
    const sections = splitSections(meta.body);
    const claims = { behavior: 0, requirement: 0, proposal: 0, decision: 0 };
    let html = blocks(sections.preamble, ctx);
    for (const sec of sections.list) {
      const type = classifySection(sec.heading);
      const items = topLevelItems(sec.body);
      if (type) claims[type] += items.length;
      const body = blocks(sec.body, ctx);
      html += `<section class="sec${type ? ` claims t-${type}` : ''}" id="${attr(slug(sec.heading))}">` +
        `<h2>${inline(sec.heading, quietCtx(abs))}${type && items.length ? `<span class="count">${items.length}</span>` : ''}</h2>` +
        (body.trim() ? (type ? tagClaims(body) : body) : '<p class="empty">Nothing recorded yet.</p>') +
        '</section>';
    }
    pages[id] = { id, kind, title: meta.title, updated: meta.updated, path: repoRel(abs), html, claims };
    return pages[id];
  };

  if (fs.existsSync(core.overview)) docPage(core.overview, 'overview', 'overview', 'Project overview');
  for (const f of topicFiles) docPage(f, topicIdByPath.get(f), 'topic', humanize(path.basename(f, '.md')));
  for (const f of docFiles) docPage(f, 'doc:' + ctxRel(f), 'doc', humanize(path.basename(f, '.md')));

  // Decision entries.
  rawText.decisions = decisionsSrc;
  const decisionsMeta = docMeta(decisionLog.preamble, 'Decisions');
  const decisionsIntro = blocks(decisionsMeta.body, quietCtx(core.decisions));
  for (const entry of decisionLog.entries) {
    rawText[entry.id] = entry.raw;
    const ctx = makeCtx(entry.id, core.decisions);
    const field = (key, edgeType) => {
      if (!entry.fields[key]) return null;
      ctx.edgeType = edgeType;
      ctx.evidence = plainEvidence(`${FIELD_LABELS[key]}: ${entry.fields[key]}`);
      const html = inline(entry.fields[key], ctx);
      ctx.edgeType = 'references';
      return html;
    };
    const fields = {
      decision: field('decision', 'references'),
      why: field('why', 'references'),
      source: field('source', 'references'),
      related: field('related', 'related'),
      replaces: field('replaces', 'supersedes'),
      supersededBy: field('supersededBy', 'superseded-by'),
    };
    if (!entry.fields.status) warn(`Decision <a href="#/n/${encodeURIComponent(entry.id)}">${esc(entry.title)}</a> has no status.`, 'info');
    if (!entry.fields.why) warn(`Decision <a href="#/n/${encodeURIComponent(entry.id)}">${esc(entry.title)}</a> has no reason.`, 'info');
    if (entry.status === 'superseded' && !entry.fields.supersededBy) warn(`Superseded decision <a href="#/n/${encodeURIComponent(entry.id)}">${esc(entry.title)}</a> does not link to its replacement.`, 'info');
    pages[entry.id] = {
      id: entry.id, kind: 'decision', title: entry.title, date: entry.date,
      status: entry.status || 'unknown', statusText: entry.fields.status ?? '',
      fields, html: blocks(entry.rest, ctx), path: repoRel(core.decisions),
    };
  }

  // Index: topic descriptions, load guidance, and other background.
  const indexOrder = [];
  const background = [];
  if (fs.existsSync(core.index)) {
    const src = stripComments(read(core.index));
    const q = quietCtx(core.index);
    for (const line of src.split('\n')) {
      const m = line.match(/^\s*[-*+]\s+(?:\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|(\S+?)):?\s+(?:[:\u2013\u2014-]\s*)?(.*)$/);
      if (!m) continue;
      const target = m[2] ?? m[3] ?? m[4];
      if (!PATH_FULL.test(target) && !m[2]) continue;
      const res = resolve(target, core.index);
      if (!res || res.kind === 'url') {
        background.push({ label: m[1] ?? target, href: target, desc: inline(m[5], q), exists: true });
        continue;
      }
      // "Load when ..." guidance is shown apart from the description.
      const [descText, loadText = ''] = m[5].replace(/^[:\s]+/, '').split(/\s+(?=(?:Load when|Load for|Always load)\b)/);
      const desc = inline(capitalize(descText), q);
      if (pages[res.id]) {
        pages[res.id].desc = desc;
        if (loadText) pages[res.id].load = inline(loadText, q);
        if (res.kind === 'topic') indexOrder.push(res.id);
      } else if (res.id === 'index' || res.id === 'decisions') {
        // Core navigation entries.
      } else if (res.kind === 'topic' || (res.inContext && !res.exists)) {
        warn(`The index lists <code>${esc(repoRel(res.abs))}</code>, which does not exist.`);
      } else {
        background.push({ label: m[1] ?? repoRel(res.abs), href: res.href, desc, exists: res.exists });
        if (!res.exists) warn(`The index lists <code>${esc(repoRel(res.abs))}</code>, which does not exist.`);
      }
    }
  }
  const topicIds = [...topicIdByPath.values()];
  for (const id of topicIds) {
    if (fs.existsSync(core.index) && !indexOrder.includes(id)) {
      warn(`Topic <a href="#/n/${encodeURIComponent(id)}">${esc(pages[id].title)}</a> is not listed in the index.`, 'info');
    }
  }
  const orderedTopics = [...new Set([...indexOrder, ...topicIds.sort((a, b) => pages[a].title.localeCompare(pages[b].title))])];

  // Plain-text mentions of decision titles, when no link already connects them.
  for (const [id, text] of Object.entries(rawText)) {
    if (!links.nodes.has(id)) continue;
    const lower = text.toLowerCase();
    for (const entry of decisionLog.entries) {
      if (entry.id === id || entry.title.length < 8) continue;
      const at = lower.indexOf(entry.title.toLowerCase());
      if (at < 0 || links.connected(id, entry.id)) continue;
      const lineStart = text.lastIndexOf('\n', at) + 1;
      const lineEnd = text.indexOf('\n', at);
      links.edge(id, entry.id, 'mentions', plainEvidence(text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)));
    }
  }

  const decisionIds = decisionLog.entries.map((e) => e.id);
  const overviewTitle = pages.overview?.title;
  return {
    title: title ?? path.basename(repoRoot),
    subtitle: overviewTitle && !/^project overview$/i.test(overviewTitle) ? overviewTitle : '',
    contextPath: repoRel(contextDir),
    generated: new Date().toISOString(),
    pages,
    topics: orderedTopics,
    docs: Object.keys(pages).filter((k) => k.startsWith('doc:')),
    decisions: decisionIds,
    decisionsIntro,
    decisionsUpdated: decisionsMeta.updated,
    background,
    diagnostics: diagnostics.sort((a, b) => levelRank(a.level) - levelRank(b.level)),
    // Pages and the links between them, for each page's Connections list.
    links: {
      nodes: [...links.nodes.values()],
      edges: [...links.edges.values()],
    },
    stats: {
      topics: orderedTopics.length,
      decisions: decisionIds.length,
      accepted: decisionLog.entries.filter((e) => e.status === 'accepted').length,
    },
  };
}

class LinkIndex {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }

  node(id, props) {
    const existing = this.nodes.get(id);
    if (existing) {
      for (const [k, v] of Object.entries(props)) if (v !== undefined) existing[k] = v;
      return existing;
    }
    const node = { id, ...props };
    this.nodes.set(id, node);
    return node;
  }

  edge(s, t, type, evidence) {
    if (s === t || !this.nodes.has(s) || !this.nodes.has(t)) return;
    const key = `${s}\u0001${t}\u0001${type}`;
    const e = this.edges.get(key);
    if (!e) this.edges.set(key, { s, t, type, evidence: evidence ? [evidence] : [] });
    else if (evidence && e.evidence.length < 4 && !e.evidence.includes(evidence)) e.evidence.push(evidence);
  }

  connected(a, b) {
    for (const e of this.edges.values()) if ((e.s === a && e.t === b) || (e.s === b && e.t === a)) return true;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Context file structure

function parseDecisions(src) {
  const text = stripComments(src);
  const parts = text.split(/^## +/m);
  const preamble = parts.shift() ?? '';
  const entries = parts.map((part) => {
    const nl = part.indexOf('\n');
    const heading = (nl < 0 ? part : part.slice(0, nl)).trim();
    const body = nl < 0 ? '' : part.slice(nl + 1);
    const m = heading.match(/^(\d{4}-\d{2}-\d{2})\s*[:\u2013\u2014-]?\s*(.*)$/);
    const fields = {};
    const rest = [];
    let current = null;
    for (const line of body.split('\n')) {
      const f = line.replace(/\*\*/g, '').match(/^\s*(?:[-*]\s+)?(status|decision|why|reason|source|related context|related|replaces|superseded by)\s*:\s*(.*)$/i);
      if (f) {
        current = FIELD_NAMES[f[1].toLowerCase()];
        fields[current] = f[2].trim();
      } else if (current && line.trim() && !/^\s*(#|[-*+]\s|\d+[.)]\s)/.test(line)) {
        fields[current] += ' ' + line.trim();
      } else {
        current = null;
        rest.push(line);
      }
    }
    const status = (fields.status ?? '').toLowerCase().match(/accepted|superseded|proposed|rejected|deprecated/)?.[0] ?? '';
    return {
      heading,
      slug: slug(heading),
      date: m ? m[1] : null,
      title: m && m[2] ? m[2] : heading,
      fields,
      status,
      rest: rest.join('\n').trim(),
      raw: body,
    };
  });
  return { preamble, entries };
}

function docMeta(src, fallbackTitle) {
  let title = fallbackTitle;
  let updated = '';
  let body = src.replace(/^\s*#\s+(.+?)\s*#*\s*$/m, (_, t) => {
    title = t;
    return '';
  });
  body = body.replace(/^\s*(?:\*\*)?Updated(?:\*\*)?:\s*(?:\*\*)?\s*(.+?)\s*$/m, (_, d) => {
    if (!/YYYY/.test(d)) updated = d;
    return '';
  });
  return { title, updated, body };
}

function splitSections(body) {
  const parts = body.split(/^##\s+/m);
  const preamble = parts.shift() ?? '';
  const list = parts.map((part) => {
    const nl = part.indexOf('\n');
    return { heading: (nl < 0 ? part : part.slice(0, nl)).replace(/\s*#*\s*$/, ''), body: nl < 0 ? '' : part.slice(nl + 1) };
  });
  return { preamble, list };
}

function classifySection(heading) {
  for (const [re, type] of SECTION_TYPES) if (re.test(heading)) return type;
  return null;
}

function topLevelItems(body) {
  const items = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(LIST_RE);
    if (m && m[1].length <= 1) items.push(m[3]);
    else if (items.length && /^\s{2,}\S/.test(line) && !LIST_RE.test(line)) items[items.length - 1] += ' ' + line.trim();
  }
  return items;
}

function tagClaims(html) {
  const re = /\b(Unverified(?: hypothesis| against code)?|Verified \d{4}-\d{2}-\d{2}|Implementation status not established|not chosen|Proposal, not chosen)\b/g;
  return html.replace(/>([^<]+)/g, (_, text) => '>' + text.replace(re, (m) => {
    const cls = /^Verified/.test(m) ? 'verified' : /^Unverified/.test(m) ? 'unverified' : 'pending';
    return `<span class="tag tag-${cls}">${m}</span>`;
  }));
}

// ---------------------------------------------------------------------------
// Markdown

function stripComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, '');
}

function blocks(md, ctx) {
  const lines = md.split('\n');
  const out = [];
  const blank = (l) => !l || !l.trim();
  const startsBlock = (l) => /^\s{0,3}(#{1,6}\s|```|~~~|>|[-*+]\s|\d+[.)]\s|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) {
      i++;
      continue;
    }
    let m;
    if ((m = line.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/))) {
      const fence = m[1];
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence)) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code${m[2] ? ` class="lang-${attr(m[2])}"` : ''}>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      const level = Math.min(6, m[1].length + (m[1].length === 1 ? 1 : 0));
      out.push(`<h${level} id="${attr(slug(m[2]))}">${inline(m[2], ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (line.includes('|') && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] ?? '')) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : ''));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && !blank(lines[i])) rows.push(cells(lines[i++]));
      const td = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c, ctx)}</${tag}>`;
      out.push(`<div class="table"><table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>` +
        rows.map((r) => `<tr>${r.map((c, k) => td('td', c, k)).join('')}</tr>`).join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) buf.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      out.push(`<blockquote>${blocks(buf.join('\n'), ctx)}</blockquote>`);
      continue;
    }
    if (LIST_RE.test(line)) {
      const buf = [];
      while (i < lines.length) {
        const l = lines[i];
        const next = lines[i + 1];
        if (LIST_RE.test(l) || /^\s+\S/.test(l) || (!blank(l) && buf.length && !startsBlock(l))) buf.push(lines[i++]);
        else if (blank(l) && next !== undefined && (LIST_RE.test(next) || /^\s{2,}\S/.test(next))) buf.push(lines[i++]);
        else break;
      }
      out.push(list(buf, ctx));
      continue;
    }
    const buf = [line];
    i++;
    while (i < lines.length && !blank(lines[i]) && !startsBlock(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${paragraph(buf, ctx)}</p>`);
  }
  return out.join('\n');
}

function paragraph(lines, ctx) {
  // Context files often put one labeled fact per line ("Source: ..."). Keep those lines apart.
  return lines
    .map((l, k) => (k > 0 && /^[A-Z][\w ]{0,30}:\s/.test(l.trim()) ? '<br>' : '') + inline(l.trim(), ctx))
    .join('\n');
}

function list(lines, ctx) {
  const first = lines[0].match(LIST_RE);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  for (const line of lines) {
    const m = line.match(LIST_RE);
    if (m && m[1].length <= base + 1) {
      items.push({ lines: [m[3]], indent: m[1].length + m[2].length + 1 });
    } else if (items.length) {
      const item = items[items.length - 1];
      const lead = line.match(/^\s*/)[0].length;
      item.lines.push(line.slice(Math.min(lead, item.indent)));
    }
  }
  const html = items.map(({ lines: itemLines }) => {
    let text = itemLines.join('\n').replace(/\s+$/, '');
    let task = '';
    const t = text.match(/^\[([ xX])\]\s+/);
    if (t) {
      task = `<span class="task${t[1] === ' ' ? '' : ' done'}" aria-hidden="true"></span>`;
      text = text.slice(t[0].length);
    }
    let inner = blocks(text, ctx);
    if (/^<p>/.test(inner)) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
    return `<li${task ? ' class="has-task"' : ''}>${task}${inner}</li>`;
  });
  const start = ordered && parseInt(first[2], 10) !== 1 ? ` start="${parseInt(first[2], 10)}"` : '';
  return ordered ? `<ol${start}>${html.join('')}</ol>` : `<ul>${html.join('')}</ul>`;
}

function inline(src, ctx) {
  if (!src) return '';
  ctx.evidence = ctx.evidence && ctx.edgeType !== 'references' ? ctx.evidence : plainEvidence(src);
  const tokens = [];
  const hold = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = src;
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, code) => {
    const c = code.trim();
    const html = `<code>${esc(c)}</code>`;
    if (!PATH_FULL.test(c)) return hold(html);
    const res = ctx.resolve(c);
    return hold(res && (res.exists || res.inContext) ? link(res, html, ctx) : html);
  });
  s = s.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, alt, url) => hold(image(alt, url, ctx)));
  s = s.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, label, url) => hold(link(ctx.resolve(url), simple(label), ctx)));
  s = s.replace(URL_RE, (url) => hold(`<a href="${attr(url)}" target="_blank" rel="noopener">${esc(url)}</a>`));
  s = s.replace(PATH_RE, (_, pre, p) => pre + hold(link(ctx.resolve(p), esc(p), ctx)));
  s = emphasis(esc(s));
  return s.replace(/\u0000(\d+)\u0000/g, (_, k) => tokens[Number(k)]);
}

function simple(text) {
  return emphasis(esc(text)).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function emphasis(s) {
  return s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*]*?[^\s*])\*(?![\w*])/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)(.*?\S)~~/g, '<del>$1</del>');
}

function link(res, label, ctx) {
  if (!res) return label;
  if (res.kind === 'url') return `<a href="${attr(res.href)}" target="_blank" rel="noopener">${label}</a>`;
  ctx.ref(res);
  const cls = `ref ref-${res.kind}${res.exists ? '' : ' missing'}`;
  return `<a class="${cls}" href="#/n/${attr(encodeURIComponent(res.id))}"${res.exists ? '' : ' title="Missing file"'}>${label}</a>`;
}

function image(alt, url, ctx) {
  const res = ctx.resolve(url);
  if (!res) return esc(alt);
  if (res.kind === 'url') return `<img src="${attr(res.href)}" alt="${attr(alt)}" loading="lazy">`;
  ctx.ref(res);
  const type = IMAGE_TYPES[path.extname(res.abs).toLowerCase()];
  const data = res.exists && type ? embed(res.abs, type) : null;
  if (!data) return link(res, esc(alt || url), { ...ctx, ref() {} });
  return `<figure><a href="#/n/${attr(encodeURIComponent(res.id))}"><img src="${data}" alt="${attr(alt)}" loading="lazy"></a>${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}</figure>`;
}

const embedCache = new Map();
function embed(abs, type) {
  if (embedCache.has(abs)) return embedCache.get(abs);
  let data = null;
  try {
    const stat = fs.statSync(abs);
    if (stat.isFile() && stat.size <= MAX_EMBED_BYTES) data = `data:${type};base64,${fs.readFileSync(abs).toString('base64')}`;
  } catch { /* unreadable files stay links */ }
  embedCache.set(abs, data);
  return data;
}

// ---------------------------------------------------------------------------
// Output

function renderPage(data) {
  const css = fs.readFileSync(path.join(HERE, 'report', 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(HERE, 'report', 'app.js'), 'utf8');
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="context skill render.mjs">
<title>${esc(data.title)} · Project context</title>
<script>(function(){try{var t=localStorage.getItem('context-report-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}})()</script>
<style>${css}</style>
</head>
<body>
<div class="app" id="app">
  <aside class="sidebar" id="sidebar">
    <a class="brand" href="#/">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 21 8l-9 5-9-5z"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5" fill="none"/></svg></span>
      <span class="brand-text"><span class="brand-title">${esc(data.title)}</span><span class="brand-sub">${esc(data.contextPath)}</span></span>
    </a>
    <label class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <input id="search" type="search" placeholder="Search context" autocomplete="off" spellcheck="false" aria-label="Search context">
      <kbd>/</kbd>
    </label>
    <nav id="nav" aria-label="Context"></nav>
    <div id="results" class="results" hidden></div>
    <footer class="side-foot">
      <span id="generated"></span>
      <button class="icon-btn" id="theme" type="button" aria-label="Toggle theme" title="Toggle theme">
        <svg class="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>
      </button>
    </footer>
  </aside>
  <main class="main" id="main"><article class="page" id="page"></article></main>
</div>
<script type="application/json" id="context-data">${json}</script>
<script>${js}</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Helpers

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

function isInside(p, dir) {
  const rel = path.relative(dir, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function hrefFrom(output, abs) {
  return path.relative(path.dirname(output), abs).split(path.sep).map(encodeURIComponent).join('/') || '.';
}

function slug(text) {
  return text.toLowerCase().trim().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function humanize(name) {
  const s = name.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plainEvidence(text) {
  const s = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > 240 ? s.slice(0, 237).trimEnd() + '...' : s;
}

function levelRank(level) {
  return { error: 0, warning: 1, info: 2 }[level] ?? 3;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attr(s) {
  return esc(s).replace(/"/g, '&quot;');
}

main();
