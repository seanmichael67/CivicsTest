/**
 * Generates the indexable surface for the civics test:
 *   questions/<slug>.html   one page per official question (128)
 *   questions/index.html    hub linking to all of them
 *   sitemap.xml, robots.txt
 *
 * The question data lives inline in index.html so the app stays a single
 * self-contained file. This reads it back out rather than duplicating it,
 * so the pages can never drift from the app.
 *
 * Usage: node tools/build-seo.mjs [baseUrl]
 *   node tools/build-seo.mjs https://civicstest.vercel.app
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'https://seanmichael67.github.io/CivicsTest').replace(/\/+$/, '');

// og:image has to be absolute -- relative paths are ignored by every scraper --
// so it derives from BASE like the canonicals do, and switching hosts stays a
// single re-run rather than a hunt through hand-edited tags.
const OG_IMAGE = `${BASE}/assets/brand/og-1200x630.png`;
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

/* ---------- read the questions straight out of the app ---------- */
const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const match = app.match(/const QUESTIONS = (\[[\s\S]*?\n\];)/);
if (!match) throw new Error('Could not find QUESTIONS array in index.html');
const QUESTIONS = JSON.parse(match[1].replace(/;\s*$/, ''));
if (QUESTIONS.length !== 128) throw new Error(`Expected 128 questions, got ${QUESTIONS.length}`);

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonEsc = s => JSON.stringify(String(s));

function slugify(s) {
  const base = s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  if (base.length <= 70) return base;
  // trim to a word boundary rather than mid-word
  return base.slice(0, 70).replace(/-[^-]*$/, '');
}

// Answers tied to whoever currently holds an office change after elections and
// appointments. Those pages get an explicit freshness warning, which is both
// honest and the kind of unique content that keeps them from reading as thin.
//
// Match on "now" and "your", NOT on office names. Most questions mentioning an
// office have permanent answers -- "Name one power of the president" and "Who
// was president during the Great Depression" never change, and warning that
// they do is simply wrong. Matching office names flagged 27 questions, 19 of
// them incorrectly; this flags the 8 that actually depend on the current
// officeholder or on where the applicant lives.
const VOLATILE = /\bnow\b|\byour\b/i;
const isVolatile = q => VOLATILE.test(q.question);

const slugs = new Map();
for (const q of QUESTIONS) {
  let s = slugify(q.question);
  while ([...slugs.values()].includes(s)) s += `-${q.number}`;
  slugs.set(q.number, s);
}
// Directory-style output (<slug>/index.html) resolves identically on GitHub
// Pages, Vercel, Netlify and a plain static server. A flat <slug>.html would
// need host-specific cleanUrls rewriting, and a canonical that 404s on the
// wrong host is worse than no canonical at all.
const urlFor = q => `${BASE}/questions/${slugs.get(q.number)}/`;

const answerLine = q => q.answers.length === 1
  ? q.answers[0]
  : q.answers.slice(0, 3).join('; ') + (q.answers.length > 3 ? '; and others' : '');

/* Vercel Web Analytics. Cookieless and self-hosted from the same origin, so it
   needs no consent banner and no third-party request. Served by Vercel only
   when Web Analytics is enabled on the project; elsewhere it 404s harmlessly. */
const ANALYTICS = '<script defer src="/_vercel/insights/script.js"></script>';

/* ---------- shared stylesheet (cached across all 128 pages) ---------- */
const CSS = `:root{--navy:#0f172a;--blue:#1d4ed8;--gold:#f59e0b;--text:#0f172a;--muted:#475569;--line:#dbe3ef;--bg:#f8fafc;--soft:#eff6ff}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:0 18px}
header{background:linear-gradient(135deg,#0f172a,#1d4ed8 55%,#b91c1c);color:#fff;padding:22px 0}
header a{color:#dbeafe;text-decoration:none;font-weight:800}
main{padding:26px 0 60px}
.crumb{font-size:.9rem;color:var(--muted);margin:0 0 14px}
.crumb a{color:var(--blue);text-decoration:none}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 14px 35px rgba(15,23,42,.07);margin-bottom:18px}
h1{font-size:clamp(1.5rem,4vw,2.1rem);line-height:1.25;letter-spacing:-.02em;margin:0 0 6px}
h2{font-size:1.15rem;margin:0 0 10px}
.num{display:inline-block;background:var(--soft);border:1px solid #bfdbfe;color:var(--blue);border-radius:999px;padding:4px 12px;font-size:.85rem;font-weight:800;margin-bottom:12px}
.star{background:#fef3c7;border-color:#fcd34d;color:#92400e}
ul.ans{list-style:none;padding:0;margin:0}
ul.ans li{background:var(--soft);border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin-bottom:8px;font-weight:700}
.warn{background:#fef3c7;border:1px solid #fcd34d;border-radius:14px;padding:14px;margin-top:14px;font-size:.95rem}
.cta{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;font-weight:800;border-radius:14px;padding:14px 20px;margin-top:6px}
.nav{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:6px}
.nav a{color:var(--blue);text-decoration:none;font-weight:700;max-width:48%}
.rel{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.rel a{color:var(--blue);text-decoration:none}
.qlist{display:grid;gap:8px;padding:0;margin:0;list-style:none}
.qlist a{display:block;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--text)}
.qlist a:hover{border-color:var(--blue)}
footer{color:var(--muted);font-size:.88rem;padding:0 0 40px}
footer a{color:var(--blue)}
@media(max-width:560px){.card{padding:16px;border-radius:16px}.nav a{max-width:100%}}`;

