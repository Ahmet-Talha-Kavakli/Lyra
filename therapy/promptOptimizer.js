// therapy/promptOptimizer.js
// Token Optimizasyon Motoru — dinamik prompt bloklarını öncelik, seans aşaması ve
// token bütçesine göre seçer ve birleştirir.
//
// Blok öncelik seviyeleri (düşük sayı = her zaman dahil):
//   P0 — kritik, hiçbir zaman çıkarılmaz (kriz, kimlik)
//   P1 — önemli, kesilebilir ama büyük kayıp
//   P2 — değerli, token bütçesi yeterliyse dahil
//   P3 — zenginleştirici, yalnızca bol bütçede dahil
//
// Seans aşaması:
//   early  (1-4 seans)  — minimal prompt, güven inşası
//   mid    (5-12 seans) — orta zenginlik
//   deep   (13+ seans)  — tam zenginlik

// ─── TOKEN TAHMİNİ ────────────────────────────────────────────────────────────

/**
 * Metin uzunluğundan yaklaşık token sayısı tahmin eder.
 * Türkçe için gerçekçi tahmin:
 *   - İngilizce: ~4 karakter/token
 *   - Türkçe: ~3 karakter/token (uzun kelimeler, ekler)
 *   - Sistem promptları büyük harf/sembol içerir → daha az token
 * %20 güvenlik tamponu eklenir — bütçe aşımını önlemek için.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
    if (!text) return 0;
    // Türkçe karakterler için 3.0, genel için 3.5 ortalaması
    const turkishChars = (text.match(/[çğıöşüÇĞİÖŞÜ]/g) || []).length;
    const turkishRatio = turkishChars / Math.max(text.length, 1);
    const charsPerToken = turkishRatio > 0.05 ? 3.0 : 3.5;
    const raw = Math.ceil(text.length / charsPerToken);
    // %20 güvenlik tamponu
    return Math.ceil(raw * 1.2);
}

// ─── SEANS AŞAMASI ───────────────────────────────────────────────────────────

/**
 * @param {number} sessionCount
 * @returns {'early'|'mid'|'deep'}
 */
export function getSessionPhase(sessionCount) {
    if (!sessionCount || sessionCount <= 4) return 'early';
    if (sessionCount <= 12) return 'mid';
    return 'deep';
}

// ─── BLOK TANIMLAMALARI ──────────────────────────────────────────────────────

