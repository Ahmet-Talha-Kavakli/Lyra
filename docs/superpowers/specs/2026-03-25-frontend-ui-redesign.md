# Lyra Frontend UI Yenileme — Design Spec
**Tarih:** 2026-03-25
**Durum:** Onaylandı

## Genel Bakış
Lyra'nın mevcut vanilla HTML/CSS frontend'ini, 21st.dev / Aceternity UI / MagicUI tarzı modern komponentlerle yenilemek. Framework değişmiyor — Tailwind CSS + Vanilla JS. Avatar/Three.js kodu dokunulmaz.

## Yaklaşım
- **Tailwind CSS** CDN üzerinden eklenir (build tooling gereksiz)
- Mevcut `<style>` bloğu `public/css/lyra.css` dosyasına taşınır
- CSS değişkenleri korunur, Tailwind utility class'ları ile hibrit kullanım
- Tüm JS mantığı olduğu gibi kalır, sadece HTML markup ve görsel stiller değişir

## Bileşenler

### 1. Login Ekranı
- Glassmorphism card (backdrop-blur, border gradient)
- Floating label input'lar yerine modern placeholder-üstü label
- Shimmer/glow efekti başlıkta
- "LYRA" logosu büyük, letter-spacing geniş, gold gradient
- Alt metinde subtle typewriter animasyonu
- CTA buton: gradient border + hover shimmer

### 2. Loader Overlay
- Merkezi logo + progress bar
- Adım adım status güncelleme (mevcut mantık korunur)
- Daha smooth fade-in/out

### 3. Ana Layout (therapy-layout)
- Panels: glassmorphism kartlar, daha belirgin corner radius (28px)
- Panel label'ları: pill badge style, bottom-left
- Speaking state: mevcut glow animasyonları korunur, renk paleti iyileştirilir
- Camera-off state: daha şık placeholder

### 4. Alt Kontrol Çubuğu (bottom-controls)
- Frosted glass bar (backdrop-blur, border-top gradient)
- Brand + status solda, transcript ortada, kontroller sağda — ya da merkezi düzen korunur
- Status badge: animated dot + pill
- Transcript: fade-in typewriter efekti
- Talk button: gradient border, hover glow, active/recording state kırmızı pulse
- Camera button: icon button, rounded square
- Mic waveform: mevcut 5-bar animasyon korunur, renk güncellenir

### 5. Modal'lar (CBT, Values, Emergency)
- Backdrop: blur(24px) + dark overlay
- Card: glassmorphism, 20px radius, gold border
- Input'lar: subtle glow on focus
- Butonlar: primary gold, secondary transparent+border
- Animated modal entry (scale + fade)

### 6. Overlay'lar (Nefes, Visualizasyon, Vizual Script)
- Mevcut işlevsellik korunur
- Görsel efektler iyileştirilir (daha smooth animasyonlar)

### 7. Toast Notification
- Sağ üst, slide-in animasyonu
- Tip bazlı renk (info/success/warning/error)
- Progress bar alt kısımda (auto-dismiss süresi)
- Blur backdrop

### 8. Acil Yardım Butonu & Modal
- FAB (Floating Action Button) — alt sağ
- Modal: kırmızı tema glassmorphism card
- Telefon numaraları büyük, tıklanabilir (tel: link)

## Dosya Yapısı (Hedef)
```
public/
├── index.html          (sadece markup, script'ler korunur)
├── css/
│   └── lyra.css        (tüm özel stiller)
└── js/
    ├── AnimationLayerSystem.js  (dokunulmaz)
    ├── LipSyncEngine.js         (dokunulmaz)
    └── ProceduralLayers.js      (dokunulmaz)
```

## Renkler (Korunacak)
```css
--primary: #c8a96e   /* warm gold */
--accent:  #e8c99a   /* light sand */
--bg:      #1a1510   /* dark brown */
--success: #70c896   /* mint */
--warning: #e8a85c   /* orange */
--danger:  #d47777   /* red */
```

## Kısıtlamalar
- Avatar (Three.js) kodu değişmez
- JS mantığı değişmez (sadece DOM referansları güncellenir gerekirse)
- Vapi/Supabase entegrasyonu bozulmaz
- Tüm mevcut ID'ler ve class'lar korunur (JS'nin tuttuğu referanslar)
