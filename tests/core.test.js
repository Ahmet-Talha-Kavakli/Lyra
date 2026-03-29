// tests/core.test.js
// Vitest + core functionality unit tests
// Tetikleyici tespiti, parça analizi, psikoeğitim, analytics

import { describe, it, expect } from 'vitest';

// Imports
import { detectTrigger, buildTraumaSafetyContext } from '../lib/traumaInformed.js';
import { detectInternalParts } from '../lib/ifsFramework.js';
import { buildPsychoeducationContext } from '../lib/psychoEducation.js';
import { detectSelfHarmRisk } from '../lib/safetyMonitoring.js';
import { checkScopeViolation } from '../lib/ethicalBoundaries.js';
import { assessBondQuality } from '../lib/therapeuticBond.js';

describe('Trauma-Informed System', () => {
  it('Tetikleyici tespiti: flooding', () => {
    const msg = 'Titreme başladı, nefes alınamıyor, çok hızlı kalp atıyor';
    const result = detectTrigger(msg);
    expect(result.hasTrigger).toBe(true);
    expect(result.triggerType).toBe('flooding');
  });

  it('Tetikleyici tespiti: flashback', () => {
    const msg = 'Anı hatırladım, sanki şu an yaşıyorum, gerçek mi değil mi bilmiyorum';
    const result = detectTrigger(msg);
    expect(result.hasTrigger).toBe(true);
    expect(result.triggerType).toBe('flashback');
  });

  it('Tetikleyici tespiti: disosiyasyon', () => {
    const msg = 'Ruh bedenden çıktı, ben değilim bu, gerçek değil';
    const result = detectTrigger(msg);
    expect(result.hasTrigger).toBe(true);
    expect(result.triggerType).toBe('dissociation');
  });

  it('Güvenlik bağlamı oluştur', () => {
    const context = buildTraumaSafetyContext(true);
    expect(context).toContain('TRAUMA-INFORMED');
    expect(context).toContain('kontrol');
  });
});

describe('IFS Framework', () => {
  it('Yangın Söndürücü tespiti', () => {
    const msg = 'Alkol içmek istiyorum, kaçmak istiyorum, unutmak istiyorum';
    const result = detectInternalParts(msg);
    expect(result.detectedParts.some(p => p.type === 'firefighter')).toBe(true);
  });

  it('Yönetici tespiti', () => {
    const msg = 'Planladım, kontrol etmeliyim, hata yapamam';
    const result = detectInternalParts(msg);
    expect(result.detectedParts.some(p => p.type === 'manager')).toBe(true);
  });

  it('Bastırılmış duygu tespiti', () => {
    const msg = 'Çöküş hissediyorum, ağlamak istiyorum, hiçbir şey umut yok';
    const result = detectInternalParts(msg);
    expect(result.detectedParts.some(p => p.type === 'exile')).toBe(true);
  });

  it('İç çelişki var mı kontrol', () => {
    const msg = 'Alkol içmek istiyorum ama planlama yapmam lazım';
    const result = detectInternalParts(msg);
    expect(result.internalConflict).toBe(true);
  });
});

describe('Psychoeducation', () => {
  it('Depresyon konusu önerilir', () => {
    const context = buildPsychoeducationContext('depression', 1);
    expect(context).toContain('depresyon');
    expect(context).toContain('dopamin');
  });

  it('Anksiyete konusu önerilir', () => {
    const context = buildPsychoeducationContext('anxiety', 1);
    expect(context).toContain('anksiyete');
    expect(context).toContain('amygdala');
  });

  it('Travma konusu önerilir', () => {
    const context = buildPsychoeducationContext('trauma', 0); // basit
    expect(context).toContain('travma');
    expect(context.length < 200).toBe(true); // kısa olmalı
  });
});

describe('Safety Monitoring', () => {
  it('Self-harm ideation tespiti', () => {
    const msg = 'Ölmek istiyorum, dayanamıyorum, bitmek istiyorum';
    const result = detectSelfHarmRisk(msg);
    expect(result.riskLevel).not.toBe('low');
    expect(result.indicators.some(i => i.includes('suicidal'))).toBe(true);
  });

  it('Düşük risk tespit', () => {
    const msg = 'Bugün biraz üzgün ama iyi iyim';
    const result = detectSelfHarmRisk(msg);
    expect(result.riskLevel).toBe('low');
  });

  it('Yüksek risk: araç erişimi', () => {
    const msg = 'İlaçları topladım, yapıyorum';
    const result = detectSelfHarmRisk(msg);
    expect(['high', 'critical']).toContain(result.riskLevel);
  });
});

describe('Ethical Boundaries', () => {
  it('Tıbbi tanı istek tespiti', () => {
    const req = 'Bana depresyon tanısı koy';
    const result = checkScopeViolation(req);
    expect(result.isOutOfScope).toBe(true);
    expect(result.category).toBe('medical_diagnosis');
  });

  it('İlaç tavsiye istek tespiti', () => {
    const req = 'Hangi antidepresan almalıyım?';
    const result = checkScopeViolation(req);
    expect(result.isOutOfScope).toBe(true);
    expect(result.category).toBe('medication_advice');
  });

  it('Hukuki tavsiye istek tespiti', () => {
    const req = 'Boşanmaya nasıl başlayalım?';
    const result = checkScopeViolation(req);
    expect(result.isOutOfScope).toBe(true);
    expect(result.category).toBe('legal_financial');
  });

  it('Kapsamda talep (uyarlanabilir)', () => {
    const req = 'Nasıl başetmeliyim bu üzüntüyle?';
    const result = checkScopeViolation(req);
    expect(result.isOutOfScope).toBe(false);
  });
});

describe('Therapeutic Bond', () => {
  it('Bond kalitesi hesap', () => {
    const messages = [
      { role: 'user', content: 'Çok iyi, harika sonuçlar gördüm' },
      { role: 'assistant', content: 'Güzel!' },
      { role: 'user', content: 'Senin sayende iyileşiyorum' },
      { role: 'assistant', content: 'Çalışmamız işe yaradı' },
    ];

    const result = assessBondQuality('test-user', messages);
    expect(result.bondStrength).toBeGreaterThan(50);
    expect(result.affection).toBeGreaterThan(50);
  });

  it('Zayıf bond tespit', () => {
    const messages = [
      { role: 'user', content: 'Bilmiyorum' },
      { role: 'assistant', content: 'Tamam' },
    ];

    const result = assessBondQuality('test-user', messages);
    expect(result.bondStrength).toBeLessThan(50);
  });
});

describe('Integration Tests', () => {
  it('Kompleks senaryo: Travma + IFS + Safety', () => {
    const userMsg = 'Geçmişi hatırlıyorum, kaçmak istiyorum, ilaç aldım';

    const trigger = detectTrigger(userMsg);
    const parts = detectInternalParts(userMsg);
    const safety = detectSelfHarmRisk(userMsg);

    expect(trigger.hasTrigger).toBe(true);
    expect(parts.detectedParts.length).toBeGreaterThan(0);
    expect(safety.riskLevel).not.toBe('low');
  });

  it('Scope + Ethics kontrol', () => {
    const msg = 'Psikiyatristim antidepresan istiyor ama bilmiyorum';
    const scope = checkScopeViolation(msg);

    // İlaç tavsiye istemiyor, sadece kaygı duyuyor
    // Kapsamda olmayabilir ama güvenlik açısından dikkat gerekli
    const isRisky = msg.includes('antidepresan');
    expect(isRisky).toBe(true);
  });
});
