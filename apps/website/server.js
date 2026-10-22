const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const dev = false;
const appDir = '/home/entrusus/entrust-africa';
const app = next({ dev, dir: appDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;

    // FIX: Catch the /_next/image request and serve the file DIRECTLY
    if (pathname === '/_next/image' && query.url) {
      // Clean the URL (remove leading slashes if they exist twice)
      const cleanUrl = query.url.replace(/^\/+/, ''); 
      const imagePath = path.join(appDir, 'public', cleanUrl);

      if (fs.existsSync(imagePath)) {
        // Automatically detect content type (jpeg/png)
        const ext = path.extname(imagePath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
        
        res.writeHead(200, { 'Content-Type': contentType });
        return fs.createReadStream(imagePath).pipe(res);
      }
    }

    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000);
}).catch((err) => {
  console.error('SERVER ERROR:', err);
  process.exit(1);
});


