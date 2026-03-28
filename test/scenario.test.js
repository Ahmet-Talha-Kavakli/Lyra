// test/scenario.test.js
// Derin senaryo tespiti testleri

import { describe, it, expect } from 'vitest';
import { detectScenario } from '../therapy/deepScenarios.js';

function makeMessages(userTexts) {
  return userTexts.map(t => ({ role: 'user', content: t }));
}

describe('Akut Yas', () => {
  it('kedim öldü → acute_grief', () => {
    const msgs = makeMessages(['kedim öldü dün gece']);
    expect(detectScenario(msgs, 'üzüntü', [])).toBe('acute_grief');
  });

  it('annem vefat etti → acute_grief', () => {
    const msgs = makeMessages(['annem vefat etti geçen hafta']);
    expect(detectScenario(msgs, 'üzüntü', ['kayıp'])).toBe('acute_grief');
  });
});

describe('Utanç', () => {
  it('çok utandım → shame', () => {
    const msgs = makeMessages(['bu konuda çok utanıyorum söylemesi zor']);
    expect(detectScenario(msgs, 'utanç', [])).toBe('shame');
  });
});

describe('Tükenmişlik', () => {
  it('tamamen tükendim → burnout', () => {
    const msgs = makeMessages(['tamamen tükendim artık devam edemiyorum']);
    expect(detectScenario(msgs, 'tükenmişlik', [])).toBe('burnout');
  });
});

describe('Öfke', () => {
  it('nefret ediyorum → anger', () => {
    const msgs = makeMessages(['patronumdan nefret ediyorum çıldıracağım']);
    expect(detectScenario(msgs, 'öfke', ['iş'])).toBe('anger');
  });
});

describe('Kriz yok', () => {
  it('normal mesaj → null', () => {
    const msgs = makeMessages(['bugün biraz yorgunum']);
    expect(detectScenario(msgs, 'sakin', [])).toBeNull();
  });
});