const http = require('http');
const https = require('https');

const METABASE_URL = (process.env.METABASE_URL || '').replace(/\/$/,'');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PORT = process.env.PORT || 3000;

if (!METABASE_URL) { console.error('METABASE_URL required'); process.exit(1); }

const target = new URL(METABASE_URL);
const lib = target.protocol === 'https:' ? https : http;

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Metabase-Session, Authorization',
  'Access-Control-Max-Age': '86400',
};

http.createServer((req, res) => {
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k,v));
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const headers = { ...req.headers, host: target.hostname };
    delete headers['content-length'];
    const opts = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: req.url, method: req.method, headers
    };
    const proxy = lib.request(opts, mbRes => {
      const out = [];
      mbRes.on('data', c => out.push(c));
      mbRes.on('end', () => {
        Object.entries(mbRes.headers).forEach(([k,v]) => {
          if (!k.toLowerCase().startsWith('access-control')) res.setHeader(k,v);
        });
        res.writeHead(mbRes.statusCode);
        res.end(Buffer.concat(out));
      });
    });
    proxy.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
    if (body) proxy.write(body);
    proxy.end();
  });
}).listen(PORT, () => console.log('Proxy ' + PORT + ' -> ' + METABASE_URL));