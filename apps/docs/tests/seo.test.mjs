import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const YAML = require(require.resolve('yaml', { paths: [require.resolve('vocs/config')] }));
test('every MDX frontmatter is valid YAML', () => {
  for (const file of mdxFiles(new URL('../src/pages', import.meta.url).pathname)) {
    const frontmatter = readFileSync(file, 'utf8').split('---')[1];
    assert.equal(typeof YAML.parse(frontmatter).description, 'string', file);
  }
});

function mdxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? mdxFiles(join(dir, entry.name)) : entry.name.endsWith('.mdx') ? [join(dir, entry.name)] : []);
}
test('docs descriptions explain the page task rather than a short label', () => {
  for (const file of mdxFiles(new URL('../src/pages', import.meta.url).pathname)) {
    const description = readFileSync(file, 'utf8').match(/^description: (.+)$/m)?.[1];
    assert.ok(description?.length >= 120, `${file}: ${description?.length} characters`);
  }
});

const origin = process.env.DOCS_TEST_URL ?? 'http://localhost:5187';
async function html(path) {
  const response = await fetch(`${origin}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
  assert.equal(response.status, 200);
  return response.text();
}

test('every docs page renders one SEO owner, a real H1, and absolute canonical/OG URLs', async () => {
  const files = mdxFiles(new URL('../src/pages', import.meta.url).pathname);
  assert.equal(files.length, 55);
  for (const file of files) {
    const relative = file.split('/src/pages/')[1].replace(/\.mdx$/, '');
    const path = relative === 'index' ? '/' : `/${relative}`;
    const page = await html(path);
    assert.equal([...page.matchAll(/<title\b[^>]*>/g)].length, 1, path);
    assert.equal([...page.matchAll(/<meta\b[^>]*name="description"/g)].length, 1, path);
    assert.match(page, /<h1\b[^>]*>[^<]+/, path);
    const canonical = [...page.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
    assert.deepEqual(canonical.map(match => match[1]), [`https://docs.walletchan.com${path}`], path);
    for (const property of ['og:url', 'og:image']) {
      const value = page.match(new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]+)"`))?.[1];
      assert.ok(value && new URL(value).protocol === 'https:', `${path}: ${property}`);
    }
  }
});

test('docs sitemap covers exactly the authored public MDX pages', async () => {
  const response = await fetch(`${origin}/sitemap.xml`);
  assert.equal(response.status, 200);
  const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]).sort();
  const expected = mdxFiles(new URL('../src/pages', import.meta.url).pathname).map(file => {
    const relative = file.split('/src/pages/')[1].replace(/\.mdx$/, '');
    return `https://docs.walletchan.com${relative === 'index' ? '/' : `/${relative}`}`;
  }).sort();
  assert.equal(new Set(urls).size, 55);
  assert.deepEqual(urls, expected);
});

test('feature atlas emits only its page-specific title and description', async () => {
  const page = await html('/overview/feature-atlas');
  assert.equal([...page.matchAll(/<title\b[^>]*>/g)].length, 1);
  assert.equal([...page.matchAll(/<meta\b[^>]*name="description"/g)].length, 1);
  assert.match(page, /<title>WalletChan feature atlas · WalletChan<\/title>/);
});
