# CNC İş Emri Takip - Sync Sunucu

Bu proje için basit bir Node/Express sunucusu oluşturdum. Sunucu `data.json` dosyasında `index.html` uygulamasının senkronizasyon verisini saklar.

Çalıştırma:

```bash
npm install
npm start
```

Sunucu çalışınca:
- `GET /api/data` : Kayıtlı veriyi JSON olarak döner.
- `POST /api/data`: Gönderilen JSON'u `data.json` olarak kaydeder.
- `http://localhost:3000/` : Dizin kökünden statik dosyaları (ör. `index.html`) servis eder.

Notlar:
- Sunucu Basic Auth korumalıdır. Varsayılan kullanıcı: `admin`, parola: `cnc2026`.
- `index.html` artık otomatik olarak sunucuya bağlanır ve sunucudaki en son veriyi yüklemeye çalışır.
- Eğer sunucuya bağlanılamazsa, tarayıcı yerel veriyi kullanır; ancak sunucuya bağlanabildiğinde en son sunucu verisi öncelikli olur.
- Farklı tarayıcılarda veya cihazlarda aynı sunucu adresini ve kimlik bilgilerini kullanarak en son veriye erişebilirsin.

Basit kullanım örneği (tarayıcı konsolu veya başka bir istemciden):

```js
// veriyi çekme
fetch('/api/data').then(r=>r.json()).then(console.log);

// veriyi güncelleme
fetch('/api/data', {method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)})
  .then(r=>r.json()).then(console.log);
```

Sonraki adımlar:
- İstersen client tarafına "Sunucuya kaydet / Sunucudan yükle" butonları ekleyebilirim.
- Ya da otomatik senkronizasyon (periyodik push/pull) ekleyebilirim.