/* ---------- page shell ---------- */
/* Canonical/og/JSON-LD URLs must be absolute. Everything the browser actually
   fetches stays relative, so the pages work under a subdirectory (GitHub
   Pages), at a domain root (Vercel), or straight off the filesystem. */
function page({ title, description, canonical, body, ld, up }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="stylesheet" href="${up}assets/q.css">
${ld ? `<script type="application/ld+json">${ld}</script>` : ''}
${ANALYTICS}
</head>
<body>
<header><div class="wrap"><a href="${up}">&larr; USCIS 128 Civics Test practice</a></div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap">
<p>Questions and accepted answers come from the official USCIS 2025 civics test materials, which are in the public domain. This site is a free study aid and is <strong>not affiliated with or endorsed by USCIS or any government agency</strong>. Answers about current officeholders change after elections and appointments &mdash; always confirm at <a href="https://www.uscis.gov/citizenship/testupdates" rel="nofollow noopener">uscis.gov/citizenship/testupdates</a>.</p>
</footer>
</body>
</html>`;
}

/* ---------- write files ---------- */
fs.mkdirSync(path.join(ROOT, 'questions'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/q.css'), CSS);

const sorted = [...QUESTIONS].sort((a, b) => a.number - b.number);

sorted.forEach((q, i) => {
  const prev = sorted[i - 1], next = sorted[i + 1];
  // related = nearest neighbours by number, which follow USCIS topic order
  const related = sorted.filter(x => x.number !== q.number && Math.abs(x.number - q.number) <= 3).slice(0, 4);

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Question',
        name: q.question,
        url: urlFor(q),
        acceptedAnswer: { '@type': 'Answer', text: q.answers.join('; ') },
        ...(q.answers.length > 1 ? { suggestedAnswer: q.answers.slice(1).map(a => ({ '@type': 'Answer', text: a })) } : {})
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Civics test practice', item: `${BASE}/` },
          { '@type': 'ListItem', position: 2, name: 'All 128 questions', item: `${BASE}/questions/` },
          { '@type': 'ListItem', position: 3, name: q.question, item: urlFor(q) }
        ]
      }
    ]
  });

  const body = `<p class="crumb"><a href="../../">Practice</a> &rsaquo; <a href="../">All 128 questions</a> &rsaquo; Question ${q.number}</p>
<article class="card">
  <span class="num">Official USCIS 2025 question ${q.number} of 128</span>
  ${q.special65 ? '<span class="num star">Part of the 65/20 list</span>' : ''}
  <h1>${esc(q.question)}</h1>
  <h2>Accepted answer${q.answers.length > 1 ? 's' : ''}</h2>
  <ul class="ans">${q.answers.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
  ${q.answers.length > 1 ? `<p>Any one of these ${q.answers.length} answers is accepted. You do not need to give all of them &mdash; the officer is listening for one correct response.</p>` : '<p>Give this answer aloud when the officer asks. The civics test is spoken, not written.</p>'}
  ${q.special65 ? '<p>This question is on the <strong>65/20 list</strong>: applicants who are 65 or older and have been a lawful permanent resident for at least 20 years study only these 20 starred questions, and may take the test in their language of choice.</p>' : ''}
  ${isVolatile(q) ? '<div class="warn"><strong>This answer changes.</strong> It depends on who currently holds the office or on where you live, so it is not fixed like the historical questions. Verify the current answer at uscis.gov before your interview.</div>' : ''}
</article>
<div class="card">
  <h2>Practice saying this out loud</h2>
  <p>The civics test is administered orally &mdash; an officer reads a question and you answer by speaking. Practising by tapping multiple-choice buttons trains the wrong skill.</p>
  <p><a class="cta" href="../../">Practise with voice answering &rarr;</a></p>
</div>
<div class="card">
  <h2>Nearby questions</h2>
  <ul class="rel">${related.map(r => `<li><a href="../${slugs.get(r.number)}/">${r.number}. ${esc(r.question)}</a></li>`).join('')}</ul>
  <div class="nav">
    ${prev ? `<a href="../${slugs.get(prev.number)}/">&larr; ${prev.number}. ${esc(prev.question)}</a>` : '<span></span>'}
    ${next ? `<a href="../${slugs.get(next.number)}/">${next.number}. ${esc(next.question)} &rarr;</a>` : '<span></span>'}
  </div>
</div>`;

  const outDir = path.join(ROOT, 'questions', slugs.get(q.number));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), page({
    title: `${q.question} | USCIS Civics Test Answer`,
    description: `Official USCIS 2025 civics test question ${q.number}. Accepted answer: ${answerLine(q)}. Practise saying it out loud before your naturalization interview.`,
    canonical: urlFor(q),
    body, ld, up: '../../'
  }));
});

/* ---------- hub page ---------- */
const hubLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'All 128 USCIS 2025 civics test questions',
  numberOfItems: sorted.length,
  itemListElement: sorted.map((q, i) => ({ '@type': 'ListItem', position: i + 1, name: q.question, url: urlFor(q) }))
});

fs.writeFileSync(path.join(ROOT, 'questions', 'index.html'), page({
  title: 'All 128 USCIS Civics Test Questions and Answers (2025)',
  description: 'Every official USCIS 2025 civics test question with its accepted answers, plus the 20 starred 65/20 questions. Free, and practisable out loud.',
  canonical: `${BASE}/questions/`,
  ld: hubLd,
  up: '../',
  body: `<p class="crumb"><a href="../">Practice</a> &rsaquo; All 128 questions</p>
<div class="card">
  <h1>All 128 USCIS civics test questions</h1>
  <p>These are the official questions for the 2025 version of the naturalization civics test, which applies to anyone who filed Form N-400 on or after <strong>20 October 2025</strong>. Applicants who filed before that date take the older 100-question version.</p>
  <p>You are asked up to 20 of these and need <strong>12 correct</strong> to pass. Questions marked &starf; are on the 65/20 list.</p>
  <p><a class="cta" href="../">Practise with voice answering &rarr;</a></p>
</div>
<div class="card">
  <ul class="qlist">${sorted.map(q => `<li><a href="${slugs.get(q.number)}/">${q.number}. ${esc(q.question)}${q.special65 ? ' &starf;' : ''}</a></li>`).join('')}</ul>
</div>`
}));

/* ---------- sitemap + robots ---------- */
const urls = [
  { loc: `${BASE}/`, pri: '1.0' },
  { loc: `${BASE}/questions/`, pri: '0.9' },
  ...sorted.map(q => ({ loc: urlFor(q), pri: '0.7' }))
];
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
  `\n</urlset>\n`);

fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

/* ---------- keep the app's own canonical/og:url in step with BASE ----------
   One source of truth for the host, so switching it is a single re-run rather
   than a hunt through hand-edited tags. */
let appOut = app;
const appLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', name: 'USCIS 128 Civics Test Practice', url: `${BASE}/` },
    {
      '@type': 'LearningResource',
      name: 'USCIS 2025 civics test practice with voice answering',
      url: `${BASE}/`,
      learningResourceType: 'Quiz',
      educationalLevel: 'Adult education',
      teaches: 'United States civics, history and government for the naturalization test',
      isAccessibleForFree: true,
      inLanguage: 'en-US'
    }
  ]
});

if (/<link rel="canonical"/.test(appOut)) {
  appOut = appOut.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${BASE}/">`);
} else {
  appOut = appOut.replace(/(<meta name="robots"[^>]*>)/, `$1\n  <link rel="canonical" href="${BASE}/">`);
}
appOut = appOut.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${BASE}/">`);

