/**
 * AnimationLayerSystem.js
 * Mevcut tek-mixer yaklaşımını 3 katmana ayırır:
 *
 *   base     — sürekli döngüsel: nefes alma, idle
 *   gesture  — tek seferlik: kol/vücut hareketleri (konuşma, duygusal)
 *   listen   — döngüsel overlay: kullanıcı konuşurken hafif nod/tilt
 *
 * Kullanım:
 *   const als = new AnimationLayerSystem(avatarRoot);
 *   als.loadClips(animationsMap);       // mevcut animationsMap'i ver
 *   als.playBase('Idle');
 *   als.playGesture('Wave');
 *   als.setListening(true);
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export class AnimationLayerSystem {
  constructor(avatarRoot) {
    this.mixer = new THREE.AnimationMixer(avatarRoot);
    this._clips = {};       // name → AnimationClip
    this._actions = {};     // name → AnimationAction

    this._baseAction    = null;
    this._gestureAction = null;
    this._listenAction  = null;

    this._isListening = false;
  }

  /** Mevcut animationsMap'ten clip'leri al */
  loadClips(animationsMap) {
    // animationsMap: { name: AnimationAction }
    // Clip'leri saklıyoruz, action'ları yeniden yaratacağız
    Object.entries(animationsMap).forEach(([name, action]) => {
      this._clips[name] = action._clip;
    });
  }

  /** Mixer'ı güncelle — animate() içinde çağrıl */
  update(delta) {
    this.mixer.update(delta);
  }

  // ─── Base Katman (sürekli döngü) ─────────────────────────────────────────

  playBase(name, fadeTime = 0.6) {
    const clip = this._getClip(name);
    if (!clip) return;

    const newAction = this.mixer.clipAction(clip);
    newAction.setLoop(THREE.LoopRepeat);
    newAction.clampWhenFinished = false;
    newAction.setEffectiveWeight(1.0);

    if (this._baseAction && this._baseAction !== newAction) {
      newAction.reset().play();
      newAction.crossFadeFrom(this._baseAction, fadeTime, true);
    } else if (!this._baseAction) {
      newAction.reset().play();
    }

    this._baseAction = newAction;
  }

  // ─── Gesture Katmanı (tek seferlik) ──────────────────────────────────────

  playGesture(name, weight = 1.0, fadeIn = 0.25) {
    const clip = this._getClip(name);
    if (!clip) return;

    // Önceki gesture'ı fade out et
    if (this._gestureAction) {
      this._gestureAction.fadeOut(0.2);
    }

    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(weight);
    action.fadeIn(fadeIn);
    action.play();

    this._gestureAction = action;

    // Bitince temizle
    const onFinish = (e) => {
      if (e.action === action) {
        action.fadeOut(0.35);
        this._gestureAction = null;
        this.mixer.removeEventListener('finished', onFinish);
      }
    };
    this.mixer.addEventListener('finished', onFinish);
  }

  // ─── Listen Katmanı (kullanıcı konuşurken) ───────────────────────────────

  setListening(active) {
    if (active === this._isListening) return;
    this._isListening = active;

    if (active) {
      const clip = this._getClip('listen_nod') || this._getClip('Agreeing');
      if (!clip) return;

      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat);
      action.setEffectiveWeight(0.4);  // base ile blend — tam override değil
      action.reset().fadeIn(0.4).play();
      this._listenAction = action;
    } else {
      if (this._listenAction) {
        this._listenAction.fadeOut(0.5);
        this._listenAction = null;
      }
    }
  }

  // ─── Konuşma Jesti Seçimi ─────────────────────────────────────────────────

  /**
   * Terapi motoru çağırır — duygu/mod'a göre uygun jesti seçer.
   * @param {string} emotion — 'empathy' | 'concern' | 'joy' | 'thinking' | 'neutral'
   */
  playEmotionalGesture(emotion) {
    const map = {
      empathy:  ['Waving Gesture', 'Agreeing'],
      concern:  ['Breathing Idle', 'Sad Idle'],
      joy:      ['Joyful Jump', 'Wave Hip Hop Dance'],
      thinking: ['Looking Around'],
      neutral:  ['Talking'],
      surprise: ['Surprised'],
    };

    const options = map[emotion] || map.neutral;
    const name = options[Math.floor(Math.random() * options.length)];
    this.playGesture(name);
  }

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

  _getClip(name) {
    if (this._clips[name]) return this._clips[name];
    // Büyük/küçük harf toleransı
    const key = Object.keys(this._clips).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    return key ? this._clips[key] : null;
  }

  /** Mixer'ı mevcut three.js animationsMap ile senkronize et (geçiş dönemi için) */
  syncFromMap(animationsMap) {
    this.loadClips(animationsMap);
  }
}