// Her bloğun minimum seans aşaması ve önceliği
const BLOCK_CONFIG = {
    progress:           { priority: 1, minPhase: 'early'  },
    homework:           { priority: 1, minPhase: 'early'  },
    hypothesis:         { priority: 2, minPhase: 'mid'    },
    technique:          { priority: 2, minPhase: 'mid'    },
    sessionBridge:      { priority: 1, minPhase: 'early'  },
    sessionContext:     { priority: 2, minPhase: 'early'  },
    onboarding:         { priority: 0, minPhase: 'early'  }, // P0 — ilk seans kritik
    ruleEngine:         { priority: 1, minPhase: 'early'  },
    blindSpot:          { priority: 2, minPhase: 'mid'    },
    semanticMemory:     { priority: 2, minPhase: 'mid'    },
    voice:              { priority: 1, minPhase: 'early'  }, // ses verisi varsa her fazda dahil
    nesne:              { priority: 0, minPhase: 'early'  }, // P0 — güvenlik kritik, hiç kesilmez
    physicalHarm:       { priority: 0, minPhase: 'early'  }, // P0 — fiziksel zarar, hiç kesilmez
    voiceBaseline:      { priority: 2, minPhase: 'mid'    }, // P2 — kişisel norm, mid'den itibaren
    gazeBreath:         { priority: 1, minPhase: 'early'  }, // P1 — beden sinyalleri (nefes, gaze)
    windowOfTolerance:  { priority: 2, minPhase: 'mid'    }, // P2 — arousal tespiti, mid'den
    somaticMarkers:     { priority: 2, minPhase: 'mid'    }, // P2 — beden sinyalleri derinlik
    resistance:         { priority: 2, minPhase: 'early'  }, // P2 — savunma mekanizmaları
    transference:       { priority: 2, minPhase: 'mid'    }, // P2 — Lyra'ya duygusal yönelim
    sessionContinuity:  { priority: 1, minPhase: 'mid'    }, // P1 — seanslar arası bağlantı
    homeworkRecall:     { priority: 1, minPhase: 'mid'    }, // P1 — ödev hatırlaması
    bond:               { priority: 2, minPhase: 'early'  }, // P2 — uyum değerlendirmesi
    ruptureRepair:      { priority: 1, minPhase: 'early'  }, // P1 — kopuş onarma (var ise)
    cultural:           { priority: 2, minPhase: 'early'  }, // P2 — kültürel bağlam
    traumaSafety:       { priority: 1, minPhase: 'early'  }, // P1 — travma güvenliği
    grounding:          { priority: 0, minPhase: 'early'  }, // P0 — tetikleyici var ise hiç kesilmez
    safety:             { priority: 0, minPhase: 'early'  }, // P0 — acil güvenlik, hiç kesilmez
    ethical:            { priority: 1, minPhase: 'early'  }, // P1 — etik sınırlar
    emotionRegulation:  { priority: 2, minPhase: 'mid'    }, // P2 — DBT emotion regulation
    distressTolerance:  { priority: 1, minPhase: 'early'  }, // P1 — DBT crisis techniques
    mindfulness:        { priority: 2, minPhase: 'early'  }, // P2 — DBT mindfulness
    interpersonal:      { priority: 2, minPhase: 'mid'    }, // P2 — DBT interpersonal
    cbt:                { priority: 2, minPhase: 'mid'    }, // P2 — CBT (automatic thoughts, behavioral activation)
    schema:             { priority: 2, minPhase: 'deep'   }, // P2 — Schema Therapy (core life patterns)
    somatic:            { priority: 1, minPhase: 'early'  }, // P1 — Somatic Experiencing (trauma + body)
    ifs:                { priority: 2, minPhase: 'mid'    }, // P2 — Internal Family Systems (inner parts)
    turkishCultural:    { priority: 2, minPhase: 'early'  }, // P2 — Turkish cultural safety
    metacognition:      { priority: 2, minPhase: 'mid'    }, // P2 — Metacognition (düşünce hakkında düşünme)
    executiveFunction:  { priority: 2, minPhase: 'early'  }, // P2 — Executive Function (ADHD, odaklanma, planlama)
    cognitiveFlexibility: { priority: 2, minPhase: 'mid'  }, // P2 — Cognitive Flexibility (katı düşüncelerden çıkış)
    movement:           { priority: 2, minPhase: 'early'  }, // P2 — Movement Therapy (hareket ve ruh sağlığı)
    sleep:              { priority: 2, minPhase: 'early'  }, // P2 — Sleep Hygiene (uyku kalitesi)
    habitTracking:      { priority: 2, minPhase: 'mid'    }, // P2 — Habit Tracking (alışkanlık değiştirme)
    values:             { priority: 2, minPhase: 'mid'    }, // P2 — Values Clarification (yaşam değerleri)
    meaning:            { priority: 2, minPhase: 'mid'    }, // P2 — Meaning and Purpose (yaşam amacı)
    resilience:         { priority: 2, minPhase: 'mid'    }, // P2 — Resilience Building (dayanıklılık)
    advancedCrisis:     { priority: 0, minPhase: 'early'  }, // P0 — Advanced crisis assessment (suicidal severity)
    standardizedAssessments: { priority: 1, minPhase: 'early' }, // P1 — PHQ-9, GAD-7, PCL-5, AUDIT (klinik ölçümler)
    progressDashboard:  { priority: 1, minPhase: 'mid'    }, // P1 — Progress Dashboard (ilerleme gösterge paneli)
    familyDynamics:     { priority: 2, minPhase: 'mid'    }, // P2 — Family Dynamics (aile sistemleri, Bowen)
    relationshipTherapy: { priority: 2, minPhase: 'mid'   }, // P2 — Relationship Therapy (çift terapisi, Gottman)
    religionSpirituality: { priority: 2, minPhase: 'early' }, // P2 — Religion & Spirituality (din, maneviyat)
    lgbtqInclusion:     { priority: 1, minPhase: 'early'  }, // P1 — LGBTQ+ Inclusion (affirming terapi, coming out)
    immigrantExperience: { priority: 2, minPhase: 'early'  }, // P2 — Immigrant Experience (kültür şoku, göçmen)
    exposureTherapy:    { priority: 2, minPhase: 'mid'    }, // P2 — Exposure Therapy (maruz kalma, fobiler, SUDS)
    positivePsychology: { priority: 2, minPhase: 'mid'    }, // P2 — Positive Psychology (PERMA, güçler, minnet)
    disclaimer:         { priority: 1, minPhase: 'early'  },
};

