const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuid } = require('uuid');
const { db } = require('../db-mysql');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 12 } });
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const text = (value, length = 5000) => String(value || '').trim().slice(0, length);

async function ensureSchema() {
  await db.prepare(`CREATE TABLE IF NOT EXISTS blog_posts (
    id VARCHAR(36) PRIMARY KEY, title VARCHAR(180) NOT NULL, excerpt TEXT NULL, content LONGTEXT NULL,
    cover_image VARCHAR(500) NULL, published_at DATETIME NULL, is_published TINYINT(1) NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS blog_images (
    id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL, image_url VARCHAR(500) NOT NULL,
    caption VARCHAR(255) NULL, sort_order INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL,
    INDEX idx_blog_images_post (post_id)
  )`).run();
}
router.use(async (req, res, next) => { try { await ensureSchema(); next(); } catch (error) { res.status(500).json({ error: 'Erro ao preparar o blog: ' + error.message }); } });

const mapPost = (post, images = []) => ({ id: post.id, title: post.title, excerpt: post.excerpt || '', content: post.content || '', coverImage: post.cover_image || '', publishedAt: post.published_at || '', published: !!post.is_published, featured: !!post.is_featured, createdAt: post.created_at, updatedAt: post.updated_at, images: images.map(image => ({ id: image.id, imageUrl: image.image_url, caption: image.caption || '', sortOrder: Number(image.sort_order) || 0 })) });
const listPosts = async ({ publicOnly = false } = {}) => {
  const posts = await db.prepare(`SELECT * FROM blog_posts ${publicOnly ? 'WHERE is_published = 1' : ''} ORDER BY is_featured DESC, COALESCE(published_at, created_at) DESC`).all();
  if (!posts.length) return [];
  const images = await db.prepare('SELECT * FROM blog_images ORDER BY sort_order ASC, created_at ASC').all();
  const grouped = images.reduce((all, image) => { (all[image.post_id] = all[image.post_id] || []).push(image); return all; }, {});
  return posts.map(post => mapPost(post, grouped[post.id] || []));
};

router.get('/public', async (req, res) => { try { res.json(await listPosts({ publicOnly: true })); } catch (error) { res.status(500).json({ error: 'Erro ao carregar histórias: ' + error.message }); } });
router.get('/', async (req, res) => { try { res.json(await listPosts()); } catch (error) { res.status(500).json({ error: 'Erro ao carregar publicações: ' + error.message }); } });

router.post('/', async (req, res) => {
  try {
    const title = text(req.body?.title, 180); if (title.length < 3) return res.status(400).json({ error: 'Informe um título com ao menos 3 caracteres.' });
    const id = uuid(), timestamp = now(), published = !!req.body?.published, featured = !!req.body?.featured;
    if (featured) await db.prepare('UPDATE blog_posts SET is_featured = 0').run();
    await db.prepare('INSERT INTO blog_posts (id, title, excerpt, content, cover_image, published_at, is_published, is_featured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, title, text(req.body?.excerpt, 600), text(req.body?.content, 20000), text(req.body?.coverImage, 500) || null, published ? (req.body?.publishedAt || timestamp) : null, published ? 1 : 0, featured ? 1 : 0, timestamp, timestamp);
    res.status(201).json((await listPosts()).find(post => post.id === id));
  } catch (error) { res.status(500).json({ error: 'Erro ao criar publicação: ' + error.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const title = text(req.body?.title, 180); if (title.length < 3) return res.status(400).json({ error: 'Informe um título com ao menos 3 caracteres.' });
    const existing = await db.prepare('SELECT id FROM blog_posts WHERE id = ?').get(req.params.id); if (!existing) return res.status(404).json({ error: 'Publicação não encontrada.' });
    const published = !!req.body?.published, featured = !!req.body?.featured;
    if (featured) await db.prepare('UPDATE blog_posts SET is_featured = 0 WHERE id <> ?').run(req.params.id);
    await db.prepare('UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, cover_image = ?, published_at = ?, is_published = ?, is_featured = ?, updated_at = ? WHERE id = ?').run(title, text(req.body?.excerpt, 600), text(req.body?.content, 20000), text(req.body?.coverImage, 500) || null, published ? (req.body?.publishedAt || now()) : null, published ? 1 : 0, featured ? 1 : 0, now(), req.params.id);
    res.json((await listPosts()).find(post => post.id === req.params.id));
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar publicação: ' + error.message }); }
});
router.delete('/:id', async (req, res) => { try { await db.prepare('DELETE FROM blog_images WHERE post_id = ?').run(req.params.id); await db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id); res.status(204).end(); } catch (error) { res.status(500).json({ error: 'Erro ao excluir publicação: ' + error.message }); } });

function imageExtension(buffer) { if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'; if (buffer[0] === 255 && buffer[1] === 216) return 'jpg'; if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'; return null; }
router.post('/:id/images', (req, res) => upload.array('images', 12)(req, res, async error => {
  if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Cada imagem deve ter no máximo 8 MB.' : 'Envie até 12 imagens.' });
  if (!req.files?.length) return res.status(400).json({ error: 'Selecione ao menos uma imagem.' });
  try {
    const post = await db.prepare('SELECT id FROM blog_posts WHERE id = ?').get(req.params.id); if (!post) return res.status(404).json({ error: 'Publicação não encontrada.' });
    const directory = path.join(__dirname, '../../uploads/blog'); await fs.mkdir(directory, { recursive: true });
    const count = await db.prepare('SELECT COUNT(*) AS total FROM blog_images WHERE post_id = ?').get(req.params.id);
    const created = [];
    for (const [index, file] of req.files.entries()) { const extension = imageExtension(file.buffer); if (!extension) continue; const filename = `${uuid()}.${extension}`; await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' }); const image = { id: uuid(), url: `/uploads/blog/${filename}`, sort: Number(count.total || 0) + index }; await db.prepare('INSERT INTO blog_images (id, post_id, image_url, caption, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(image.id, req.params.id, image.url, '', image.sort, now()); created.push({ id: image.id, imageUrl: image.url, caption: '', sortOrder: image.sort }); }
    if (!created.length) return res.status(400).json({ error: 'Use imagens JPG, PNG ou WebP válidas.' });
    res.status(201).json(created);
  } catch (err) { res.status(500).json({ error: 'Erro ao enviar imagens: ' + err.message }); }
}));
router.delete('/images/:id', async (req, res) => { try { await db.prepare('DELETE FROM blog_images WHERE id = ?').run(req.params.id); res.status(204).end(); } catch (error) { res.status(500).json({ error: 'Erro ao excluir imagem: ' + error.message }); } });
router.put('/images/:id', async (req, res) => {
  try {
    const image = await db.prepare('SELECT id FROM blog_images WHERE id = ?').get(req.params.id);
    if (!image) return res.status(404).json({ error: 'Imagem não encontrada.' });
    await db.prepare('UPDATE blog_images SET caption = ?, sort_order = ? WHERE id = ?').run(text(req.body?.caption, 255), Math.max(0, Number(req.body?.sortOrder) || 0), req.params.id);
    res.json({ id: req.params.id, caption: text(req.body?.caption, 255), sortOrder: Math.max(0, Number(req.body?.sortOrder) || 0) });
  } catch (error) { res.status(500).json({ error: 'Erro ao atualizar a imagem: ' + error.message }); }
});

module.exports = router;
