// lib/cronJobs.js — Otonom Learning Agent fonksiyonları
import { supabase } from './supabase.js';
import { openai } from './openai.js';

export async function autonomousSourceDiscovery() {
    try {
        console.log('[AGENT] Günlük kaynak keşfi başladı (02:00)');

        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id, topic_category, quality_score')
            .eq('is_active', true)
            .order('quality_score', { ascending: false })
            .limit(10);

        if (!sources || sources.length === 0) {
            console.log('[AGENT] Kaynak bulunamadı');
            return;
        }

        const categories = [...new Set(sources.map(s => s.topic_category))];

        for (const category of categories.slice(0, 3)) {
            try {
                const prompt = `Sen bir psikoloji araştırma asistanısın. "${category}" konusunda Türkçe veya İngilizce, güvenilir, kanıta dayalı 3 yeni bilgi kaynağı öner. Her kaynak için: başlık, özet (2-3 cümle), URL (gerçek olmalı), güvenilirlik skoru (0.0-1.0). JSON formatında döndür: [{"title":"...","summary":"...","url":"...","credibility":0.85}]`;

                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 1000,
                    response_format: { type: 'json_object' }
                });

                let newSources = [];
                try {
                    const parsed = JSON.parse(response.choices[0].message.content);
                    newSources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
                } catch { continue; }

                for (const src of newSources.slice(0, 2)) {
                    if (!src.url || !src.title) continue;

                    const embeddingResp = await openai.embeddings.create({
                        model: 'text-embedding-3-small',
                        input: `${src.title} ${src.summary}`
                    });

                    await supabase.from('knowledge_sources').upsert({
                        url: src.url,
                        title: src.title,
                        summary: src.summary,
                        topic_category: category,
                        credibility_score: src.credibility || 0.7,
                        quality_score: 0.5,
                        is_active: true,
                        embedding: embeddingResp.data[0].embedding,
                        discovered_by: 'autonomous_agent',
                        created_at: new Date().toISOString()
                    }, { onConflict: 'url', ignoreDuplicates: true });
                }

                console.log(`[AGENT] ${category} için ${newSources.length} kaynak eklendi`);
            } catch (categoryErr) {
                console.error(`[AGENT] ${category} hatası:`, categoryErr.message);
            }
        }

        console.log('[AGENT] Günlük kaynak keşfi tamamlandı');
    } catch (err) {
        console.error('[AGENT] Kaynak keşfi hatası:', err.message);
    }
}

export async function assessKnowledgeQuality() {
    try {
        console.log('[AGENT] Haftalık kalite kontrolü başladı');

        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id, title, summary, usage_count, avg_rating')
            .eq('is_active', true)
            .order('usage_count', { ascending: false })
            .limit(20);

        if (!sources) return;

        for (const src of sources) {
            const qualityScore = Math.min(
                ((src.avg_rating || 0.5) * 0.6) +
                (Math.min((src.usage_count || 0) / 10, 1) * 0.4),
                1.0
            );

            await supabase.from('knowledge_sources')
                .update({ quality_score: qualityScore })
                .eq('id', src.id);
        }

        console.log(`[AGENT] ${sources.length} kaynak kalitesi güncellendi`);
    } catch (err) {
        console.error('[AGENT] Kalite kontrolü hatası:', err.message);
    }
}

export async function detectKnowledgeGaps() {
    try {
        console.log('[AGENT] Bilgi boşluğu tespiti başladı');

        const { data: logs } = await supabase
            .from('knowledge_usage_logs')
            .select('query_topic, found_relevant')
            .eq('found_relevant', false)
            .order('created_at', { ascending: false })
            .limit(50);

        if (!logs || logs.length === 0) {
            console.log('[AGENT] Boşluk tespit edilmedi');
            return;
        }

        const topicCounts = {};
        for (const log of logs) {
            if (log.query_topic) {
                topicCounts[log.query_topic] = (topicCounts[log.query_topic] || 0) + 1;
            }
        }

        const gapTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);

        console.log('[AGENT] Tespit edilen boşluklar:', gapTopics);

        for (const topic of gapTopics.slice(0, 2)) {
            try {
                const prompt = `Psikoloji ve terapi alanında "${topic}" konusunda kanıta dayalı 2 Türkçe kaynak öner. JSON: [{"title":"...","summary":"...","url":"...","credibility":0.8}]`;

                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 600,
                    response_format: { type: 'json_object' }
                });

                let newSources = [];
                try {
                    const parsed = JSON.parse(response.choices[0].message.content);
                    newSources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
                } catch { continue; }

                for (const src of newSources.slice(0, 1)) {
                    if (!src.url || !src.title) continue;
                    const embResp = await openai.embeddings.create({
                        model: 'text-embedding-3-small',
                        input: `${src.title} ${src.summary}`
                    });

                    await supabase.from('knowledge_sources').upsert({
                        url: src.url,
                        title: src.title,
                        summary: src.summary,
                        topic_category: topic,
                        credibility_score: src.credibility || 0.75,
                        quality_score: 0.5,
                        is_active: true,
                        embedding: embResp.data[0].embedding,
                        discovered_by: 'gap_detector',
                        created_at: new Date().toISOString()
                    }, { onConflict: 'url', ignoreDuplicates: true });
                }
            } catch (e) {
                console.error(`[AGENT] Gap fill hatası (${topic}):`, e.message);
            }
        }

        console.log('[AGENT] Bilgi boşluğu tespiti tamamlandı');
    } catch (err) {
        console.error('[AGENT] Boşluk tespiti hatası:', err.message);
    }
}

export async function verifySourceCredibility() {
    try {
        console.log('[AGENT] Aylık güvenilirlik doğrulaması başladı');

        const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id, title, summary, credibility_score')
            .eq('is_active', true)
            .lt('credibility_score', 0.5)
            .limit(10);

        if (!sources || sources.length === 0) {
            console.log('[AGENT] Doğrulanacak düşük güvenilirlikli kaynak yok');
            return;
        }

        for (const src of sources) {
            try {
                const prompt = `Aşağıdaki psikoloji kaynağının güvenilirliğini değerlendir (0.0-1.0):\nBaşlık: ${src.title}\nÖzet: ${src.summary}\n\nJSON: {"credibility": 0.75, "reason": "kısa açıklama"}`;

                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 200,
                    response_format: { type: 'json_object' }
                });

                const result = JSON.parse(response.choices[0].message.content);
                const newScore = result.credibility || src.credibility_score;

                if (newScore < 0.3) {
                    await supabase.from('knowledge_sources')
                        .update({ is_active: false })
                        .eq('id', src.id);
                    console.log(`[AGENT] Kaynak devre dışı: ${src.title}`);
                } else {
                    await supabase.from('knowledge_sources')
                        .update({ credibility_score: newScore })
                        .eq('id', src.id);
                }
            } catch (e) {
                console.error(`[AGENT] Kaynak doğrulama hatası (${src.id}):`, e.message);
            }
        }

        console.log('[AGENT] Güvenilirlik doğrulaması tamamlandı');
    } catch (err) {
        console.error('[AGENT] Güvenilirlik doğrulaması hatası:', err.message);
    }
}