const PHASE_ORDER = { early: 0, mid: 1, deep: 2 };

/**
 * Bloğun bu seans aşamasında dahil edilmeli mi?
 * @param {string} blockName
 * @param {'early'|'mid'|'deep'} phase
 * @returns {boolean}
 */
function isBlockEligible(blockName, phase) {
    const config = BLOCK_CONFIG[blockName];
    if (!config) return true; // bilinmeyen blok → dahil et
    return PHASE_ORDER[phase] >= PHASE_ORDER[config.minPhase];
}

// ─── OPTİMİZASYON MOTORU ─────────────────────────────────────────────────────

/**
 * Prompt bloklarını token bütçesine ve seans aşamasına göre seçip birleştirir.
 *
 * @param {string} basePrompt — temel sistem promptu (profil + mod + sinyal)
 * @param {Object} blocks — anahtar: blok adı, değer: metin (boş olabilir)
 *   {
 *     progress, homework, hypothesis, technique, sessionBridge,
 *     sessionContext, onboarding, ruleEngine, blindSpot, semanticMemory, disclaimer
 *   }
 * @param {Object} opts
 * @param {number} opts.sessionCount — kullanıcı kaçıncı seansta
 * @param {number} opts.tokenBudget — toplam izin verilen token (default: 2200)
 * @param {boolean} opts.isCrisis — kriz modunda tüm opsiyonel bloklar kesilir
 * @returns {{ prompt: string, stats: Object }}
 */
export function optimizePrompt(basePrompt, blocks, opts = {}) {
    const {
        sessionCount = 0,
        tokenBudget = 2200,
        isCrisis = false,
    } = opts;

    const phase = getSessionPhase(sessionCount);

    // Kriz modunda sadece base prompt — sade, odaklı, hızlı
    if (isCrisis) {
        return {
            prompt: basePrompt,
            stats: { phase, tokensUsed: estimateTokens(basePrompt), blocksIncluded: [], blocksDropped: Object.keys(blocks) },
        };
    }

    let usedTokens = estimateTokens(basePrompt);
    const included = [];
    const dropped = [];

    // Blokları önceliğe göre sırala (P0 → P3)
    const sortedBlocks = Object.entries(blocks)
        .filter(([, text]) => !!text) // boş blokları filtrele
        .sort(([nameA], [nameB]) => {
            const pa = BLOCK_CONFIG[nameA]?.priority ?? 3;
            const pb = BLOCK_CONFIG[nameB]?.priority ?? 3;
            return pa - pb;
        });

    let result = basePrompt;

    for (const [name, text] of sortedBlocks) {
        // Seans aşaması kontrolü
        if (!isBlockEligible(name, phase)) {
            dropped.push(`${name}(phase)`);
            continue;
        }

        const blockTokens = estimateTokens(text);

        // Token bütçesi kontrolü
        if (usedTokens + blockTokens > tokenBudget) {
            // P0 ve P1 blokları bütçeyi aşsa da dahil et — kritik bilgi
            const priority = BLOCK_CONFIG[name]?.priority ?? 3;
            if (priority >= 2) {
                dropped.push(`${name}(budget)`);
                continue;
            }
        }

        result += text;
        usedTokens += blockTokens;
        included.push(name);
    }

    return {
        prompt: result,
        stats: {
            phase,
            tokensUsed: usedTokens,
            blocksIncluded: included,
            blocksDropped: dropped,
        },
    };
}
