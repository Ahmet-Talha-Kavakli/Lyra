# Lyra Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animasyonları düzelt, UI'yi iyileştir, ses göstergesi ekle, yükleme performansını artır.

**Architecture:** Tüm frontend kodu `public/index.html` içinde tek dosyada. Model `spongebob_v2/scene.gltf`'den `avatar.glb`'ye geçecek — bu Mixamo uyumlu humanoid olduğu için mevcut animasyon GLB dosyaları (Idle, Talk, Wave vb.) sorunsuz çalışacak. Paralel model yükleme ile performans artırılacak.

**Tech Stack:** Three.js 0.160, Vapi AI, Tween.js, Node.js/Express backend

---

## Chunk 1: Animasyonlar — avatar.glb Geçişi

### Task 1: Model ve Karakter Tanımını Güncelle

**Files:**
- Modify: `public/index.html:380-401` (character tanımı ve extraAnims)

- [ ] **Step 1: `character` objesini güncelle**

`public/index.html` içinde şu bloğu bul:

```js
const character = {
    name: "SüngerBob KarePantolon",
    model: "spongebob_v2/scene.gltf",
    animMap: {
        'Yes':'Agreeing', 'No':'Disagreeing', 'Wave':'Wave',
        'Jump':'Joyful Jump', 'Dance':'Silly Dance',
        'Surprise':'Surprise', 'Looking':'Looking', 'Talk':'Talk'
    },
    scaleMult: 1.0
};
```

Şununla değiştir:

```js
const character = {
    name: "Lyra",
    model: "avatar.glb",
    animMap: {
        'Yes':'Agreeing', 'No':'Disagreeing', 'Wave':'Wave',
        'Jump':'Joyful Jump', 'Dance':'Wave Hip Hop Dance',
        'Surprise':'Surprised', 'Looking':'Looking Around', 'Talk':'Talk'
    },
    scaleMult: 1.0
};
```

- [ ] **Step 2: extraAnims listesini güncelle**

`public/index.html` içinde şu bloğu bul:

```js
const extraAnims = [
    { file:'Agreeing.glb',          name:'Agreeing' },
    { file:'Jump.glb',              name:'Joyful Jump' },
    { file:'Waving.glb',            name:'Wave' },
    { file:'Talking.glb',           name:'Talk' },
    { file:'Shaking Head No.glb',   name:'Disagreeing' },
    { file:'Surprised.glb',         name:'Surprise' },
    { file:'Looking Around.glb',    name:'Looking' },
    { file:'Idle.glb',              name:'Idle' },
];
```

Şununla değiştir (dosya adlarını public klasöründeki gerçek GLB dosyalarıyla eşleştir):

```js
const extraAnims = [
    { file:'Agreeing.glb',          name:'Agreeing' },
    { file:'Jump.glb',              name:'Joyful Jump' },
    { file:'Waving.glb',            name:'Wave' },
    { file:'Talking.glb',           name:'Talk' },
    { file:'Shaking Head No.glb',   name:'Disagreeing' },
    { file:'Surprised.glb',         name:'Surprised' },
    { file:'Looking Around.glb',    name:'Looking Around' },
    { file:'Idle.glb',              name:'Idle' },
    { file:'Sad Idle.glb',          name:'Sad Idle' },
    { file:'Wave Hip Hop Dance.glb',name:'Wave Hip Hop Dance' },
    { file:'Angry Gesture.glb',     name:'Angry Gesture' },
];
```

- [ ] **Step 3: `loadSpongebob` fonksiyonunu `loadAvatar` olarak yeniden adlandır ve içinde referansları güncelle**

`public/index.html` içinde:
- `function loadSpongebob()` → `function loadAvatar()`
- `loadSpongebob()` çağrısını (2 yerde) → `loadAvatar()`
- loader status mesajını güncelle: `"KARAKTER YÜKLENİYOR..."` → `"AVATAR YÜKLENİYOR..."`

- [ ] **Step 4: Avatar için scale ve pozisyon ayarla**

Avatar'ın `targetH` (hedef yükseklik) değerini güncelle. `avatar.glb` humanoid boyutu genellikle 1.7-1.8m arası gelir. Şu satırı bul:

```js
const targetH = 2.4;
```

Şununla değiştir:

```js
const targetH = 1.8;
```

- [ ] **Step 5: Tarayıcıda test et**

