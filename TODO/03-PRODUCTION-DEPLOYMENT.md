# 🚀 PRODUCTION DEPLOYMENT - Lyra World-Class Therapy System

## STATUS: ❌ YAPILMADI

---

## 📋 GÖREV ÖZETI

Lyra'nın therapy intelligence systems'ı (Relational Dynamics, Temporal Mapping, Defensive Pattern Analysis) production'a dağıtmak.

Bu görev **yalnızca** aşağıdaki iki görev tamamlandıktan sonra yapılabilir:
1. ✅ `01-VERCEL-CRON-SECRET-SETUP.md` — CRON_SECRET Vercel'de aktif
2. ✅ `02-SUPABASE-PGVECTOR-SETUP.md` — pgvector RPC functions çalışıyor

---

## 📌 ADIMLAR (TAKİP LİSTESİ)

### Adım 1: Önceki Görevlerin Tamamlandığını Doğrula

Devam etmeden önce şunları kontrol et:

- [ ] **CRON_SECRET Vercel'de?**
  - Vercel Dashboard → Settings → Environment Variables
  - `CRON_SECRET` görülüyor mu? (değeri gizli olmalı)

- [ ] **pgvector Extension aktif?**
  ```sql
  SELECT extname FROM pg_extension WHERE extname = 'vector';
  ```
  - Sonuç: `vector` satırı görülüyor

- [ ] **RPC Functions var?**
  ```sql
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_name IN ('match_knowledge_sources', 'match_memory_fragments');
  ```
  - Sonuç: 2 function görülüyor

**Eğer bunlar eksikse → İlgili TODO dosyasına dön ve tamamla**

---

### Adım 2: Git Staging Area'yı Kontrol Et

Terminal'i aç ve şu komutu çalıştır:

```bash
cd c:/Users/TUF/Desktop/Lyra
git status
```

Beklenen çıktı:
```
On branch refactor/enterprise-architecture
Changes not staged for commit:
  M  src/application/agents/TherapistAgent.js
  M  api/auth/login.edge.ts
  M  lib/infrastructure/realtimeManager.ts
  ... (başka değişiklikler)

Untracked files:
  ?? src/application/services/RelationalDynamicsTracker.js
  ?? src/application/services/TemporalMappingEngine.js
  ?? src/application/services/DefensivePatternAnalyzer.js
  ?? test-relational-work-standalone.js
  ?? test-complete-therapy-system.js
```

---

### Adım 3: Yeni Dosyaları Staging'e Ekle

Therapy intelligence systems dosyalarını stage et:

```bash
git add src/application/services/RelationalDynamicsTracker.js
git add src/application/services/TemporalMappingEngine.js
git add src/application/services/DefensivePatternAnalyzer.js
```

