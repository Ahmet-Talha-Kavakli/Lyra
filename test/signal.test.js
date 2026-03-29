// test/signal.test.js
// Konuşma sinyal sistemi testleri
// Her test: "bu durumda hangi sinyal çıkmalı?"

import { describe, it, expect } from 'vitest';
import { decideConversationSignal } from '../therapy/conversationSignal.js';

// ─── YARDIMCI ────────────────────────────────────────────────────────────────
// decideConversationSignal() şu parametreleri alıyor:
// { emotionResult, messageLength, messageCount, lastLyraAction, dominantTopics, rhythmState, messageContent }

function signal({
  content = '',
  count = 1,
  intensity = 'düşük',
  primary = 'sakin',
  lastAction = null,
  topics = [],
  trend = 'stable',
  writerType = 'medium',
} = {}) {
  return decideConversationSignal({
    emotionResult: { primary, secondary: null, intensity },
    messageLength: content.length,
    messageCount: count,
    lastLyraAction: lastAction,
    dominantTopics: topics,
    rhythmState: { trend, writerType, emotionalArc: 'stable', sessionMomentum: 'building' },
    messageContent: content,
  });
}

// ─── WARMUP ──────────────────────────────────────────────────────────────────
describe('WARMUP — selamlama', () => {
  it('merhaba → WARMUP', () => {
    expect(signal({ content: 'merhaba', count: 1 })).toBe('WARMUP');
  });

  it('selam nasılsın → WARMUP', () => {
    expect(signal({ content: 'selam nasılsın', count: 1 })).toBe('WARMUP');
  });

  it('günaydın → WARMUP', () => {
    expect(signal({ content: 'günaydın', count: 2 })).toBe('WARMUP');
  });

  it('selamlama + ağır içerik → WARMUP DEĞİL (duygusal öncelik)', () => {
    const result = signal({ content: 'merhaba bugün çok kötüyüm', count: 1 });
    expect(result).not.toBe('WARMUP');
  });

  it('merhaba ama 4. mesaj → WARMUP DEĞİL (pencere kapandı)', () => {
    const result = signal({ content: 'merhaba', count: 4 });
    expect(result).not.toBe('WARMUP');
  });
});

// ─── KRİZ / PRESENCE ─────────────────────────────────────────────────────────
describe('PRESENCE — kriz', () => {
  it('intihar kelimesi → PRESENCE', () => {
    expect(signal({ content: 'intihar etmeyi düşünüyorum', count: 3 })).toBe('PRESENCE');
  });

  it('ölmek istiyorum → PRESENCE', () => {
    expect(signal({ content: 'ölmek istiyorum artık', count: 5 })).toBe('PRESENCE');
  });

  it('kendime zarar → PRESENCE', () => {
    expect(signal({ content: 'kendime zarar veriyorum', count: 2 })).toBe('PRESENCE');
  });
});

// ─── VALIDATE ────────────────────────────────────────────────────────────────
describe('VALIDATE — yüksek yoğunluk', () => {
  it('yüksek yoğunluk + erken tur → VALIDATE', () => {
    expect(signal({ content: 'çok üzgünüm', count: 2, primary: 'üzüntü', intensity: 'yüksek' })).toBe('VALIDATE');
  });

  it('tükenmişlik yüksek yoğunluk → VALIDATE', () => {
    expect(signal({ content: 'tamamen tükendim', count: 5, primary: 'tükenmişlik', intensity: 'yüksek' })).toBe('VALIDATE');
  });
});

// ─── GUIDE ───────────────────────────────────────────────────────────────────
describe('GUIDE — yön isteme', () => {
  it('ne yapmalıyım → GUIDE', () => {
    expect(signal({ content: 'ne yapmalıyım bilmiyorum', count: 4 })).toBe('GUIDE');
  });

  it('ne önerirsin → GUIDE', () => {
    expect(signal({ content: 'ne önerirsin bu konuda', count: 5 })).toBe('GUIDE');
  });

  it('yardım et → GUIDE', () => {
    expect(signal({ content: 'yardım et lütfen', count: 4 })).toBe('GUIDE');
  });

  it('yön isteği ama ilk 2 mesaj → GUIDE DEĞİL (henüz erken)', () => {
    const result = signal({ content: 'ne yapmalıyım', count: 2 });
    expect(result).not.toBe('GUIDE');
  });
});

// ─── REFLECT ─────────────────────────────────────────────────────────────────
describe('REFLECT — önceki turda soru soruldu', () => {
  it('son Lyra aksiyonu soru sordu → REFLECT', () => {
    expect(signal({ content: 'bilmiyorum işte', count: 5, lastAction: 'asked_question' })).toBe('REFLECT');
  });
});

// ─── EXPLORE ─────────────────────────────────────────────────────────────────
describe('EXPLORE — keşif', () => {
  it('ilk mesaj, düşük yoğunluk → EXPLORE_GENTLE', () => {
    expect(signal({ content: 'bugün biraz yorgunum', count: 1 })).toBe('EXPLORE_GENTLE');
  });

  it('açılıyor + yerleşmiş konuşma → EXPLORE_DEEP', () => {
    expect(signal({ content: 'aslında şunu da söyleyeyim', count: 6, trend: 'opening_up' })).toBe('EXPLORE_DEEP');
  });
});

// ─── BRIDGE ──────────────────────────────────────────────────────────────────
describe('BRIDGE — tekrarlayan konu', () => {
  it('2+ konu + 6. mesaj → BRIDGE', () => {
    expect(signal({ content: 'yine aynı şeyler', count: 6, topics: ['aile', 'iş'] })).toBe('BRIDGE');
  });
});