`npm start` ile sunucuyu başlat (zaten çalışıyorsa atla), `http://localhost:3001` aç.
- Karakter sahnede görünüyor mu?
- Loading bittikten sonra Idle animasyonu oynuyor mu?
- Console'da `[CHAR]` loglarına bak — animationsMap dolu mu?

Eğer karakter görünmüyorsa scale sorunudur; `targetH` değerini 1.6 veya 2.0 dene.

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat: switch character from SpongeBob to avatar.glb with working animations"
```

---

### Task 2: Animasyon-Ses Eşleştirmesini Genişlet

**Files:**
- Modify: `public/index.html:751-766` (Vapi message handler)

- [ ] **Step 1: Duygu bazlı animasyon eşleştirmesini güncelle**

`public/index.html` içinde şu bloğu bul:

```js
if      (text.includes('evet'))                              playAnimation('Yes');
else if (text.includes('hayır'))                             playAnimation('No');
else if (text.includes('merhaba') || text.includes('selam')) playAnimation('Wave');
else if (text.includes('dans'))                              playAnimation('Dance');
else                                                          playAnimation('Talk');
```

Şununla değiştir:

```js
if      (text.includes('evet') || text.includes('kesinlikle') || text.includes('tabii'))
                                                              playAnimation('Yes');
else if (text.includes('hayır') || text.includes('değil'))   playAnimation('No');
else if (text.includes('merhaba') || text.includes('selam') || text.includes('hoş geldin'))
                                                              playAnimation('Wave');
else if (text.includes('dans') || text.includes('dans edelim')) playAnimation('Dance');
else if (text.includes('şaşır') || text.includes('inanılmaz') || text.includes('gerçekten mi'))
                                                              playAnimation('Surprise');
else if (text.includes('üzgün') || text.includes('zor') || text.includes('endişe'))
                                                              playAnimation('Sad');
else                                                          playAnimation('Talk');
```

**Önce** Task 1'de tanımlanan `character.animMap` objesine şu iki satırı ekle:

```js
const character = {
    name: "Lyra",
    model: "avatar.glb",
    animMap: {
        'Yes':'Agreeing', 'No':'Disagreeing', 'Wave':'Wave',
        'Jump':'Joyful Jump', 'Dance':'Wave Hip Hop Dance',
        'Surprise':'Surprised', 'Looking':'Looking Around', 'Talk':'Talk',
        'Sad':'Sad Idle',       // <-- ekle
        'Angry':'Angry Gesture' // <-- ekle
    },
    scaleMult: 1.0
};
```

**Sonra** yukarıdaki Vapi handler kod bloğunu uygula.

- [ ] **Step 2: Tarayıcıda test et**

Görüşme başlat, konuş. "Evet" dediğinde Agreeing animasyonu, "Merhaba" dediğinde Wave animasyonu oynuyor mu?

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: expand animation triggers with more keywords and emotions"
```

---

## Chunk 2: UI İyileştirmeleri

### Task 3: Status Badge — Canlı Gösterge

**Files:**
- Modify: `public/index.html` (CSS ve JS)

- [ ] **Step 1: CSS'e pulse ve mic animasyonu ekle**

`public/index.html` içinde `@keyframes fadeInUp` bloğunun hemen altına ekle:

```css
@keyframes pulse-gold {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200,169,110,0.4); }
    50%       { box-shadow: 0 0 0 8px rgba(200,169,110,0); }
}
@keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200,80,70,0.5); }
    50%       { box-shadow: 0 0 0 10px rgba(200,80,70,0); }
}
@keyframes mic-wave {
    0%, 100% { transform: scaleY(0.4); }
    50%       { transform: scaleY(1.0); }
}

.status-badge.listening {
    animation: pulse-red 1.2s ease-in-out infinite;
    border-color: #c87060;
    color: #e8a090;
}

/* Mic indicator */
#mic-indicator {
    display: none;
    align-items: center;
    gap: 3px;
    height: 24px;
}
#mic-indicator.active { display: flex; }
#mic-indicator span {
    display: inline-block;
    width: 3px;
    background: var(--primary);
    border-radius: 2px;
    animation: mic-wave 0.8s ease-in-out infinite;
}
#mic-indicator span:nth-child(2) { animation-delay: 0.1s; }
#mic-indicator span:nth-child(3) { animation-delay: 0.2s; }
#mic-indicator span:nth-child(4) { animation-delay: 0.3s; }
#mic-indicator span:nth-child(5) { animation-delay: 0.15s; }
```

- [ ] **Step 2: HTML'e mic indicator ekle**

`public/index.html` içinde `.controls` div'ini bul:

