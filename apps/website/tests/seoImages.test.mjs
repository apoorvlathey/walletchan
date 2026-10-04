import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(new URL('../package.json', import.meta.url));
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));
const root = new URL('../../../', import.meta.url);
for (const file of ['walletchan-icon.png', 'walletchan-icon-nobg.png']) {
  test(`${file} is smaller without changing dimensions, visible pixels or animation`, async () => {
    const path = `apps/website/public/images/${file}`;
    const before = execFileSync('git', ['show', `bfe5c4bf:${path}`], { cwd: root, maxBuffer: 20_000_000 });
    const after = readFileSync(new URL(path, root));
    assert.ok(after.length < before.length, `${after.length} must be smaller than ${before.length}`);
    const oldMeta = await sharp(before, { animated: true }).metadata();
    const newMeta = await sharp(after, { animated: true }).metadata();
    for (const key of ['width', 'height', 'pages', 'pageHeight', 'loop', 'delay', 'hasAlpha']) assert.deepEqual(newMeta[key], oldMeta[key], key);
    const pixels = async (buffer) => {
      const data = await sharp(buffer, { animated: true }).ensureAlpha().raw().toBuffer();
      // Transparent RGB values are not visible; alpha and every visible channel must match.
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 0) data.fill(0, i, i + 3);
      return data;
    };
    assert.ok((await pixels(before)).equals(await pixels(after)), 'decoded visible pixels must be identical');
    console.log(`${file}: ${before.length} -> ${after.length} bytes; dimensions/pixels/timing identical`);
  });
}
