/**
 * Writes videos/scripts.json: one ready-to-record script per official question,
 * for the "tutor asks, you answer out loud" quiz videos.
 *
 * Like build-seo.mjs, this reads the questions straight out of index.html, so a
 * script can never disagree with the app or with the question page it links to.
 *
 * Usage: node tools/build-video-scripts.mjs [baseUrl]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'https://www.uscis128civicstest.com').replace(/\/+$/, '');

const app = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const QUESTIONS = JSON.parse(app.match(/const QUESTIONS = (\[[\s\S]*?\n\];)/)[1].replace(/;\s*$/, ''));
if (QUESTIONS.length !== 128) throw new Error(`Expected 128 questions, got ${QUESTIONS.length}`);

// Must stay identical to slugify() in build-seo.mjs or the links 404.
function slugify(s) {
  const base = s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  if (base.length <= 70) return base;
  return base.slice(0, 70).replace(/-[^-]*$/, '');
}
const slugs = new Map();
for (const q of QUESTIONS) {
  let s = slugify(q.question);
  while ([...slugs.values()].includes(s)) s += `-${q.number}`;
  slugs.set(q.number, s);
}

// Same test the app uses (isLookup in index.html): USCIS ships instructions
// instead of an answer for these eight, so the tutor must never "reveal" one.
const isLookup = q => /^Answers will vary|uscis\.gov\/citizenship\/testupdates/i.test(q.answers[0] || '');
const isOfficial = q => /uscis\.gov\/citizenship\/testupdates/i.test(q.answers[0] || '');

// USCIS uses parentheses two ways. Leading or mid-answer they mark optional
// words -- "(U.S.) Constitution" -- and the full form is always accepted, so
// keep the words and drop the brackets. Trailing, they give an alternative name
// -- "Presidents Day (Washington's Birthday)" -- and reading both aloud as one
// run-on would teach a wrong answer, so drop the alternative.
const spoken = a => a.replace(/\[[^\]]*\]/g, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

// "Name three national U.S. holidays." needs three answers, not one.
const WORDS = { one: 1, two: 2, three: 3, five: 5 };
function howMany(q) {
  const m = q.question.match(/\b(?:name|are|what are)\s+(two|three|five)\b/i);
  return m ? WORDS[m[1].toLowerCase()] : 1;
}
const list = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

const CTA = 'Practice out loud, free, at uscis128civicstest.com';

const scripts = [...QUESTIONS].sort((a, b) => a.number - b.number).map(q => {
  const n = howMany(q);
  const url = `${BASE}/questions/${slugs.get(q.number)}/`;
  let say_answer, on_screen;
  if (isOfficial(q)) {
    say_answer = 'This answer changes after elections and appointments. Check the current name at uscis.gov before your interview.';
    on_screen = ['This answer changes', 'Check uscis.gov/citizenship/testupdates'];
  } else if (isLookup(q)) {
    say_answer = 'This answer depends on where you live. Look up yours before your interview.';
    on_screen = ['Depends on where you live', 'Look up your own answer'];
  } else {
    const picks = q.answers.slice(0, n).map(spoken);
    say_answer = n === 1
      ? (q.answers.length > 1 ? `One accepted answer is: ${picks[0]}.` : `The answer is: ${picks[0]}.`)
      : `You could say: ${list(picks)}.`;
    on_screen = q.answers.slice(0, Math.max(n, 3)).map(spoken);
  }
  return {
    number: q.number,
    on_65_20_list: q.special65,
    needs_lookup: isLookup(q),
    // 1. the tutor on camera
    say_question: q.question,
    // 2. countdown graphic while the viewer answers out loud
    pause_seconds: 3,
    pause_text: 'Say your answer out loud',
    // 3. answer card + voice-over
    say_answer,
    on_screen_answers: on_screen,
    more_answers_accepted: !isLookup(q) && q.answers.length > on_screen.length,
    // 4. end card
    end_card: CTA,
    // for the YouTube upload form
    youtube_title: `${q.question} | USCIS Civics Test 2025 Question ${q.number}`.slice(0, 100),
    youtube_description: [
      `Official USCIS 2025 civics test question ${q.number} of 128. Answer out loud before the countdown ends.`,
      '',
      `All accepted answers for this question: ${url}`,
      `Free practice that speaks and listens: ${BASE}/`,
      '',
      'The tutor in this video is an AI avatar. This is an independent study aid, not affiliated with or endorsed by USCIS. Always confirm current answers at uscis.gov/citizenship/testupdates.',
      '',
      '#citizenshiptest #uscis #civicstest #naturalization'
    ].join('\n'),
    page_url: url
  };
});

fs.mkdirSync(path.join(ROOT, 'videos'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'videos/scripts.json'), JSON.stringify(scripts, null, 2) + '\n');

const words = s => s.split(/\s+/).length;
const avgQ = scripts.reduce((t, s) => t + words(s.say_question), 0) / scripts.length;
console.log(`scripts    ${scripts.length} written to videos/scripts.json`);
console.log(`lookup     ${scripts.filter(s => s.needs_lookup).length} never reveal a fixed answer`);
console.log(`multi      ${scripts.filter(s => / and /.test(s.say_answer) && /^You could say/.test(s.say_answer)).length} need more than one answer`);
console.log(`question   averages ${avgQ.toFixed(1)} words (~${(avgQ / 2.3).toFixed(0)}s on camera)`);
