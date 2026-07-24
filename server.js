const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || null;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(require('cors')({ origin: true, credentials: true }));
app.use(express.json());

const AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const AUTH_PASS = process.env.BASIC_AUTH_PASS || 'artukcnc2026';
function basicAuth(req, res, next){
  const auth = req.headers.authorization;
  if(!auth){
    // Note: header values must be ASCII. avoid non-ASCII characters in WWW-Authenticate realm.
    res.set('WWW-Authenticate', 'Basic realm="CNC Is Emri"');
    return res.status(401).send('Unauthorized');
  }
  const [scheme, credentials] = auth.split(' ');
  if(scheme !== 'Basic' || !credentials){
    return res.status(400).send('Bad Request');
  }
  const [user, pass] = Buffer.from(credentials, 'base64').toString('utf8').split(':');
  if(user === AUTH_USER && pass === AUTH_PASS){
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="CNC İş Emri"');
  return res.status(401).send('Unauthorized');
}

app.use(basicAuth);

function defaultData(){
  return {bekleyen:[], aktif:null, tamamlanan:[], counter:0, _updatedAt:0};
}

// in-memory store cached from DB or disk
let store = defaultData();

async function ensureDb(){
  if(!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cnc_store (
      id INT PRIMARY KEY,
      payload JSONB NOT NULL
    );
  `);
}

async function loadStore(){
  if(pool){
    await ensureDb();
    const res = await pool.query('SELECT payload FROM cnc_store WHERE id = $1', [1]);
    if(res.rows.length > 0){
      store = Object.assign(defaultData(), res.rows[0].payload);
    } else {
      store = defaultData();
      await pool.query('INSERT INTO cnc_store (id, payload) VALUES ($1, $2)', [1, store]);
    }
    return;
  }

  try{
    if(fs.existsSync(DATA_FILE)){
      const txt = fs.readFileSync(DATA_FILE,'utf8');
      const parsed = JSON.parse(txt);
      store = Object.assign(defaultData(), parsed);
    } else {
      store = defaultData();
    }
  }catch(e){
    store = defaultData();
  }
}

async function writeStore(obj){
  obj._updatedAt = Date.now();
  store = Object.assign({}, obj);

  if(pool){
    await pool.query(
      'INSERT INTO cnc_store (id, payload) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload',
      [1, store]
    );
    return;
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

app.get('/api/data', (req, res) => {
  return res.json(store);
});

app.post('/api/data', async (req, res) => {
  const payload = req.body;
  try{
    await writeStore(payload);
    if(io) io.emit('data', store);
    return res.json({ ok: true });
  } catch(e){
    console.error('Write store failed', e);
    return res.status(400).json({ error: 'geçersiz payload' });
  }
});

// Serve static files (so you can open index.html via http://localhost:3000/)
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: true } });

io.on('connection', (socket) => {
  socket.emit('data', store);

  socket.on('get', ()=> socket.emit('data', store));

  socket.on('push', async (clientPayload) => {
    try{
      const clientUpdated = clientPayload && clientPayload._updatedAt ? clientPayload._updatedAt : 0;
      const serverUpdated = store._updatedAt || 0;
      if(clientUpdated > serverUpdated){
        await writeStore(clientPayload);
        io.emit('data', store);
      } else {
        socket.emit('data', store);
      }
    }catch(e){
      console.error('Socket push failed', e);
    }
  });
});

async function startServer(){
  try{
    await loadStore();
  }catch(e){
    console.error('Failed to load initial store', e);
    store = defaultData();
  }

  server.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
}

startServer();
