const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const router = require('../src/routes/member-photos.routes');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrZkAAAAASUVORK5CYII=', 'base64');

test('upload de foto: arquivo real, nome seguro, formato e tamanho validados', async () => {
  const app = express();
  app.use('/member-photos', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/member-photos`;
  let createdFile;
  const send = (bytes, name, type) => {
    const body = new FormData();
    if (bytes) body.append('photo', new Blob([bytes], { type }), name);
    return fetch(url, { method: 'POST', body });
  };
  try {
    const valid = await send(png, '../../foto.png', 'image/png');
    assert.equal(valid.status, 201);
    const result = await valid.json();
    assert.match(result.photoUrl, /^\/uploads\/members\/[a-f0-9-]{36}\.png$/);
    createdFile = path.join(__dirname, '../uploads/members', path.basename(result.photoUrl));
    assert.deepEqual(await fs.readFile(createdFile), png);
    assert.equal((await send(Buffer.from('<svg>não é PNG</svg>'), 'falsa.png', 'image/png')).status, 400);
    assert.equal((await send(Buffer.alloc(5 * 1024 * 1024 + 1), 'grande.png', 'image/png')).status, 400);
    assert.equal((await send(null)).status, 400);
  } finally {
    // Remove exclusivamente o arquivo criado por este teste.
    if (createdFile) await fs.unlink(createdFile);
    await new Promise(resolve => server.close(resolve));
  }
});
