#!/usr/bin/env node
// test/simulate.js
// Lyra konuşma simülatörü — Vapi/tarayıcı olmadan terminal üzerinden test
//
// Kullanım:
//   node test/simulate.js           → tam mod (OpenAI ile gerçek yanıt)
//   node test/simulate.js --debug   → sadece karar zinciri, OpenAI çağrısı yok

import readline from 'readline';
import dotenv from 'dotenv';
import OpenAI from 'openai';

import { decideConversationSignal, analyzeConversationRhythm, getLastLyraAction } from '../therapy/conversationSignal.js';
import { detectScenario } from '../therapy/deepScenarios.js';
import { runTherapyEngine } from '../therapy/therapyEngine.js';
import { buildSystemPrompt } from '../therapy/promptBuilder.js';
import { extractTopicsQuick } from '../therapy/topicExtractor.js';

dotenv.config();

const DEBUG_ONLY = process.argv.includes('--debug');
const openai = DEBUG_ONLY ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Basit duygu tespiti (server.js'deki ile aynı mantık) ────────────────────
const EMOTION_MAP = {
    üzüntü:      { keywords: ['üzgün', 'üzüldüm', 'ağladım', 'keder', 'mutsuz', 'acı', 'kırık'], phrases: ['çok üzgünüm', 'ağlıyorum'] },
    kaygı:       { keywords: ['kaygı', 'endişe', 'korku', 'panik', 'stres', 'gergin'], phrases: ['panik atak', 'nefes alamıyorum'] },
    öfke:        { keywords: ['sinirli', 'kızgın', 'öfkeli', 'bezdim', 'bıktım', 'nefret'], phrases: ['çok sinirleniyorum', 'nefret ediyorum'] },
    utanç:       { keywords: ['utanç', 'utandım', 'mahcup', 'değersiz'], phrases: ['çok utandım', 'yerin dibine geçtim'] },
    yalnızlık:   { keywords: ['yalnız', 'izole', 'terk', 'kimsesiz'], phrases: ['kimse anlamıyor', 'yapayalnızım'] },
    tükenmişlik: { keywords: ['tükendim', 'yoruldum', 'bitik', 'motivasyonsuz'], phrases: ['artık devam edemiyorum', 'içim boş'] },
    umut:        { keywords: ['iyi', 'güzel', 'mutlu', 'umutlu', 'rahatladım'], phrases: ['daha iyi hissediyorum'] },
    karmaşa:     { keywords: ['karmaşık', 'karışık', 'anlamıyorum'], phrases: ['ne hissettiğimi bilmiyorum'] },
};

function detectEmotion(text) {
    if (!text) return { primary: 'sakin', secondary: null, intensity: 'düşük' };
    const lower = text.toLowerCase();
    const scores = {};
    for (const [emotion, data] of Object.entries(EMOTION_MAP)) {
        let score = 0;
        for (const p of data.phrases) if (lower.includes(p)) score += 2.5;
        for (const k of data.keywords) if (lower.includes(k)) score += 1.0;
        if (score > 0) scores[emotion] = score;
    }
    if (Object.keys(scores).length === 0) return { primary: 'sakin', secondary: null, intensity: 'düşük' };
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top = sorted[0][1];
    return {
        primary: sorted[0][0],
        secondary: sorted[1]?.[0] || null,
        intensity: top >= 4 ? 'yüksek' : top >= 2 ? 'orta' : 'düşük',
    };
}

// ─── Renk yardımcıları ───────────────────────────────────────────────────────
const c = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    dim:    '\x1b[2m',
    cyan:   '\x1b[36m',
    yellow: '\x1b[33m',
    green:  '\x1b[32m',
    red:    '\x1b[31m',
    magenta:'\x1b[35m',
    blue:   '\x1b[34m',
};

