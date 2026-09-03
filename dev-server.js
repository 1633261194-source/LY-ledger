const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const root = __dirname;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(request.url.split('?')[0]);
  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.setHeader('Content-Type', contentTypes[path.extname(filePath)] || 'application/octet-stream');
    response.end(content);
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`玲钰记账已启动：http://localhost:${port}`);
});
