/**
 * ProceduralLayers.js
 * Her frame çalışan prosedürel animasyon katmanları:
 * - Göz kırpma (otomatik, rastgele aralıklı)
 * - Sakkadik göz hareketi (gerçekçi bakış yönü)
 * - Mikro ifadeler (empati, merak, düşünce, sıcaklık)
 * - LipSyncEngine'in üstüne eklenir, çakışmaz
 */

// Duygusal duruma göre mikro ifade şablonları
const MICRO_EXPRESSIONS = {
  empathy:    { browInnerUp: 0.45, mouthSmileLeft: 0.18, mouthSmileRight: 0.18 },
  concern:    { browInnerUp: 0.55, browDownLeft: 0.30, browDownRight: 0.30 },
  curiosity:  { browOuterUpLeft: 0.50, browOuterUpRight: 0.50, eyeWideLeft: 0.20, eyeWideRight: 0.20 },
  thinking:   { browDownLeft: 0.35, browDownRight: 0.35, eyeSquintLeft: 0.15, eyeSquintRight: 0.15 },
  warmth:     { mouthSmileLeft: 0.35, mouthSmileRight: 0.35, cheekSquintLeft: 0.25, cheekSquintRight: 0.25 },
  surprise:   { eyeWideLeft: 0.70, eyeWideRight: 0.70, browOuterUpLeft: 0.60, browOuterUpRight: 0.60, jawOpen: 0.20 },
  neutral:    {},
};

export class ProceduralLayers {
  constructor() {
    this.headMeshes = [];    // morph target'a sahip yüz mesh'leri

    // Göz kırpma
    this._blinkTimer = 0;
    this._nextBlink = 3.5;
    this._blinkPhase = 0;    // 0=bekliyor, 1=kapanıyor, 2=açılıyor
    this._blinkProgress = 0;

    // Sakkadik göz hareketi
    this._eyeH = 0;          // -1 sol, 0 merkez, 1 sağ
    this._eyeV = 0;          // -1 aşağı, 0 merkez, 1 yukarı
    this._eyeTargetH = 0;
    this._eyeTargetV = 0;
    this._saccadeTimer = 0;
    this._nextSaccade = 2.0;

    // Mikro ifadeler
    this._microQueue = [];
    this._currentMicro = null;
    this._microProgress = 0; // 0→1→0 (fade in / out)
    this._microDuration = 1.5;

    // Çıktı şekilleri (LipSync ile toplanır)
    this._shapes = {};
  }

  /** Avatar yüklenince çağrıl */
  init(avatarRoot) {
    this.headMeshes = [];
    avatarRoot.traverse((node) => {
      if (
        node.isMesh &&
        node.morphTargetInfluences &&
        node.morphTargetDictionary &&
        Object.keys(node.morphTargetDictionary).length > 0
      ) {
        this.headMeshes.push(node);
      }
    });
  }

  /** Dışarıdan mikro ifade tetikle (terapi motorundan çağrılabilir) */
  trigger(expressionName, intensity = 1.0) {
    if (!MICRO_EXPRESSIONS[expressionName]) return;
    this._microQueue.push({ name: expressionName, intensity });
  }

  /**
   * animate() loop içinde her frame çağrıl.
   * @param {number} dt    — delta time (saniye)
   * @param {number} t     — elapsed time (saniye)
   * @param {string} emotion — mevcut duygu durumu ('empathy','concern',...)
   */
  update(dt, t, emotion = 'neutral') {
    this._shapes = {};

    this._updateBlink(dt, t);
    this._updateEyeMovement(dt, t);
    this._updateMicroExpressions(dt, t, emotion);
    this._applyToMeshes();
  }

  // ─── Göz Kırpma ──────────────────────────────────────────────────────────

