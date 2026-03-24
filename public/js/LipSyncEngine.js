/**
 * LipSyncEngine.js
 * Azure TTS viseme event'lerini ARKit morph target'larına map eder.
 * Volume-scalar yaklaşımın yerini alır — fonem bazlı lip sync sağlar.
 */

// Azure Viseme ID (0-21) → ARKit morph target ağırlıkları
const AZURE_VISEME_TO_ARKIT = {
  0:  { jawOpen: 0.0, mouthClose: 0.8 },
  1:  { jawOpen: 0.30, mouthSmileLeft: 0.40, mouthSmileRight: 0.40 },
  2:  { jawOpen: 0.45, mouthSmileLeft: 0.20, mouthSmileRight: 0.20 },
  3:  { jawOpen: 0.35, mouthFrownLeft: 0.10, mouthFrownRight: 0.10 },
  4:  { jawOpen: 0.20, mouthPucker: 0.20 },
  5:  { jawOpen: 0.15, mouthSmileLeft: 0.30, mouthSmileRight: 0.30 },
  6:  { jawOpen: 0.05, mouthSmileLeft: 0.70, mouthSmileRight: 0.70 },
  7:  { jawOpen: 0.05, mouthPucker: 0.80, cheekPuff: 0.15 },
  8:  { jawOpen: 0.10, mouthPucker: 0.50 },
  9:  { jawOpen: 0.10, mouthPucker: 0.70 },
  10: { jawOpen: 0.08, mouthPucker: 0.60 },
  11: { jawOpen: 0.35, mouthFrownLeft: 0.25, mouthFrownRight: 0.25 },
  12: { jawOpen: 0.12, mouthSmileLeft: 0.10, mouthSmileRight: 0.10 },
  13: { jawOpen: 0.10, mouthSmileLeft: 0.20, mouthSmileRight: 0.20 },
  14: { jawOpen: 0.08, mouthSmileLeft: 0.50, mouthSmileRight: 0.50 },
  15: { jawOpen: 0.05, mouthPressLeft: 0.50, mouthPressRight: 0.50 },
  16: { jawOpen: 0.05, mouthStretchLeft: 0.30, mouthStretchRight: 0.30 },
  17: { jawOpen: 0.12, mouthLowerDownLeft: 0.35, mouthLowerDownRight: 0.35 },
  18: { jawOpen: 0.00, mouthClose: 1.00, mouthRollLower: 0.40 },
  19: { jawOpen: 0.00, mouthClose: 1.00 },
  20: { jawOpen: 0.00, mouthClose: 1.00 },
  21: { jawOpen: 0.00, mouthClose: 1.00 },
};

// Fallback: Vapi ses seviyesi kullanılırken basit ağız açma
const VOLUME_VISEME = (volume) => ({
  jawOpen: Math.min(volume * 0.8, 0.7),
  mouthClose: Math.max(0, 0.3 - volume),
});

export class LipSyncEngine {
  constructor() {
    this.meshes = [];          // morph target'a sahip mesh'ler
    this.timeline = [];        // [{ t: ms, shapes: {...} }]
    this.timelineIndex = 0;
    this.audioStartTime = null; // performance.now() cinsinden
    this.currentShapes = {};
    this.targetShapes = {};
    this.smoothing = 0.28;     // lerp faktörü (0.1=yavaş, 0.4=keskin)
    this.mode = 'idle';        // 'idle' | 'viseme' | 'volume'
    this._currentVolume = 0;
  }

  /** Avatar yüklenince çağrıl — morph target'a sahip mesh'leri toplar */
  init(avatarRoot) {
    this.meshes = [];
    avatarRoot.traverse((node) => {
      if (
        node.isMesh &&
        node.morphTargetInfluences &&
        node.morphTargetDictionary &&
        Object.keys(node.morphTargetDictionary).length > 0
      ) {
        this.meshes.push(node);
      }
    });
    console.log(`[LipSync] ${this.meshes.length} morph mesh bulundu.`);
  }

  /**
   * Azure TTS'den gelen viseme timeline'ını yükle.
   * @param {Array} visemes  — [{ audioOffset: ms, visemeId: 0-21 }]
   * @param {number} startTime — performance.now() cinsinden ses başlangıcı
   */
  loadVisemes(visemes, startTime) {
    this.timeline = visemes.map((v) => ({
      t: v.audioOffset,
      shapes: AZURE_VISEME_TO_ARKIT[v.visemeId] || AZURE_VISEME_TO_ARKIT[0],
    }));
    this.timelineIndex = 0;
    this.audioStartTime = startTime;
    this.mode = 'viseme';
  }

  /** Vapi ses seviyesi modu (Azure yokken fallback) */
  setVolume(volume) {
    this._currentVolume = volume;
    if (this.mode !== 'viseme') this.mode = 'volume';
  }

  /** Konuşma bitince çağrıl */
  stop() {
    this.mode = 'idle';
    this.timeline = [];
    this.audioStartTime = null;
    this.timelineIndex = 0;
    Object.keys(this.targetShapes).forEach((k) => { this.targetShapes[k] = 0; });
  }

  /** animate() loop içinde her frame çağrıl */
  update() {
    if (this.meshes.length === 0) return;

    if (this.mode === 'viseme' && this.audioStartTime !== null) {
      this._updateVisemeMode();
    } else if (this.mode === 'volume') {
      this._updateVolumeMode();
    } else {
      // Idle — ağzı yavaşça kapat
      Object.keys(this.targetShapes).forEach((k) => { this.targetShapes[k] = 0; });
    }

    this._applyShapes();
  }

  _updateVisemeMode() {
    const elapsed = performance.now() - this.audioStartTime;

    // Timeline pointer'ı ilerlet
    while (
      this.timelineIndex < this.timeline.length - 1 &&
      this.timeline[this.timelineIndex + 1].t <= elapsed
    ) {
      this.timelineIndex++;
    }

    // Tüm hedefleri sıfırla
    const allKeys = new Set(
      Object.values(AZURE_VISEME_TO_ARKIT).flatMap((s) => Object.keys(s))
    );
    allKeys.forEach((k) => { this.targetShapes[k] = 0; });

    // Mevcut viseme'yi uygula
    const current = this.timeline[this.timelineIndex];
    if (current) Object.assign(this.targetShapes, current.shapes);

    // Timeline bittiyse dur
    if (this.timelineIndex >= this.timeline.length - 1 && elapsed > (this.timeline.at(-1)?.t ?? 0) + 500) {
      this.stop();
    }
  }

  _updateVolumeMode() {
    const shapes = VOLUME_VISEME(this._currentVolume);
    Object.assign(this.targetShapes, shapes);
  }

  _applyShapes() {
    const s = this.smoothing;
    // Lerp: current → target
    const allKeys = new Set([
      ...Object.keys(this.currentShapes),
      ...Object.keys(this.targetShapes),
    ]);
    allKeys.forEach((key) => {
      const cur = this.currentShapes[key] ?? 0;
      const tgt = this.targetShapes[key] ?? 0;
      this.currentShapes[key] = cur + (tgt - cur) * s;
    });

    // Mesh'lere yaz
    this.meshes.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;
      Object.entries(this.currentShapes).forEach(([key, value]) => {
        const idx = dict[key];
        if (idx !== undefined) inf[idx] = Math.max(0, Math.min(1, value));
      });
    });
  }
}
