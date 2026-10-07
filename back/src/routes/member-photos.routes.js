const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuid } = require('uuid');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
});

// Não usa o nome ou a extensão fornecidos pelo cliente para gravar o arquivo.
function imageExtension(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString('ascii', 12, 16) === 'IHDR') return 'png';
  if (buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 && buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217) return 'jpg';
  if (buffer.length >= 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

router.post('/', (req, res) => {
  upload.single('photo')(req, res, async error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'A foto deve ter no máximo 5 MB.' : 'Envie apenas uma foto em JPG, PNG ou WebP.' });
    if (!req.file) return res.status(400).json({ error: 'Selecione uma foto.' });
    const extension = imageExtension(req.file.buffer);
    if (!extension) return res.status(400).json({ error: 'Foto inválida. Utilize uma imagem JPG, PNG ou WebP.' });
    try {
      const directory = path.join(__dirname, '../../uploads/members');
      await fs.mkdir(directory, { recursive: true });
      const filename = `${uuid()}.${extension}`;
      await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
      res.status(201).json({ photoUrl: `/uploads/members/${filename}` });
    } catch (error) {
      console.error('Erro ao guardar foto do MFCista:', error);
      res.status(500).json({ error: 'Não foi possível guardar a foto. Tente novamente.' });
    }
  });
});

module.exports = router;
