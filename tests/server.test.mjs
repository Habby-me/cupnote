import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../server.mjs';

let server, url;
before(async () => {
  server = createPreviewServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
test('serves the app and nested ES modules with proper MIME types', async () => {
  const home = await fetch(url);
  assert.equal(home.status, 200); assert.match(await home.text(), /杯间日记/);
  const module = await fetch(`${url}/lib/journal.js`);
  assert.equal(module.status, 200); assert.match(module.headers.get('content-type'), /javascript/);
  assert.equal(module.headers.get('x-content-type-options'), 'nosniff');
});
test('HEAD has headers but no response body', async () => {
  const response = await fetch(url, { method: 'HEAD' });
  assert.equal(response.status, 200); assert.equal(await response.text(), '');
});
test('missing files return 404 and unsupported methods return 405', async () => {
  assert.equal((await fetch(`${url}/missing.js`)).status, 404);
  const response = await fetch(url, { method: 'POST' });
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
test('encoded traversal, null bytes and malformed encodings cannot expose source files', async () => {
  assert.equal((await fetch(`${url}/%2e%2e%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${url}/%00`)).status, 403);
  assert.equal((await fetch(`${url}/%E0%A4%A`)).status, 400);
});
