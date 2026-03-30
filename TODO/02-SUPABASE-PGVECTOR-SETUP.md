# 🗄️ SUPABASE'DE PGVECTOR RPC FUNCTIONS SETUP

## STATUS: ❌ YAPILMADI

---

## 📋 GÖREV ÖZETI

Supabase'de vector similarity search'ü etkinleştirmek için:
1. pgvector extension'ı enable etmek
2. `knowledge_sources` tablosunun embedding column'ı kontrol etmek
3. İki RPC function oluşturmak:
   - `match_knowledge_sources` (Knowledge retrieval için)
   - `match_memory_fragments` (Memory similarity search için)

---

## 📌 ADIMLAR (TAKİP LİSTESİ)

### Adım 1: Supabase SQL Editor'e Erişim
- [ ] https://supabase.com'a git
- [ ] Lyra projesini aç
- [ ] Sol sidebar → **SQL Editor** tıkla
- [ ] Yeni query oluştur: **+ New query**

---

### Adım 2: pgvector Extension'ı Enable Et

**2A. Extension'ı Create Et:**
- [ ] SQL Editor'e şu query'i yapıştır:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it is installed
SELECT extname FROM pg_extension WHERE extname = 'vector';
```
- [ ] **Run** butonuna tıkla (▶)
- [ ] Çıktı: `vector` satırı görülmeliyse ✅

**2B. Alternatively (Eğer UI ile yapmak istersen):**
- [ ] Sidebar → **Extensions**
- [ ] "vector" ara
- [ ] Enable tıkla

---

### Adım 3: knowledge_sources Tablosu Kontrol Et

Embedding column'u var mı, data type doğru mu?

- [ ] SQL Editor'de yeni query:
```sql
-- Check knowledge_sources structure
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'knowledge_sources'
ORDER BY ordinal_position;
```
- [ ] **Run** et
- [ ] Sonuçlar içinde bu kolonlar olmalı:
  - `embedding` (data_type: `USER-DEFINED` olmalı, vector)
  - `title`
  - `url`
  - `category`
  - `credibility_score`

**Eğer `embedding` kolonu yoksa:**
```sql
-- Add embedding column if missing
ALTER TABLE knowledge_sources
ADD COLUMN embedding vector(1536);

-- Create index for performance
CREATE INDEX ON knowledge_sources USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

### Adım 4: RPC Function #1 - match_knowledge_sources

Bu function, knowledge sources'ı vector similarity'ye göre bulur.

- [ ] Yeni SQL query:
```sql
-- Create RPC function for knowledge source matching
CREATE OR REPLACE FUNCTION match_knowledge_sources(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  summary text,
  category text,
  credibility_score double precision,
  source_type text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ks.id,
    ks.title,
    ks.url,
    ks.summary,
    ks.category,
    ks.credibility_score,
    ks.source_type,
    (1 - (ks.embedding <=> query_embedding))::float AS similarity
  FROM knowledge_sources ks
  WHERE ks.is_active = true
    AND ks.embedding IS NOT NULL
    AND (1 - (ks.embedding <=> query_embedding)) > match_threshold
  ORDER BY ks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;
```
- [ ] **Run** et
- [ ] Sonuç: `CREATE FUNCTION` mesajı görülmeli

**Doğrulama (Test Et):**
- [ ] Yeni query:
```sql
-- Test the function (requires a vector from embeddings)
SELECT
  COUNT(*) as results,
  AVG(similarity)::numeric(3,2) as avg_similarity
FROM match_knowledge_sources(
  (SELECT embedding FROM knowledge_sources LIMIT 1)::vector(1536),
  0.6,
  5
);
```
- [ ] **Run** et
- [ ] Eğer sonuç varsa (results > 0) → Fonksiyon çalışıyor ✅

---

### Adım 5: RPC Function #2 - match_memory_fragments

Bu function, hafıza fragmentlarını similarity'ye göre bulur.

- [ ] Yeni SQL query:
```sql
-- Create RPC function for memory fragment matching
CREATE OR REPLACE FUNCTION match_memory_fragments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  user_id_param uuid
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  transcript text,
  topics text[],
  emotional_themes text[],
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mf.id,
    mf.session_id,
    mf.transcript,
    mf.topics,
    mf.emotional_themes,
    (1 - (mf.transcript_embedding <=> query_embedding))::float AS similarity
  FROM memory_fragments mf
  WHERE mf.user_id = user_id_param
    AND mf.transcript_embedding IS NOT NULL
    AND (1 - (mf.transcript_embedding <=> query_embedding)) > match_threshold
  ORDER BY mf.transcript_embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;
```
- [ ] **Run** et
- [ ] Sonuç: `CREATE FUNCTION` mesajı

**Doğrulama (Test Et):**
- [ ] Yeni query:
```sql
-- Check if memory_fragments has data
SELECT
  COUNT(*) as total_fragments,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN transcript_embedding IS NOT NULL THEN 1 END) as with_embeddings
FROM memory_fragments;
```
- [ ] **Run** et
- [ ] Sonuç: with_embeddings > 0 olmalı

---

### Adım 6: Permission Check (RLS)

RPC function'lar RLS politikalarına göre çalışmalı.

- [ ] SQL query:
```sql
-- Verify RLS is set up for memory_fragments
SELECT
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE tablename IN ('memory_fragments', 'knowledge_sources');
```
- [ ] **Run** et
- [ ] Çıktıda memory_fragments ve knowledge_sources için RLS policies olmalı

