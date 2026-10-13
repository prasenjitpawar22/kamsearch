const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Random pause between requests so we stay polite and don't look like a burst.
export const politePause = (min = 1500, max = 3500) => sleep(min + Math.random() * (max - min));

export async function request(url, { headers = {}, timeoutMs = 20000, retries = 2, as = 'text' } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });

    // Corporate proxies answer job sites with a redirect to their own "blocked" page.
    if (res.redirected && new URL(res.url).hostname !== new URL(url).hostname) {
      throw new Error(`redirected to ${new URL(res.url).hostname}; this network is probably blocking the site`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
    return as === 'json' ? res.json() : res.text();
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(s = '') {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Job descriptions arrive as HTML (sometimes HTML-escaped HTML). Store plain text only.
export function htmlToText(html = '') {
  let s = html;
  if (/&lt;\w/.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h\d|ul|ol|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