```html
<div class="controls">
    <button class="main-btn" id="talkBtn">GÖRÜŞMEYİ BAŞLAT</button>
</div>
```

Şununla değiştir:

```html
<div class="controls">
    <div id="mic-indicator">
        <span style="height:8px"></span>
        <span style="height:14px"></span>
        <span style="height:20px"></span>
        <span style="height:14px"></span>
        <span style="height:8px"></span>
    </div>
    <button class="main-btn" id="talkBtn">GÖRÜŞMEYİ BAŞLAT</button>
</div>
```

- [ ] **Step 3: JS'de call-start/end'e göre animasyonları aç/kapat**

`public/index.html` içinde `vapiInstance.on('call-start', ...)` bloğuna şunu ekle:

```js
document.getElementById('mic-indicator').classList.add('active');
statusEl.classList.add('listening');
```

`vapiInstance.on('call-end', ...)` bloğuna şunu ekle:

```js
document.getElementById('mic-indicator').classList.remove('active');
statusEl.classList.remove('listening');
```

- [ ] **Step 4: Transcript için fade animasyonu ekle**

CSS'de `#transcript` kuralını bul ve transition ekle:

```css
#transcript {
    /* ... mevcut stiller ... */
    transition: opacity 0.3s ease;
}
```

JS'de `transcriptEl.textContent = ...` satırını şununla değiştir:

```js
transcriptEl.style.opacity = '0';
setTimeout(() => {
    transcriptEl.textContent = `"${message.transcript}"`;
    transcriptEl.style.opacity = '1';
}, 150);
```

- [ ] **Step 5: Tarayıcıda test et**

- Görüşme başlatınca status badge kırmızı pulse yapıyor mu?
- Mic dalgaları görünüyor mu?
- Transcript değişince fade in/out oluyor mu?

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat: add mic wave indicator, status pulse animation, transcript fade"
```

---

### Task 4: Loading Ekranı — Gerçek İlerleme

**Files:**
- Modify: `public/index.html` (loader CSS + JS)

- [ ] **Step 1: Loading bar CSS ekle**

`public/index.html` içinde `#loader-status` CSS kuralından sonra ekle:

```css
#loader-bar-wrap {
    width: 220px;
    height: 1px;
    background: rgba(200,169,110,0.15);
    border-radius: 2px;
    margin-top: 20px;
    overflow: hidden;
}
#loader-bar {
    height: 100%;
    width: 0%;
    background: var(--primary);
    border-radius: 2px;
    transition: width 0.4s ease;
}
```

- [ ] **Step 2: Loading bar HTML ekle**

`public/index.html` içinde loader div'ini bul:

```html
<div id="loader-overlay">
    <div class="loader-ring"></div>
    <div id="loader-status">BAŞLATILIYOR...</div>
</div>
```

Şununla değiştir:

```html
<div id="loader-overlay">
    <div class="loader-ring"></div>
    <div id="loader-status">BAŞLATILIYOR...</div>
    <div id="loader-bar-wrap">
        <div id="loader-bar"></div>
    </div>
</div>
```

- [ ] **Step 3: JS'de ilerleme göstergesi ekle**

`public/index.html` içinde `initScene()` fonksiyonunu bul, en başına ekle:

```js
const loaderBar = document.getElementById('loader-bar');
function setProgress(pct, label) {
    if (loaderBar) loaderBar.style.width = pct + '%';
    if (loaderStatus && label) loaderStatus.textContent = label;
}
window.setProgress = setProgress;
```

`loaderStatus.textContent = "ODA YÜKLENİYOR..."` yerine:
```js
setProgress(10, "ODA YÜKLENİYOR...");
```

`loadRoom()` içinde oda yüklendikten sonra:
```js
setProgress(40, "AVATAR YÜKLENİYOR...");
```

`loadAvatar()` içinde extraAnims yüklenmeye başlamadan önce:
```js
setProgress(60, "ANİMASYONLAR YÜKLENİYOR...");
```

`playAnimation('Idle', true)` öncesinde:
```js
setProgress(100, "HAZIR");
```

- [ ] **Step 4: Tarayıcıda test et**

