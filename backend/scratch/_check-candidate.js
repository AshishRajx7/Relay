const { Client } = require('pg');
const c = new Client({ host: '127.0.0.1', port: 5432, user: 'relay', password: 'relay_dev_password', database: 'relay' });
c.connect().then(() => c.query('SELECT id, name, email FROM candidate_profile LIMIT 3'))
  .then((r) => { console.log(JSON.stringify(r.rows, null, 2)); return c.end(); })
  .catch((e) => { console.error('ERR:', e.message); process.exit(1); });
