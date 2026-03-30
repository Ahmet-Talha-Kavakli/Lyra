# 🐳 Lyra Docker Kurulum Rehberi

## 📋 Ön Koşullar

- **Docker Desktop** (Windows/Mac/Linux)
- **Docker Compose** (Docker Desktop'ta dahil)
- `.env` dosyası (zaten oluşturuldu)

---

## 🚀 Kurulum Adımları

### **1. Docker Desktop'ı Kur**

**Windows:**
1. https://www.docker.com/products/docker-desktop adresine git
2. "Docker Desktop for Windows" indir
3. Installer'ı çalıştır
4. "Install required Windows components for WSL 2" seçeneğini işaretle
5. Kurulum bittikten sonra bilgisayarı yeniden başlat

**Kontrol:**
```bash
docker --version
docker-compose --version
```

---

### **2. Docker Compose'ı Başlat**

Lyra klasöründe:

```bash
docker-compose up -d
```

**Ne olur?**
- ✅ Redis container başlar (port 6379)
- ✅ PostgreSQL container başlar (port 5432)
- ✅ Lyra app container başlar (port 3001)

---

### **3. Kontrol Et**

```bash
# Çalışan container'ları gör
docker-compose ps

# Logs'ları gör
docker-compose logs -f app

# Redis'e bağlan
docker-compose exec redis redis-cli ping
```

---

### **4. Sunucuya Erişim**

Tarayıcı açıp:
```
http://localhost:3001
```

---

## 🛑 Container'ları Durdur

```bash
docker-compose down

# Verileri sil (temiz başlangıç)
docker-compose down -v
```

---

## 📊 Services

| Service | Port | Kontrol |
|---------|------|---------|
| **Lyra App** | 3001 | http://localhost:3001 |
| **Redis** | 6379 | `redis-cli` |
| **PostgreSQL** | 5432 | psql |

---

## 🐛 Hata Çözümleme

**Port Busy Hatası:**
```bash
docker-compose down
docker-compose up -d
```

**Container Crash Oluyor:**
```bash
docker-compose logs app
```

**Tüm verileri sıfırla:**
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📦 Volumes

- `redis-data` — Redis persistence
- `postgres-data` — PostgreSQL veritabanı

Bu veriler `docker-compose down` sırasında **korunur**.
Silmek için: `docker-compose down -v`

---

**Docker Desktop kurulunca, başla:** `docker-compose up -d` 🚀
