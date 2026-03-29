// routes/character.js
import express from 'express';
import { supabase } from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireOwnership } from '../lib/helpers.js';

const router = express.Router();

// Karakter kütüphanesi — profil trait'lerine göre seçim yapılır
const CHARACTER_LIBRARY = [
    { id: 'lyra_warm_f_30',    warmth: 0.90, formality: 0.25, energy: 0.65 },
    { id: 'lyra_warm_f_40',    warmth: 0.85, formality: 0.35, energy: 0.55 },
    { id: 'lyra_warm_f_50',    warmth: 0.80, formality: 0.45, energy: 0.45 },
    { id: 'lyra_neutral_f_30', warmth: 0.60, formality: 0.55, energy: 0.60 },
    { id: 'lyra_neutral_f_40', warmth: 0.55, formality: 0.65, energy: 0.50 },
    { id: 'lyra_calm_f_35',    warmth: 0.70, formality: 0.40, energy: 0.35 },
    { id: 'lyra_warm_m_30',    warmth: 0.85, formality: 0.30, energy: 0.70 },
    { id: 'lyra_warm_m_40',    warmth: 0.80, formality: 0.40, energy: 0.60 },
    { id: 'lyra_neutral_m_35', warmth: 0.55, formality: 0.60, energy: 0.55 },
    { id: 'lyra_calm_m_45',    warmth: 0.65, formality: 0.50, energy: 0.30 },
];

function selectCharacterForProfile(profile) {
    const attachmentWarmth = { 'güvenli': 0.9, 'kaçınan': 0.5, 'kaygılı': 0.7 };
    const languageFormality = { 'resmi': 0.8, 'samimi': 0.2, 'nötr': 0.5 };
    const healingEnergy = { 'aktif': 0.8, 'yavaş': 0.3, 'dengeli': 0.55 };

    const warmth    = attachmentWarmth[profile.attachment_style]  ?? 0.65;
    const formality = languageFormality[profile.language_style]   ?? 0.45;
    const energy    = healingEnergy[profile.healing_style]        ?? 0.55;

    let best = CHARACTER_LIBRARY[0];
    let minDist = Infinity;
    for (const char of CHARACTER_LIBRARY) {
        const dist = Math.sqrt(
            Math.pow(char.warmth - warmth, 2) +
            Math.pow(char.formality - formality, 2) +
            Math.pow(char.energy - energy, 2)
        );
        if (dist < minDist) { minDist = dist; best = char; }
    }
    return best.id;
}

// GET /character?userId=xxx — kullanıcının karakter durumunu döner
router.get('/v1/character', authMiddleware, async (req, res) => {
    const { userId } = req.query;
    if (!requireOwnership(userId, req, res)) return;

    try {
        const { data, error } = await supabase
            .from('character_states')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.json({
                character_id: 'lyra_mascot',
                character_version: 1,
                clothing_variant: 'casual_warm',
                animation_style: 'balanced',
                is_transitioning: false,
                is_mascot: true,
            });
        }

        res.json(data);
    } catch (err) {
        console.error('[/character GET] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /character/assign — ilk seans sonrası karakter ata
router.post('/v1/character/assign', authMiddleware, async (req, res) => {
    const { userId } = req.body;
    if (!requireOwnership(userId, req, res)) return;

    try {
        const { data: profile } = await supabase
            .from('psychological_profiles')
            .select('attachment_style, language_style, healing_style')
            .eq('user_id', userId)
            .maybeSingle();

        const characterId = profile
            ? selectCharacterForProfile(profile)
            : 'lyra_warm_f_35';

        const { data, error } = await supabase
            .from('character_states')
            .upsert({
                user_id: userId,
                character_id: characterId,
                character_version: 1,
                clothing_variant: 'casual_warm',
                animation_style: 'balanced',
                is_transitioning: false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, character_id: characterId, data });
    } catch (err) {
        console.error('[/character/assign] Hata:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;