  _updateBlink(dt, t) {
    this._blinkTimer += dt;

    if (this._blinkPhase === 0 && this._blinkTimer >= this._nextBlink) {
      // Kırpmaya başla
      this._blinkPhase = 1;
      this._blinkProgress = 0;
      this._blinkTimer = 0;
      this._nextBlink = 2.8 + Math.random() * 4.2;
    }

    if (this._blinkPhase === 1) {
      // Kapanıyor (0.08s)
      this._blinkProgress += dt / 0.08;
      if (this._blinkProgress >= 1) {
        this._blinkProgress = 1;
        this._blinkPhase = 2;
      }
    } else if (this._blinkPhase === 2) {
      // Açılıyor (0.12s)
      this._blinkProgress -= dt / 0.12;
      if (this._blinkProgress <= 0) {
        this._blinkProgress = 0;
        this._blinkPhase = 0;
      }
    }

    const blink = Math.sin(this._blinkProgress * Math.PI);
    this._shapes['eyeBlinkLeft'] = blink;
    this._shapes['eyeBlinkRight'] = blink;
  }

  // ─── Sakkadik Göz Hareketi ────────────────────────────────────────────────

  _updateEyeMovement(dt, t) {
    this._saccadeTimer += dt;
    if (this._saccadeTimer >= this._nextSaccade) {
      // Yeni hedef: kameraya yakın ama hafif kaymış
      this._eyeTargetH = (Math.random() - 0.5) * 0.35;
      this._eyeTargetV = (Math.random() - 0.5) * 0.20;
      this._saccadeTimer = 0;
      this._nextSaccade = 1.2 + Math.random() * 2.8;
    }

    // Smooth saccade
    const speed = dt * 7;
    this._eyeH += (this._eyeTargetH - this._eyeH) * speed;
    this._eyeV += (this._eyeTargetV - this._eyeV) * speed;

    // Yatay: sol/sağ
    this._shapes['eyeLookOutLeft']  = Math.max(0,  this._eyeH);
    this._shapes['eyeLookInLeft']   = Math.max(0, -this._eyeH);
    this._shapes['eyeLookOutRight'] = Math.max(0, -this._eyeH);
    this._shapes['eyeLookInRight']  = Math.max(0,  this._eyeH);

    // Dikey: yukarı/aşağı
    this._shapes['eyeLookUpLeft']    = Math.max(0,  this._eyeV);
    this._shapes['eyeLookUpRight']   = Math.max(0,  this._eyeV);
    this._shapes['eyeLookDownLeft']  = Math.max(0, -this._eyeV);
    this._shapes['eyeLookDownRight'] = Math.max(0, -this._eyeV);
  }

  // ─── Mikro İfadeler ───────────────────────────────────────────────────────

  _updateMicroExpressions(dt, t, emotion) {
    // Aktif mikro ifade yoksa kuyruktan al
    if (!this._currentMicro && this._microQueue.length > 0) {
      this._currentMicro = this._microQueue.shift();
      this._microProgress = 0;
    }

    // Duygu durumu sürekli hafif bir baseline oluşturur
    const baseExpr = MICRO_EXPRESSIONS[emotion] || {};
    Object.entries(baseExpr).forEach(([k, v]) => {
      this._shapes[k] = (this._shapes[k] ?? 0) + v * 0.4;
    });

    // Tetiklenmiş mikro ifade (daha kısa, daha güçlü)
    if (this._currentMicro) {
      this._microProgress += dt / this._microDuration;

      // Üçgen zarfı: 0→1→0
      const envelope = this._microProgress < 0.5
        ? this._microProgress * 2
        : (1 - this._microProgress) * 2;

      const expr = MICRO_EXPRESSIONS[this._currentMicro.name] || {};
      const intensity = this._currentMicro.intensity * envelope;

      Object.entries(expr).forEach(([k, v]) => {
        this._shapes[k] = Math.min(1, (this._shapes[k] ?? 0) + v * intensity);
      });

      if (this._microProgress >= 1) this._currentMicro = null;
    }
  }

  // ─── Mesh'e Uygula ────────────────────────────────────────────────────────

  _applyToMeshes() {
    this.headMeshes.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      Object.entries(this._shapes).forEach(([key, value]) => {
        const idx = dict[key];
        if (idx !== undefined) {
          // LipSync değerlerine EKLE (replace değil)
          inf[idx] = Math.min(1, (inf[idx] ?? 0) + Math.max(0, value));
        }
      });
    });
  }
}