Diğer değişiklikleri kontrol et (test dosyaları staging'e ekleme):

```bash
git status
```

Verify et:
- [ ] 3 yeni service dosyası staged
- [ ] TherapistAgent.js ve diğer modified files'lar **staged veya unstaged olabilir** (deployment bağlamına bağlı)

---

### Adım 4: Commit Mesajı Oluştur

Şu komutu çalıştır:

```bash
git commit -m "feat: Add world-class therapy intelligence systems

- RelationalDynamicsTracker: Analyzes therapeutic relationship patterns, transference, reciprocity
- TemporalMappingEngine: Connects past trauma to present reactions with emotional resonance
- DefensivePatternAnalyzer: Understands protective mechanisms with compassion
- TherapistAgent: Integrated all three systems into response generation

These systems enable Lyra to:
1. Use the relationship itself as a healing tool (meta-communication)
2. Show patients past echoes in present triggers (temporal awareness)
3. Reframe defenses with compassion (defensive reframing)

Result: Transform from good therapist to world-class therapist

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

Beklenen sonuç:
```
[refactor/enterprise-architecture ...] feat: Add world-class therapy intelligence systems
 3 files changed, 1500+ insertions(+)
 create mode 100644 src/application/services/RelationalDynamicsTracker.js
 create mode 100644 src/application/services/TemporalMappingEngine.js
 create mode 100644 src/application/services/DefensivePatternAnalyzer.js
```

- [ ] Commit başarılı

---

### Adım 5: Git Log'u Doğrula

Yeni commit'i kontrol et:

```bash
git log --oneline -5
```

Beklenen çıktı:
```
xxxxxxx feat: Add world-class therapy intelligence systems
8157c40 CRITICAL FIXES: Eliminate broken imports, Edge/Node compatibility, middleware bugs
5b7dd3f PHASE 2-5 COMPLETE: Production-ready 100K+ concurrent users
...
```

- [ ] Yeni commit listelenmiş

---

### Adım 6: Vercel'e Push Et

```bash
git push origin refactor/enterprise-architecture
```

Beklenen çıktı:
```
Enumerating objects: ...
Counting objects: ...
Compressing objects: ...
Writing objects: ...
Total ... (delta ...), reused ... (delta ...)
remote: Vercel assigned URL: https://lyra-...vercel.app
To github.com:username/lyra.git
   8157c40..xxxxxxx  refactor/enterprise-architecture -> refactor/enterprise-architecture
```

- [ ] Push başarılı
- [ ] Vercel webhook tetiklendi

---

### Adım 7: Vercel Deployment'ını İzle

1. Vercel dashboard'a git: https://vercel.com
2. Lyra projesini aç
3. **Deployments** tıkla
4. En yeni deployment'ı seç
5. Building işlemi izle (~3-5 dakika)

Beklenen aşamalar:
```
✓ Built successfully
✓ Functions optimized [... files]
✓ Ready [... URLs]
```

- [ ] Deployment "Ready" statüsü alana kadar bekle

---

### Adım 8: Vercel Logs'ta Hata Kontrolü

Deployment tamamlandıktan sonra:

1. Vercel Dashboard → Deployments → Latest
2. **Logs** sekmesini tıkla
3. Ara: `Error` veya `Failed`

Beklenen sonuç:
- [ ] Hata yok (veya sadece uyarılar)
- [ ] Startup log'u temiz

---

### Adım 9: Production URL'de API Test Et

Deployed aplikasyonun health check'ini test et:

```bash
curl https://lyra-prod.vercel.app/api/health
```

Beklenen sonuç:
```json
{"status": "ok", "timestamp": "..."}
```

- [ ] Health check 200 OK döndürdü

---

### Adım 10: Therapy Systems'ın Aktif Olduğunu Doğrula

Şu sorguyu çalıştır (Supabase SQL Editor):

```sql
-- Check if the new therapy services are loaded
SELECT
  COUNT(*) as active_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(created_at) as last_session
FROM conversation_sessions
WHERE created_at > NOW() - INTERVAL '1 hour';
```

- [ ] Result: Aktif session'lar var mı? (varsa sistem çalışıyor)

---

### Adım 11: Memory and Temporal Services Test

Şu sorguyu çalıştır (Supabase SQL Editor):

```sql
-- Check if episodic memory is recording
SELECT
  COUNT(*) as total_memories,
  COUNT(DISTINCT user_id) as users_with_memory,
  COUNT(CASE WHEN topics IS NOT NULL THEN 1 END) as memories_with_topics,
  COUNT(CASE WHEN transcript_embedding IS NOT NULL THEN 1 END) as memories_with_embeddings
FROM memory_fragments
WHERE created_at > NOW() - INTERVAL '24 hours';
```

- [ ] Result: Memories recorded? (indicating temporal engine is working)

---

### Adım 12: Production Cron Jobs Kontrolü

Gece 02:00 UTC'ye kadar bekle veya şu komutu çalıştır (Vercel logs):

```bash
# In Vercel Logs, search for:
```

Ara: `/api/cron/autonomousSourceDiscovery`

Beklenen sonuç:
```
GET /api/cron/autonomousSourceDiscovery 200 OK
```

- [ ] Cron job çalıştı ve başarılı

---

## 📊 PRODUCTION READINESS KONTROL LİSTESİ

Deployment'ın world-class therapy sistemi desteklediğini doğrula:

### Code Quality
- [ ] **RelationalDynamicsTracker.js çalışıyor mu?**
  - Check Vercel logs for: `[TherapistAgent] Analyzing relational patterns`

- [ ] **TemporalMappingEngine.js çalışıyor mu?**
  - Check Vercel logs for: `[TherapistAgent] Mapping temporal connections`

- [ ] **DefensivePatternAnalyzer.js çalışıyor mu?**
  - Check Vercel logs for: `[TherapistAgent] Analyzing defensive patterns`

### Data Pipeline
- [ ] **Memory fragments being recorded?**
  ```sql
  SELECT COUNT(*) FROM memory_fragments WHERE created_at > NOW() - INTERVAL '6 hours';
  ```
  ✅ Result: > 0

- [ ] **Vector embeddings being stored?**
  ```sql
  SELECT COUNT(*) FROM memory_fragments WHERE transcript_embedding IS NOT NULL;
  ```
  ✅ Result: > 0

### System Integration
- [ ] **RLS policies protecting user data?**
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'memory_fragments';
  ```
  ✅ Result: RLS policies listed

- [ ] **Cron jobs executing on schedule?**
  - Check Vercel dashboard logs at 02:15 UTC
  - Look for `/api/cron/autonomousSourceDiscovery` → 200 OK

---

## ⚠️ SORUN GİDERME

### Problem: Deployment başarısız (build error)
**Çözüm:**
1. Vercel logs'a git → Errors sekmesi
2. Tam error message'ı oku
3. Genellikle import path sorunudur → Dosya yollarını kontrol et
4. Terminal'de `npm run build` çalıştırarak locally test et

### Problem: Services yüklenmemiş (log'larda görülmüyor)
**Çözüm:**
1. TherapistAgent.js'de import statements doğru mu?
   ```javascript
   import { RelationalDynamicsTracker } from '../services/RelationalDynamicsTracker.js';
   import { TemporalMappingEngine } from '../services/TemporalMappingEngine.js';
   import { DefensivePatternAnalyzer } from '../services/DefensivePatternAnalyzer.js';
   ```
2. Constructor'da instantiate mi?
   ```javascript
   this.relational = new RelationalDynamicsTracker({ userId });
   this.temporal = new TemporalMappingEngine({ userId });
   this.defensive = new DefensivePatternAnalyzer({ userId });
   ```

### Problem: Memory not recording (Supabase sorgusu 0 döndüyor)
**Çözüm:**
1. EpisodicMemoryService.js dosyasını kontrol et
2. `storeMemoryFragment()` metodu çalışıyor mu?
3. Supabase RLS policies user_id ile ilgili sorun yaşamıyor mu?
4. Vercel logs'ta "[EpisodicMemory]" ara → Error varsa göster

### Problem: Vector search still fallback (pgvector yokmuş gibi davranıyor)
**Çözüm:**
1. Supabase'de pgvector extension enable mi?
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'vector';
   ```
2. RPC functions create mi?
   ```sql
   SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'match_%';
   ```
3. Fallback kullanılması normal (vector search data olana kadar)

---

## 📞 REFERANSLAR

- Vercel Deployments: https://vercel.com/docs/deployments/overview
- Git Push Basics: https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository
- Lyra Architecture: `ARCHITECTURE.md`
- Therapy Systems Overview: `test-complete-therapy-system.js`

---

## ✅ TAMAMLAMA KRITERI

Bu deployment tamamlanmış olarak işaretlenebilir:

- [ ] Git commit oluşturuldu ve push edildi
- [ ] Vercel deployment "Ready" statüsünde
- [ ] Vercel logs'ta error yok
- [ ] `/api/health` 200 OK döndürüyor
- [ ] Supabase'de aktif sessions var
- [ ] Memory fragments kaydediliyor
- [ ] RPC functions çalışıyor (vector search aktif)
- [ ] 02:00 UTC'de cron job çalıştı (gece beklersen) veya logs'ta başarılı sonuç görüyorsun

---

## 🎯 POST-DEPLOYMENT

Deployment başarılı olduktan sonra:

1. **Immediate**: 02:00 UTC'ye kadar bekle veya cron'u manuel test et
2. **24 Hours**: Vercel logs'ta error pattern yok mu kontrol et
3. **Weekly**: Supabase performans metriklerine bak (slow queries, etc.)
4. **Ongoing**: User feedback izle → Therapy quality iyileşti mi?

---

## 📝 NOTES

- Deployment öncesinde `01-VERCEL-CRON-SECRET-SETUP.md` ve `02-SUPABASE-PGVECTOR-SETUP.md` **mutlaka** tamamlanmış olmalı
- Bu dosya Turkish (Türkçe) yazılmıştır çünkü Lyra projesi Turkish context'tedir
- Sorun yaşarsan Vercel logs'ta 📊 section'a bakarak troubleshoot et
- Git history'de işlemleri track et