// Same replace-or-insert shape as the canonical above: rewrite the tag if a
// previous run wrote one, otherwise hang it off og:url. Without this the app
// itself -- the page every ad actually lands on -- shares with no preview card.
const appOgImage = `<meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${OG_IMAGE}">`;
if (/<meta property="og:image"/.test(appOut)) {
  appOut = appOut
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${OG_IMAGE}">`)
    .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${OG_IMAGE}">`);
} else {
  appOut = appOut.replace(/(<meta property="og:url" content="[^"]*">)/, `$1\n  ${appOgImage}`);
}

appOut = appOut.replace(/\n?\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
appOut = appOut.replace(/\n?\s*<script defer src="\/_vercel\/insights\/script\.js"><\/script>/, '');
appOut = appOut.replace(/(<meta name="theme-color"[^>]*>)/,
  `$1\n  <script type="application/ld+json">${appLd}</script>\n  ${ANALYTICS}`);

// Only index.html. This used to mirror every build into CivisTest.html as well,
// which is why deleting that file never stuck -- the next build put it back.
// The misspelled URL stays alive through the vercel.json redirects, not a file.
if (appOut !== app) {
  fs.writeFileSync(path.join(ROOT, 'index.html'), appOut);
  console.log('app        canonical, og:url and JSON-LD synced in index.html');
}

console.log(`base       ${BASE}`);
console.log(`questions  ${sorted.length} pages`);
console.log(`volatile   ${sorted.filter(isVolatile).length} pages carry a freshness warning`);
console.log(`sitemap    ${urls.length} urls`);
