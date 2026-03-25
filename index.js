const http = require('http');
const https = require('https');
const url = require('url');

const METABASE_URL = process.env.METABASE_URL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PORT = process.env.PORT || 3000;

if (!METABASE_URL) {
  console.error('ERROR: METABASE_URL environment variable is required');
  process.exit(1);
}

const target = url.parse(METABASE_URL);
const lib = target.protocol === 'https:' ? https : http;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Metabase-Session, Authorization',
  'Access-Control-Max-Age': '86400',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const options = {
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: target.hostname },
    };
    const proxy = lib.request(options, (mbRes) => {
      const resChunks = [];
      mbRes.on('data', c => resChunks.push(c));
      mbRes.on('end', () => {
        res.writeHead(mbRes.statusCode, { ...mbRes.headers, ...corsHeaders });
        res.end(Buffer.concat(resChunks));
      });
    });
    proxy.on('error', (e) => {
      res.writeHead(502, corsHeaders);
      res.end(JSON.stringify({ error: 'Proxy error: ' + e.message }));
    });
    if (body) proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => {
  console.log('Metabase proxy on port ' + PORT + ', forwarding to ' + METABASE_URL);
});