import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { get } from 'node:http';
function hostResponse(path, host) {
  return new Promise((resolve, reject) => {
    get(`${origin}${path}`, { headers: { Host: host } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    }).on('error', reject);
  });
}
test('existing public website route descriptions explain their task', () => {
  for (const route of ['bridge/page', 'coins/layout', 'mainnet/layout', 'mainnet/claim/layout', 'migrate/layout', 'os/layout', 'stake/layout']) {
    const source = readFileSync(new URL(`../app/${route}.tsx`, import.meta.url), 'utf8');
    const description = source.match(/description:\s*"([^"]+)"/)?.[1];
    assert.ok(description?.length >= 120, `${route}: ${description?.length} characters`);
  }
});
const origin = process.env.WEBSITE_TEST_URL ?? 'http://localhost:3037';
async function html(path) {
  const response = await fetch(`${origin}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
  assert.equal(response.status, 200);
  return response.text();
}
test('public marketing pages have absolute self canonicals and useful descriptions', async () => {
  for (const [path, canonical] of [['/', 'https://walletchan.com'], ['/compare', 'https://compare.walletchan.com/'], ['/roadmap', 'https://walletchan.com/roadmap']]) {
    const page = await html(path);
    const canonicals = [...page.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(canonicals, [canonical], path);
    const descriptions = [...page.matchAll(/<meta\b[^>]*name="description"[^>]*content="([^"]+)"/g)];
    assert.equal(descriptions.length, 1, path);
    assert.ok(descriptions[0][1].length >= 120, path);
    assert.equal([...page.matchAll(/<title\b[^>]*>/g)].length, 1, path);
    assert.match(page, /<h1\b/, path);
    for (const property of ['og:url', 'og:image']) {
      const value = page.match(new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]+)"`))?.[1];
      assert.ok(value && new URL(value).protocol === 'https:', `${path}: ${property}`);
    }
  }
});

test('each marketing host discovers only its own exact public sitemap', async () => {
  for (const [host, expected] of [
    ['walletchan.com', ['https://walletchan.com', 'https://walletchan.com/roadmap']],
    ['compare.walletchan.com', ['https://compare.walletchan.com/']],
  ]) {
    const robots = await hostResponse('/robots.txt', host);
    assert.equal(robots.status, 200, host);
    const advertised = [...robots.body.matchAll(/^Sitemap: (.+)$/gm)].map(match => match[1]);
    assert.deepEqual(advertised, [`https://${host}/sitemap.xml`], host);
    const sitemap = await hostResponse(new URL(advertised[0]).pathname, host);
    assert.equal(sitemap.status, 200, host);
    assert.match(sitemap.headers['content-type'], /xml/);
    const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
    assert.deepEqual(locations, expected, host);
    assert.ok(locations.every(location => new URL(location).hostname === host));
    assert.match(robots.body, /Disallow: \/api\//);
    assert.doesNotMatch(robots.body, /Disallow: \/(?:test|go|discord|privacy-pools-explorer)/);
  }
});

test('direct sitemap requests never contain cross-host or query URLs', async () => {
  for (const [host, expected] of [
    ['walletchan.com', ['https://walletchan.com', 'https://walletchan.com/roadmap']],
    ['compare.walletchan.com', ['https://compare.walletchan.com/']],
  ]) {
    const response = await hostResponse('/sitemap.xml?private=not-a-page', host);
    assert.equal(response.status, 200);
    assert.deepEqual([...response.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), expected, host);
    assert.equal(response.headers['cache-control'], 'no-store');
  }
});

test('source has no shared static mixed-host crawler files', () => {
  for (const file of ['robots.txt', 'sitemap.xml']) {
    assert.throws(() => readFileSync(new URL(`../public/${file}`, import.meta.url)), { code: 'ENOENT' });
  }
});

test('intentional noindex and fallback-host exclusions remain intact', async () => {
  for (const path of ['/discord', '/test', '/privacy-pools-explorer', '/go']) {
    assert.match(await html(path), /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/, path);
  }
  for (const host of ['walletchan.eth.sh', 'bankrwallet.app']) {
    const response = await hostResponse('/', host);
    assert.match(response.headers['x-robots-tag'] ?? '', /noindex/, host);
  }
});

test('unapproved hosts do not discover marketing sitemaps', async () => {
  for (const host of ['localhost', 'unknown.example', 'walletchan.com.attacker.example', 'stake.walletchan.com', 'test.walletchan.com', 'walletchan.eth.sh']) {
    const robots = await hostResponse('/robots.txt', host);
    assert.equal(robots.status, 200, host);
    assert.doesNotMatch(robots.body, /^Sitemap:/m, host);
    assert.match(robots.body, /Allow: \/\n/);
    const sitemap = await hostResponse('/sitemap.xml', host);
    assert.equal(sitemap.status, 404, host);
    assert.doesNotMatch(sitemap.body, /<loc>/, host);
  }
});

test('host rewrites preserve comparison metadata, app canonicals and legacy exclusions', async () => {
  const compare = await hostResponse('/', 'compare.walletchan.com');
  assert.equal(compare.status, 200);
  assert.match(compare.body, /<link[^>]*rel="canonical"[^>]*href="https:\/\/compare.walletchan.com\/"/);
  assert.match(compare.body, /<h1\b[^>]*>Wallet Tokens/);
  for (const host of ['stake.walletchan.com', 'test.walletchan.com']) {
    const response = await hostResponse('/', host);
    assert.equal(response.status, 200, host);
    assert.doesNotMatch(response.body, /<link[^>]*rel="canonical"[^>]*href="https:\/\/walletchan.com"/, host);
    if (host === 'test.walletchan.com') assert.match(response.body, /name="robots"[^>]*content="[^"]*noindex/);
  }
  for (const host of ['bankrwallet.app', 'compare.bankrwallet.app', 'coins.bankrwallet.app']) {
    const response = await hostResponse('/', host);
    assert.equal(response.status, 200, host);
    assert.match(response.headers['x-robots-tag'], /noindex, nofollow/);
    assert.match(response.body, /name="robots"[^>]*content="[^"]*noindex/);
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const crawler = await hostResponse(path, host);
      assert.match(crawler.headers['x-robots-tag'], /noindex, nofollow/);
      assert.doesNotMatch(crawler.body, /<loc>|^Sitemap:/m);
    }
  }
  const retired = await hostResponse('/', 'coins.walletchan.com');
  assert.equal(retired.status, 307);
  assert.equal(retired.headers.location, 'https://walletchan.com/');
});

test('public leaderboard has a real visible primary heading', async () => {
  const page = await html('/compare');
  assert.match(page, /<h1\b[^>]*>Wallet Tokens<br\s*\/?>(?:\s*)Leaderboard<\/h1>/);
});
