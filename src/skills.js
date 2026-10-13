// Skills we look for in job descriptions. Each entry is the canonical name followed by aliases.
// Add your own; matching ignores case and requires the word to stand on its own
// (so "java" does not match "javascript").
export const SKILLS = [
  ['javascript', 'js', 'es6', 'ecmascript'],
  ['typescript', 'ts'],
  ['react', 'react.js', 'reactjs'],
  ['react native'],
  ['next.js', 'nextjs'],
  ['angular', 'angularjs'],
  ['rxjs'],
  ['vue', 'vue.js', 'vuejs'],
  ['svelte'],
  ['redux', 'redux toolkit', 'rtk'],
  ['html', 'html5'],
  ['css', 'css3', 'scss', 'sass'],
  ['tailwind', 'tailwindcss', 'tailwind css'],
  ['material ui', 'mui'],
  ['webpack'],
  ['vite'],
  ['jest'],
  ['cypress'],
  ['playwright'],
  ['react testing library', 'testing library'],
  ['storybook'],
  ['accessibility', 'a11y', 'wcag'],
  ['responsive design', 'responsive web'],
  ['web performance', 'core web vitals', 'lighthouse'],
  ['graphql'],
  ['rest api', 'restful', 'rest apis'],
  ['node.js', 'node', 'nodejs'],
  ['express', 'express.js', 'expressjs'],
  ['nestjs', 'nest.js'],
  ['java'],
  ['spring boot', 'spring'],
  ['python'],
  ['django'],
  ['fastapi'],
  ['flask'],
  ['golang', 'go lang'],
  ['c#', 'csharp'],
  ['.net', 'dotnet', 'asp.net'],
  ['c++', 'cpp'],
  ['kotlin'],
  ['swift'],
  ['rust'],
  ['sql'],
  ['postgresql', 'postgres'],
  ['mysql'],
  ['mongodb', 'mongo'],
  ['redis'],
  ['elasticsearch'],
  ['kafka'],
  ['rabbitmq'],
  ['microservices', 'micro services', 'microservice'],
  ['system design', 'distributed systems'],
  ['data structures', 'algorithms', 'dsa'],
  ['aws', 'amazon web services'],
  ['azure'],
  ['gcp', 'google cloud'],
  ['docker'],
  ['kubernetes', 'k8s'],
  ['terraform'],
  ['ci/cd', 'cicd', 'jenkins', 'github actions'],
  ['git', 'github', 'gitlab'],
  ['linux'],
  ['unit testing', 'tdd'],
  ['agile', 'scrum'],
  ['oop', 'object oriented'],
  ['design patterns'],
  ['websockets', 'websocket', 'socket.io'],
  ['micro frontends', 'micro-frontends', 'microfrontends', 'module federation'],
  ['figma'],
  ['llm', 'generative ai', 'genai', 'openai', 'langchain'],
  ['machine learning', 'ml'],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Longest alias first, so "react native" wins over "react" at the same position.
const pattern = (terms) =>
  `(?<![a-z0-9])(${[...terms].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![a-z0-9+#])`;
const MATCHERS = SKILLS.map(([name, ...aliases]) => ({
  name,
  re: new RegExp(pattern([name, ...aliases]), 'i'),
  all: new RegExp(pattern([name, ...aliases]), 'gi'),
}));

// Canonical skill name for any alias, so resume keywords like "reactjs" line up with "react".
const ALIAS = new Map(SKILLS.flatMap(([name, ...aliases]) => [name, ...aliases].map((a) => [a.toLowerCase(), name])));
export const canonicalSkill = (s) => ALIAS.get(s.toLowerCase().trim()) || s.toLowerCase().trim();

export function extractSkills(text = '') {
  return MATCHERS.filter((m) => m.re.test(text)).map((m) => m.name);
}

// Where each skill appears in the text, without overlaps (longer match wins). Used to highlight postings.
export function skillSpans(text = '') {
  const spans = [];
  for (const { name, all } of MATCHERS) {
    for (const m of text.matchAll(all)) spans.push({ start: m.index, end: m.index + m[0].length, skill: name });
  }
  spans.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const out = [];
  let last = 0;
  for (const s of spans) {
    if (s.start >= last) {
      out.push(s);
      last = s.end;
    }
  }
  return out;
}