Sayfayı yenile — loading bar yavaşça dolup %100'e ulaşıyor mu?

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: add progress bar to loading screen"
```

---

## Chunk 3: Performans — Paralel Yükleme

### Task 5: Oda ve Avatar'ı Paralel Yükle

**Files:**
- Modify: `public/index.html:449-579` (loadRoom ve loadAvatar fonksiyonları)

Şu anki akış: `loadRoom()` → tamamlanınca `loadAvatar()` → tamamlanınca animasyonlar

Yeni akış: `loadRoom()` ve `loadAvatar()` paralel başlar → ikisi de bitince sahne hazır

- [ ] **Step 1: `loadRoom()` ve `loadAvatar()`'ı bağımsız hale getir**

`public/index.html` içinde `initScene()` fonksiyonunda şu satırı bul:

```js
loaderStatus.textContent = "ODA YÜKLENİYOR...";
loadRoom();
```

Şununla değiştir:

```js
setProgress(10, "SAHNE HAZIRLANIYOR...");
Promise.all([loadRoom(), loadAvatar()]).then(() => {
    setProgress(100, "HAZIR");
    playAnimation('Idle', true);
    hideLoader();
});
```

- [ ] **Step 2: `loadRoom()`'u Promise döndürecek şekilde güncelle**

`function loadRoom()` fonksiyonunu şu şekilde değiştir — `return new Promise(...)` ile sar:

```js
function loadRoom() {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.load('/room_model/scene.gltf', (gltf) => {
            const room = gltf.scene;
            room.traverse(n => { if(n.isMesh) { n.receiveShadow = true; n.castShadow = true; } });
            scene.add(room);
            const box    = new THREE.Box3().setFromObject(room);
            const size   = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            window.roomBox    = box;
            window.roomCenter = center;
            window.floorY     = box.min.y;
            const raycaster = new THREE.Raycaster(
                new THREE.Vector3(center.x, box.max.y + 1, center.z),
                new THREE.Vector3(0, -1, 0)
            );
            const meshes = [];
            room.traverse(n => { if (n.isMesh) meshes.push(n); });
            const hits = raycaster.intersectObjects(meshes, false);
            window.floorY = hits.length > 0 ? hits[0].point.y : box.min.y;
            setProgress(40, "ODA HAZIRLANDI");
            resolve();
        }, undefined, (err) => {
            console.error('[ROOM] Yükleme hatası:', err);
            window.floorY = -1.5;
            window.roomCenter = new THREE.Vector3(0, 0, 0);
            resolve(); // hata olsa bile devam et
        });
    });
}
```

- [ ] **Step 3: `loadAvatar()`'ı Promise döndürecek şekilde güncelle**

Mevcut `loadAvatar()` fonksiyonunu tamamen şununla değiştir:

```js
function loadAvatar() {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.load('/' + character.model, (gltf) => {
            setProgress(60, "AVATAR YÜKLENİYOR...");
            avatar = gltf.scene;
            avatar.traverse(n => { if(n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });

            avatar.position.set(0,0,0);
            avatar.scale.set(1,1,1);
            avatar.updateMatrixWorld(true);
            const aBox  = new THREE.Box3().setFromObject(avatar);
            const aSize = aBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(aSize.x, aSize.y, aSize.z);
            const targetH = 1.8;
            const sc = (targetH / maxDim) * character.scaleMult;
            avatar.scale.set(sc, sc, sc);
            avatar.updateMatrixWorld(true);

            const newBox = new THREE.Box3().setFromObject(avatar);
            const fy = window.floorY !== undefined ? window.floorY : -1.0;
            const charH = (newBox.max.y - newBox.min.y);
            avatar.position.set(-0.6, fy - newBox.min.y, 0);
            avatar.updateMatrixWorld(true);

            avatar.rotation.y = Math.PI * 0.05;
            avatar.userData.baseRotY = Math.PI * 0.05;

            const camY  = fy + charH * 0.52;
            const camZ  = 2.8;
            camera.position.set(-0.6, camY, camZ);
            cameraTarget.set(-0.6, fy + charH * 0.42, 0);
            camera.lookAt(cameraTarget);
            window.defaultCam = { y: camY, z: camZ, tgtY: fy + charH * 0.42 };

            console.log('[CHAR] pos:', avatar.position, 'charH:', charH, 'fy:', fy);
            scene.add(avatar);

            mixer = new THREE.AnimationMixer(avatar);
            animationsMap = {};
            if (gltf.animations) {
                gltf.animations.forEach(clip => {
                    const validTracks = clip.tracks.filter(t => !!avatar.getObjectByName(t.name.split('.')[0]));
                    if (validTracks.length > 0) {
                        const nc = new THREE.AnimationClip(clip.name, clip.duration, validTracks);
                        animationsMap[clip.name] = mixer.clipAction(nc);
                    }
                });
            }

            setProgress(70, "ANİMASYONLAR YÜKLENİYOR...");
            const extraLoader = new GLTFLoader();
            Promise.all(extraAnims.map(({ file, name }) =>
                new Promise(res => {
                    extraLoader.load('/' + file, (a) => {
                        if (a.animations.length) {
                            const clip = a.animations[0];
                            const ft = clip.tracks.filter(t => !!avatar.getObjectByName(t.name.split('.')[0]));
                            if (ft.length > 0) {
                                const nc = new THREE.AnimationClip(name, clip.duration, ft);
                                animationsMap[name] = mixer.clipAction(nc);
                            }
                        }
                        res();
                    }, undefined, () => res());
                })
            )).then(() => {
                setProgress(90, "ANİMASYONLAR HAZIR");
                resolve(); // playAnimation ve hideLoader artık dışarıda çağrılıyor
            });

        }, undefined, (err) => {
            console.error('[CHAR] Yükleme hatası:', err);
            resolve(); // hata olsa bile devam et
        });
    });
}
```

Avatar pozisyon/kamera kurulumu için `window.floorY` kullanılıyor. Paralel yüklemede oda ve avatar aynı anda yükleniyor, oda daha önce biterse `window.floorY` hazır olur. Eğer avatar daha önce biterse `window.floorY` undefined olabilir — bu zaten `fy = window.floorY !== undefined ? window.floorY : -1.0` fallback ile halledilmiş.

- [ ] **Step 4: `loadRoom()` içindeki `loadSpongebob()` / `loadAvatar()` çağrısını kaldır**

Artık `Promise.all` yönetiyor — `loadRoom()` içinde `loadSpongebob()` veya `loadAvatar()` çağrısı olmamalı.

- [ ] **Step 5: Tarayıcıda test et**

Sayfayı yenile. Loading süresini gözlemle — öncekinden daha hızlı mı? Karakter ve oda doğru görünüyor mu? Console'da hata var mı?

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "perf: load room and avatar in parallel to reduce startup time"
```