function header(text) { console.log(`\n${c.bold}${c.cyan}━━━ ${text} ━━━${c.reset}`); }
function row(label, value) { console.log(`  ${c.dim}${label.padEnd(14)}${c.reset}${c.bold}${value}${c.reset}`); }
function lyraLine(text) { console.log(`\n${c.green}${c.bold}Lyra:${c.reset} ${text}\n`); }
function divider() { console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`); }

// ─── Konuşma durumu ──────────────────────────────────────────────────────────
const messages = [];          // { role, content }
const mockProfile = {
    session_count: 0,
    attachment_style: 'belirsiz',
    triggers: [],
    life_schemas: [],
    unconscious_patterns: [],
    defense_mechanisms: [],
    strengths: [],
    healing_style: null,
    language_style: null,
    hope_map: null,
    relationship_map: [],
};

async function processMessage(userText) {
    messages.push({ role: 'user', content: userText });

    // 1. Duygu
    const emotionResult = detectEmotion(userText);

    // 2. Konular
    const allText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    const topics = extractTopicsQuick(allText);

    // 3. Ritim & Sinyal
    const rhythmState = analyzeConversationRhythm(messages);
    const lastLyraAction = getLastLyraAction(messages);
    const userMsgCount = messages.filter(m => m.role === 'user').length;

    const signal = decideConversationSignal({
        emotionResult,
        messageLength: userText.length,
        messageCount: userMsgCount,
        lastLyraAction,
        dominantTopics: topics,
        rhythmState,
        messageContent: userText,
    });

    // 4. Senaryo
    const scenario = detectScenario(messages, emotionResult.primary, topics);

    // 5. Terapi motoru
    const engineOutput = runTherapyEngine({
        currentEmotion: emotionResult.primary,
        emotionIntensity: emotionResult.intensity,
        messageContent: userText,
        sessionHistory: messages,
        profile: mockProfile,
        topics,
        effectivenessData: [],
    });

    // 6. Sistem promptu
    const systemPrompt = buildSystemPrompt(
        mockProfile, engineOutput, emotionResult.primary,
        signal, rhythmState, emotionResult, scenario
    );

    // ── Debug paneli ────────────────────────────────────────────────────────
    header('KARAR ZİNCİRİ');
    row('Duygu',    `${emotionResult.primary} (${emotionResult.intensity})`);
    row('İkincil',  emotionResult.secondary || '—');
    row('Sinyal',   signal);
    row('Senaryo',  scenario || '—');
    row('Mod',      engineOutput.mode.name);
    row('Teknikler',engineOutput.techniques.map(t => t.id).join(', ') || '—');
    row('Konular',  topics.join(', ') || '—');
    row('Ritim',    `${rhythmState.writerType} / ${rhythmState.trend}`);
    divider();

    if (DEBUG_ONLY) {
        console.log(`\n${c.dim}[--debug modu: OpenAI çağrısı yok]${c.reset}\n`);
        return;
    }

    // 7. OpenAI çağrısı
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages,
            ],
            temperature: 0.85,
            max_tokens: 300,
        });

        const raw = response.choices[0].message.content || '';
        // [DUYGU:X] tagini temizle
        const clean = raw.replace(/^\s*\[DUYGU:[^\]]+\]\s*/i, '').trim();
        messages.push({ role: 'assistant', content: clean });
        lyraLine(clean);
    } catch (err) {
        console.error(`${c.red}OpenAI hatası: ${err.message}${c.reset}`);
    }
}

// ─── Ana döngü ───────────────────────────────────────────────────────────────
console.log(`\n${c.bold}${c.magenta}╔══════════════════════════════════════╗`);
console.log(`║     LYRA KOnUŞMA SİMÜLATÖRÜ         ║`);
console.log(`╚══════════════════════════════════════╝${c.reset}`);
console.log(`${c.dim}Çıkmak için: Ctrl+C  |  Mod: ${DEBUG_ONLY ? '--debug (OpenAI yok)' : 'tam'}${c.reset}\n`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask() {
    if (rl.closed) return;
    rl.question(`${c.blue}${c.bold}Sen:${c.reset} `, async (input) => {
        const text = input.trim();
        if (!text) { ask(); return; }
        await processMessage(text);
        ask();
    });
}

rl.on('close', () => process.exit(0));
ask();