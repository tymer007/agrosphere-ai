// Local dev server (no dependencies): `node dev-server.mjs` -> http://localhost:3000
// - Clean URLs (/home serves home.html, /home.html redirects to /home, / redirects to /home)
// - Runs the Vercel functions in /api with variables from .env / .env.local
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

for (const file of ['.env', '.env.local']) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };

async function runApi(name, req, res) {
    const file = path.join(ROOT, 'api', `${name}.js`);
    if (!fs.existsSync(file)) return send(res, 404, 'Not found');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.body = raw ? JSON.parse(raw) : {};
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (obj) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
    };
    const mod = await import(pathToFileURL(file).href + `?t=${fs.statSync(file).mtimeMs}`);
    try {
        await mod.default(req, res);
    } catch (err) {
        console.error(err);
        if (!res.writableEnded) res.status(500).json({ error: err.message });
    }
}

function send(res, code, body, type = 'text/plain') {
    res.writeHead(code, { 'Content-Type': type });
    res.end(body);
}

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let p = decodeURIComponent(url.pathname);

    if (p.startsWith('/api/')) return runApi(p.slice(5).replace(/\/$/, ''), req, res);
    if (p === '/' || p === '/index' || p === '/index.html') return res.writeHead(302, { Location: '/home' }).end();
    if (p.endsWith('.html')) return res.writeHead(301, { Location: p.slice(0, -5) + url.search }).end();

    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || p.includes('/.')) return send(res, 403, 'Forbidden');
    if (!path.extname(file)) file += '.html';
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, '404 - page not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Agrosphere AI running at http://localhost:${PORT}`));