**Eğer RLS yoksa, ekle:**
```sql
-- Add RLS to memory_fragments (if needed)
ALTER TABLE memory_fragments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own memory fragments"
ON memory_fragments
FOR SELECT
USING (auth.uid() = user_id);

-- Add RLS to knowledge_sources (if needed)
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Knowledge sources are public read"
ON knowledge_sources
FOR SELECT
USING (true);
```

---

## 📊 DOĞRULAMA KONTROL LİSTESİ

Tüm fonksiyonlar çalışıyor mu?

- [ ] **pgvector extension aktif mi?**
  ```sql
  SELECT extname FROM pg_extension WHERE extname = 'vector';
  ```
  ✅ Sonuç: `vector` satırı

- [ ] **knowledge_sources embedding sütunu var mı?**
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'knowledge_sources' AND column_name = 'embedding';
  ```
  ✅ Sonuç: `embedding | USER-DEFINED`

- [ ] **match_knowledge_sources function çalışıyor mu?**
  ```sql
  SELECT COUNT(*) FROM match_knowledge_sources(
    (SELECT embedding FROM knowledge_sources LIMIT 1)::vector(1536),
    0.6,
    3
  );
  ```
  ✅ Sonuç: 1-3 satır

- [ ] **match_memory_fragments function çalışıyor mu?**
  ```sql
  SELECT COUNT(*) FROM match_memory_fragments(
    (SELECT transcript_embedding FROM memory_fragments LIMIT 1)::vector(1536),
    0.7,
    5,
    (SELECT user_id FROM memory_fragments LIMIT 1)
  );
  ```
  ✅ Sonuç: 1-5 satır (veya 0 eğer data yoksa - bu ok)

---

## ⚠️ SORUN GİDERME

### Problem: "ERROR: could not open extension control file"
**Çözüm:**
- Supabase project settings'te pgvector enable olduğundan emin ol
- Veya contact Supabase support

### Problem: RPC Function "does not exist" error
**Çözüm:**
1. Function'ı yeni query'de create et
2. Schema qualified name kullan: `public.match_knowledge_sources()`
3. Typo kontrol et

### Problem: "Permission denied for relation"
**Çözüm:**
- RLS policies'i kontrol et
- Service role key'i kullanarak test et (authenticated client yerine)

### Problem: "vector type does not exist"
**Çözüm:**
- pgvector extension enable et (Adım 2)
- Vercel/production'da da enable edilmiş mi kontrol et

---

## 📞 REFERANSLAR

- Supabase Vector: https://supabase.com/docs/guides/database/vector
- pgvector Docs: https://github.com/pgvector/pgvector
- Lyra Temporal Engine: `src/application/services/TemporalMappingEngine.js`
- Lyra Episodic Memory: `src/application/services/EpisodicMemoryService.js`

---

## 🔍 DOĞRULAMA KONTROL LİSTESİ

Tüm fonksiyonlar çalışıyor mu?

- [ ] **pgvector extension aktif mi?**
  ```sql
  SELECT extname FROM pg_extension WHERE extname = 'vector';
  ```
  ✅ Sonuç: `vector` satırı

- [ ] **knowledge_sources embedding sütunu var mı?**
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'knowledge_sources' AND column_name = 'embedding';
  ```
  ✅ Sonuç: `embedding | USER-DEFINED`

- [ ] **match_knowledge_sources function çalışıyor mu?**
  ```sql
  SELECT COUNT(*) FROM match_knowledge_sources(
    (SELECT embedding FROM knowledge_sources LIMIT 1)::vector(1536),
    0.6,
    3
  );
  ```
  ✅ Sonuç: 1-3 satır

- [ ] **match_memory_fragments function çalışıyor mu?**
  ```sql
  SELECT COUNT(*) FROM match_memory_fragments(
    (SELECT transcript_embedding FROM memory_fragments LIMIT 1)::vector(1536),
    0.7,
    5,
    (SELECT user_id FROM memory_fragments LIMIT 1)
  );
  ```
  ✅ Sonuç: 1-5 satır (veya 0 eğer data yoksa - bu ok)

---

## ⚠️ SORUN GİDERME

### Problem: "ERROR: could not open extension control file"
**Çözüm:**
- Supabase project settings'te pgvector enable olduğundan emin ol
- Veya contact Supabase support

### Problem: RPC Function "does not exist" error
**Çözüm:**
1. Function'ı yeni query'de create et
2. Schema qualified name kullan: `public.match_knowledge_sources()`
3. Typo kontrol et

### Problem: "Permission denied for relation"
**Çözüm:**
- RLS policies'i kontrol et
- Service role key'i kullanarak test et (authenticated client yerine)

### Problem: "vector type does not exist"
**Çözüm:**
- pgvector extension enable et (Adım 2)
- Vercel/production'da da enable edilmiş mi kontrol et

---

## 📞 REFERANSLAR

- Supabase Vector: https://supabase.com/docs/guides/database/vector
- pgvector Docs: https://github.com/pgvector/pgvector
- Lyra Temporal Engine: `src/application/services/TemporalMappingEngine.js`
- Lyra Episodic Memory: `src/application/services/EpisodicMemoryService.js`

---

## ✅ TAMAMLAMA KRITERI

Bu görev tamamlanmış olarak işaretlenebilir:
- [ ] pgvector extension enable edildi
- [ ] `match_knowledge_sources` RPC function çalışıyor
- [ ] `match_memory_fragments` RPC function çalışıyor
- [ ] Test sorgularında doğru sonuçlar alınıyor
- [ ] RLS politikaları ayarlanmış
- [ ] Vercel production'da test query'leri çalışıyor