---

## Chunk 4: Hata Yönetimi — Vapi Bağlantı Sorunları

### Task 6: Kullanıcıya Vapi Hata Mesajı Göster

**Files:**
- Modify: `public/index.html` (Vapi event handlers)

- [ ] **Step 1: Hata CSS ekle**

CSS içine ekle:

```css
#error-toast {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(180, 60, 50, 0.9);
    border: 1px solid rgba(220,100,90,0.4);
    backdrop-filter: blur(12px);
    color: #ffd4cc;
    padding: 14px 28px;
    border-radius: 12px;
    font-size: 0.85rem;
    letter-spacing: 1px;
    z-index: 100;
    opacity: 0;
    transition: opacity 0.4s ease;
    pointer-events: none;
}
#error-toast.show { opacity: 1; }
```

- [ ] **Step 2: HTML'e toast ekle**

`<div id="canvas-container">` öncesine ekle:

```html
<div id="error-toast"></div>
```

- [ ] **Step 3: JS'de showError fonksiyonu ekle**

Script başında (değişken tanımlamalarının altına) ekle:

```js
function showError(msg) {
    const t = document.getElementById('error-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4000);
}
```

- [ ] **Step 4: Vapi error event handler ekle**

`vapiInstance.on('call-end', ...)` bloğundan sonra ekle:

```js
vapiInstance.on('error', (err) => {
    console.error('[VAPI] Hata:', err);
    isCallActive = false;
    talkBtn.textContent = "GÖRÜŞMEYİ BAŞLAT";
    talkBtn.classList.remove('active');
    document.getElementById('mic-indicator').classList.remove('active');
    statusEl.classList.remove('listening');
    statusEl.textContent = "SİSTEM HAZIR";
    showError("Bağlantı hatası oluştu. Lütfen tekrar deneyin.");
});
```

- [ ] **Step 5: Tarayıcıda test et**

Sunucu kapalıyken görüşme başlatmayı dene — kırmızı toast mesajı çıkıyor mu?

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat: add error toast for Vapi connection failures"
```

---

## Son Kontrol

- [ ] Tüm animasyonlar çalışıyor (Idle, Talk, Wave, Agreeing)
- [ ] Karakter sahneye düzgün yerleşiyor, zemine oturuyor
- [ ] Loading bar dolup bitiyor
- [ ] Görüşme başlatınca mic dalgaları görünüyor, status badge kırmızı pulseuyor
- [ ] Transcript değişince fade oluyor
- [ ] Hata durumunda toast mesajı çıkıyor
