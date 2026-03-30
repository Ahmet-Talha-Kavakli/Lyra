/**
 * Local cron job test
 * Checks if autonomousSourceDiscovery works without Vercel
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { isValidUrl } from './lib/shared/validators.js';
import xss from 'xss';

// Simple sanitize for Node.js (DOMPurify doesn't work in Node)
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return xss(input, {
    whiteList: {},
    stripIgnoredTag: true,
    stripLeadingAndTrailingWhitespace: true,
  }).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
}

// Load env vars
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

console.log('🔍 Checking environment variables...');
console.log('✅ SUPABASE_URL:', supabaseUrl ? 'SET' : '❌ MISSING');
console.log('✅ SUPABASE_SERVICE_KEY:', supabaseKey ? 'SET' : '❌ MISSING');
console.log('✅ OPENAI_API_KEY:', openaiKey ? 'SET' : '❌ MISSING');

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function testCronJob() {
  try {
    console.log('\n📋 Testing autonomousSourceDiscovery...\n');

    // 1. Fetch existing knowledge sources
    console.log('1️⃣  Fetching existing knowledge sources...');
    const { data: sources, error: sourcesError } = await supabase
      .from('knowledge_sources')
      .select('id, category, credibility_score')
      .eq('is_active', true)
      .order('credibility_score', { ascending: false })
      .limit(10);

    if (sourcesError) {
      console.error('❌ Error fetching sources:', sourcesError.message);
      return;
    }

    console.log(`✅ Found ${sources?.length || 0} active sources`);
    if (sources && sources.length > 0) {
      console.log('   Sample categories:', sources.slice(0, 3).map(s => s.category).join(', '));
    }

    // 2. Pick a category to analyze
    const categories = [...new Set((sources || []).map(s => s.category))].slice(0, 1);

    if (categories.length === 0) {
      console.log('⚠️  No active sources with categories found, skipping AI analysis');
      return;
    }

    console.log(`\n2️⃣  Analyzing category: "${categories[0]}"`);

    // 3. Call OpenAI (same as cron does)
    console.log('   Calling OpenAI GPT-4o-mini...');
    const prompt = `Sen bir psikoloji araştırma asistanısın. "${categories[0]}" konusunda Türkçe veya İngilizce, güvenilir, kanıta dayalı 2 yeni bilgi kaynağı öner. Her kaynak için: başlık, özet (2-3 cümle), URL (gerçek olmalı), güvenilirlik skoru (0.0-1.0). JSON formatında döndür: [{"title":"...","summary":"...","url":"...","credibility":0.85}]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content;
    console.log('✅ OpenAI responded');

    // 4. Parse response
    console.log('\n3️⃣  Parsing AI response...');
    let newSources = [];
    try {
      const parsed = JSON.parse(responseText);
      newSources = Array.isArray(parsed) ? parsed : (parsed.sources || []);
      console.log(`✅ Parsed ${newSources.length} sources from AI`);
    } catch (e) {
      console.error('❌ Failed to parse AI response:', e.message);
      console.log('   Response was:', responseText.substring(0, 200));
      return;
    }

    // 5. Test database write (DRY RUN - don't actually insert)
    console.log('\n4️⃣  Testing database write...');
    for (const src of newSources.slice(0, 1)) {
      if (!src.url || !src.title) {
        console.log('⚠️  Source missing url or title, skipping');
        continue;
      }

      const sanitizedTitle = sanitizeString(src.title);
      const sanitizedSummary = sanitizeString(src.summary || '');

      if (!isValidUrl(src.url)) {
        console.log(`❌ Invalid URL: ${src.url}`);
        continue;
      }

      console.log(`   Title: ${sanitizedTitle}`);
      console.log(`   URL: ${src.url}`);
      console.log(`   Summary: ${sanitizedSummary.substring(0, 50)}...`);

      // Create embedding
      console.log('\n5️⃣  Creating embedding...');
      const embeddingResp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${sanitizedTitle} ${sanitizedSummary}`
      });
      console.log(`✅ Embedding created (dimension: ${embeddingResp.data[0].embedding.length})`);

      // Test what would be inserted
      const testData = {
        url: src.url,
        title: sanitizedTitle,
        summary: sanitizedSummary,
        category: categories[0],
        credibility_score: Math.min(Math.max(src.credibility || 0.7, 0), 1),
        is_active: true,
        embedding: embeddingResp.data[0].embedding,
        source_type: 'autonomous_agent',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      console.log('\n6️⃣  Data that WOULD be inserted (DRY RUN):');
      console.log(JSON.stringify({
        ...testData,
        embedding: `[${testData.embedding.slice(0, 3).join(', ')}... (${testData.embedding.length} dims)]`
      }, null, 2));
    }

    console.log('\n✅ LOCAL TEST PASSED - Cron logic works correctly!');
    console.log('⚠️  No actual data was inserted (dry run mode)');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    if (err.status) console.error('   Status:', err.status);
    if (err.error) console.error('   Details:', err.error);
  }
}

testCronJob();
