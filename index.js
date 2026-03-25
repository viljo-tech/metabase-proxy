const http = require('http');
const https = require('https');

const MB = (process.env.METABASE_URL||'').replace(/\/$/,'');
const ORIGIN = process.env.ALLOWED_ORIGIN||'*';
const PORT = process.env.PORT||3000;

if(!MB){console.error('METABASE_URL required');process.exit(1);}
const target = new URL(MB);
const lib = target.protocol==='https:'?https:http;

const cors = {
  'access-control-allow-origin':ORIGIN,
  'access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers':'Content-Type,X-Metabase-Session,Authorization',
  'access-control-max-age':'86400'
};

http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){
    res.writeHead(204,cors);
    res.end();
    return;
  }
  const chunks=[];
  req.on('data',c=>chunks.push(c));
  req.on('end',()=>{
    const body=chunks.length?Buffer.concat(chunks):null;
    const hdrs={...req.headers,host:target.hostname};
    delete hdrs['content-length'];
    const opts={
      hostname:target.hostname,
      port:target.port||(target.protocol==='https:'?443:80),
      path:req.url,method:req.method,headers:hdrs
    };
    const proxy=lib.request(opts,mbRes=>{
      const out=[];
      mbRes.on('data',c=>out.push(c));
      mbRes.on('end',()=>{
        const h={...cors,'content-type':mbRes.headers['content-type']||'application/json'};
        res.writeHead(mbRes.statusCode,h);
        res.end(Buffer.concat(out));
      });
    });
    proxy.on('error',e=>{
      res.writeHead(502,cors);
      res.end(JSON.stringify({error:e.message}));
    });
    if(body)proxy.write(body);
    proxy.end();
  });
}).listen(PORT,()=>console.log('proxy '+PORT+' -> '+MB));