// Kare: bağımlılıksız küçük statik dosya sunucusu (Render web servisi için).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 10000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Yasak'); }
  fs.readFile(file, (err, data) => {
    if (err) {
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Bulunamadı'); }
        res.writeHead(200, { 'Content-Type': TYPES['.html'] });
        res.end(idx);
      });
    }
    const ext = path.extname(file).toLowerCase();
    const noCache = ['.html', '.js', '.css', '.webmanifest'].includes(ext);
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': noCache ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    };
    const etag = '"' + crypto.createHash('md5').update(data).digest('hex') + '"';
    headers['ETag'] = etag;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    const textual = ['.html', '.css', '.js', '.json', '.svg', '.webmanifest'].includes(ext);
    if (textual && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      return res.end(zlib.gzipSync(data));
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, () => console.log('Kare ' + PORT + ' portunda çalışıyor'));
