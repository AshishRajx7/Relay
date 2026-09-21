const http = require('http');
function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ ok: false, err: e.message }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false, err: 'timeout' }); });
  });
}
ping('http://127.0.0.1:3000/api/v1/health').then((r) => console.log(JSON.stringify(r, null, 2)));
