const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const DATA_FILE = path.join(__dirname, 'data.json');
const PORT = process.env.PORT || 3000;

app.use(require('cors')());
app.use(express.json());

function defaultData(){
  return {bekleyen:[], aktif:null, tamamlanan:[], counter:0, _updatedAt:0};
}

// in-memory store (cached from disk)
let store = defaultData();

function loadStore(){
  try{
    if(fs.existsSync(DATA_FILE)){
      const txt = fs.readFileSync(DATA_FILE,'utf8');
      const parsed = JSON.parse(txt);
      store = Object.assign(defaultData(), parsed);
    } else {
      store = defaultData();
    }
  }catch(e){ store = defaultData(); }
}

function writeStore(obj){
  obj._updatedAt = Date.now();
  store = Object.assign({}, obj);
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

loadStore();

app.get('/api/data', (req, res) => {
  return res.json(store);
});

app.post('/api/data', (req, res) => {
  const payload = req.body;
  try{
    writeStore(payload);
    // notify sockets about update
    if(io) io.emit('data', store);
    return res.json({ ok: true });
  } catch(e){
    return res.status(400).json({ error: 'geçersiz payload' });
  }
});

// Serve static files (so you can open index.html via http://localhost:3000/)
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  // send current store
  socket.emit('data', store);

  socket.on('get', ()=> socket.emit('data', store));

  socket.on('push', (clientPayload) => {
    try{
      const clientUpdated = clientPayload && clientPayload._updatedAt ? clientPayload._updatedAt : 0;
      const serverUpdated = store._updatedAt || 0;
      if(clientUpdated > serverUpdated){
        writeStore(clientPayload);
        io.emit('data', store);
      } else {
        // client older; send current
        socket.emit('data', store);
      }
    }catch(e){/* ignore */}
  });
});

server.listen(PORT, () => console.log(`Sunucu çalışıyor: http://localhost:${PORT}`));
