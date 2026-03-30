/**
 * Psychology Module Executor Engine
 *
 * Dynamically loads and executes psychology modules
 * Converts module data into actionable therapeutic interventions
 */

import { logger } from '../../../lib/infrastructure/logger.js';

// Module registry — maps module names to their implementations
const MODULE_REGISTRY = {
  dbtEmotionRegulation: () => import('../../lib/domain/dbtEmotionRegulation.js'),
  cbtCognitiveBehavioral: () => import('../../lib/domain/cbtCognitiveBehavioral.js'),
  traumaInformed: () => import('../../lib/domain/traumaInformed.js'),
  therapeuticBond: () => import('../../lib/domain/therapeuticBond.js'),
  resilienceBuilding: () => import('../../lib/domain/resilienceBuilding.js'),
  positivePsychology: () => import('../../lib/domain/positivePsychology.js'),
  executiveFunction: () => import('../../lib/domain/executiveFunction.js'),
  metacognition: () => import('../../lib/domain/metacognition.js'),
};

/**
 * Execute selected psychology modules
 * Analyzes user state and returns module-specific recommendations
 *
 * @param {Array<string>} moduleNames - Selected module names
 * @param {Array} messages - Chat messages for context
 * @param {Object} userState - User's emotional/cognitive state
 * @returns {Promise<Object>} Module execution results
 */
export async function executeModules(moduleNames, messages, userState = {}) {
  const results = {};
  const conversationText = messages
    .map(m => m.content?.toLowerCase() || '')
    .join(' ');

  for (const moduleName of moduleNames) {
    try {
      const moduleLoader = MODULE_REGISTRY[moduleName];

      if (!moduleLoader) {
        logger.warn(`[ModuleExecutor] Unknown module: ${moduleName}`);
        continue;
      }

      const moduleData = await moduleLoader();

      // Execute module analysis
      const analysis = analyzeWithModule(moduleName, moduleData, conversationText, userState);

      results[moduleName] = {
        status: 'executed',
        analysis,
        timestamp: new Date().toISOString(),
      };

      logger.info(`[ModuleExecutor] Module executed: ${moduleName}`, {
        insights: Object.keys(analysis).length,
      });
    } catch (error) {
      logger.error(`[ModuleExecutor] Module execution failed: ${moduleName}`, {
        error: error.message,
      });
      results[moduleName] = {
        status: 'failed',
        error: error.message,
      };
    }
  }

  return results;
}

/**
 * Analyze conversation using specific module
 * @private
 */
function analyzeWithModule(moduleName, moduleData, conversationText, userState) {
  const analysis = {
    moduleName,
    insights: [],
    recommendations: [],
    techniques: [],
  };

  // Module-specific analysis logic
  switch (moduleName) {
    case 'dbtEmotionRegulation':
      analysis.insights = analyzeDbtState(conversationText);
      analysis.techniques = extractDbtTechniques(moduleData, conversationText);
      analysis.recommendations = generateDbtRecommendations(analysis.techniques, userState);
      break;

    case 'cbtCognitiveBehavioral':
      analysis.insights = analyzeCbtThoughts(conversationText);
      analysis.techniques = extractCbtTechniques(moduleData, conversationText);
      analysis.recommendations = generateCbtRecommendations(analysis.techniques);
      break;

    case 'traumaInformed':
      analysis.insights = analyzeTraumaIndicators(conversationText);
      analysis.techniques = extractTraumaTechniques(moduleData, conversationText);
      analysis.recommendations = generateTraumaRecommendations(analysis.techniques);
      break;

    case 'therapeuticBond':
      analysis.insights = analyzeBondState(conversationText);
      analysis.techniques = extractBondTechniques(moduleData);
      analysis.recommendations = generateBondRecommendations(analysis.insights);
      break;

    case 'resilienceBuilding':
      analysis.insights = analyzeResilienceFactors(conversationText);
      analysis.techniques = extractResilienceTechniques(moduleData, conversationText);
      analysis.recommendations = generateResilienceRecommendations(analysis.techniques);
      break;

    case 'positivePsychology':
      analysis.insights = analyzeStrengths(conversationText);
      analysis.techniques = extractPositiveTechniques(moduleData);
      analysis.recommendations = generatePositiveRecommendations(analysis.insights);
      break;

    case 'executiveFunction':
      analysis.insights = analyzeTaskManagement(conversationText);
      analysis.techniques = extractExecFuncTechniques(moduleData, conversationText);
      analysis.recommendations = generateExecFuncRecommendations(analysis.techniques);
      break;

    case 'metacognition':
      analysis.insights = analyzeMetacognitivePatterns(conversationText);
      analysis.techniques = extractMetacognitiveTechniques(moduleData);
      analysis.recommendations = generateMetacognitiveRecommendations(analysis.insights);
      break;

    default:
      analysis.insights = ['Module type unknown'];
  }

  return analysis;
}

// ─── DBT-Specific Analysis Functions ───────────────────────────────────────

function analyzeDbtState(text) {
  const insights = [];

  if (/öfke|kızgın|sinirli/.test(text)) {
    insights.push('Emotion dysregulation detected: Anger/irritability');
  }
  if (/üzgün|mutsuz|hüzün|depresyon/.test(text)) {
    insights.push('Emotion dysregulation detected: Sadness/depression');
  }
  if (/panik|korku|anksiyete|endişe/.test(text)) {
    insights.push('Emotion dysregulation detected: Anxiety/fear');
  }
  if (/kendimi|intihar|ölmek|bitir/.test(text)) {
    insights.push('⚠️ CRISIS: Suicidal ideation detected - immediate intervention needed');
  }

  return insights;
}

function extractDbtTechniques(moduleData, text) {
  const techniques = [];

  // TIPP skills for immediate crisis
  if (/öfke|panik|kontrol|hemen|acil/.test(text)) {
    techniques.push({
      name: 'TIPP Skills (Immediate)',
      techniques: [
        'Temperature: Ice cube or cold water to face (parasympathetic activation)',
        'Intense exercise: 20 push-ups or run in place (discharge energy)',
        'Paced breathing: 5 sec inhale, 5 sec hold, 5 sec exhale',
        'Paired muscle relaxation: Tense and release muscle groups',
      ],
    });
  }

  // ABC PLEASE for baseline stability
  if (/uyku|yemek|egzersiz|beslen/.test(text)) {
    techniques.push({
      name: 'ABC PLEASE (Foundational)',
      description: 'Build emotional resilience through lifestyle',
    });
  }

  return techniques;
}

function generateDbtRecommendations(techniques, userState) {
  if (techniques.length === 0) return [];

  return [
    `Use ${techniques[0]?.name} immediately to regulate emotions`,
    'Follow with mindfulness or grounding after acute crisis passes',
    'Build ABC PLEASE routine for long-term stability',
  ];
}

// ─── CBT-Specific Analysis Functions ──────────────────────────────────────

function analyzeCbtThoughts(text) {
  const insights = [];

  if (/her zaman|asla|hiçbir zaman|yapamayacak/.test(text)) {
    insights.push('Cognitive distortion detected: All-or-nothing thinking');
  }
  if (/kesinlikle|mutlaka|başarısız|yeterli değil/.test(text)) {
    insights.push('Cognitive distortion detected: Catastrophizing');
  }
  if (/hepsi benim suçum|ben sorumlu|ben hatalı/.test(text)) {
    insights.push('Cognitive distortion detected: Personalization/blame');
  }

  return insights;
}

function extractCbtTechniques(moduleData, text) {
  return [
    {
      name: 'Thought Record',
      description: 'Identify → Evaluate → Challenge automatic thoughts',
    },
    {
      name: 'Behavioral Activation',
      description: 'Break avoidance cycle through small actions',
    },
  ];
}

function generateCbtRecommendations(techniques) {
  return [
    'Use Thought Record to identify and challenge distorted thinking',
    'Schedule behavioral activation: small actions to break avoidance',
    'Practice cognitive restructuring daily',
  ];
}

// ─── Trauma-Specific Analysis Functions ───────────────────────────────────

function analyzeTraumaIndicators(text) {
  const insights = [];

  if (/flashback|tetikle|güvenli/.test(text)) {
    insights.push('Trauma response indicators: Flashbacks/triggers detected');
  }
  if (/geçmiş|olmuş|hatırla|hiçbir zaman unutmeyeceğim/.test(text)) {
    insights.push('Trauma processing needed: Past trauma still active');
  }

  return insights;
}

function extractTraumaTechniques(moduleData, text) {
  return [
    {
      name: 'Grounding (5-4-3-2-1)',
      description: 'Return to present moment when triggered',
    },
    {
      name: 'Safety Planning',
      description: 'Create trigger avoidance + coping strategies',
    },
  ];
}

function generateTraumaRecommendations(techniques) {
  return [
    'Use 5-4-3-2-1 grounding when flashbacks occur',
    'Create trauma-sensitive environment',
    'Proceed slowly with trauma processing',
  ];
}

// ─── Placeholder Functions for Other Modules ──────────────────────────────

function analyzeBondState(text) {
  return [/ilişki|güven|yalnız/.test(text) ? 'Relationship/connection concerns detected' : null].filter(Boolean);
}

function extractBondTechniques(moduleData) {
  return [{ name: 'Active Listening', description: 'Deep connection through presence' }];
}

function generateBondRecommendations(insights) {
  return ['Building trust through consistent, empathetic presence'];
}

function analyzeResilienceFactors(text) {
  return [/başarı|güç|başardım|çıktım/.test(text) ? 'Resilience factors present' : null].filter(Boolean);
}

function extractResilienceTechniques(moduleData, text) {
  return [{ name: 'Strength Amplification', description: 'Build on existing coping' }];
}

function generateResilienceRecommendations(techniques) {
  return ['Identify and amplify existing resilience factors'];
}

function analyzeStrengths(text) {
  return [/teşekkür|minnettar|başarı|güçlü/.test(text) ? 'Character strengths identified' : null].filter(Boolean);
}

function extractPositiveTechniques(moduleData) {
  return [{ name: 'Strengths-Based Approach', description: 'Build on what works' }];
}

function generatePositiveRecommendations(insights) {
  return ['Focus on character strengths and values-aligned action'];
}

function analyzeTaskManagement(text) {
  return [/yapamıyorum|başlayamıyorum|organize|odaklan/.test(text) ? 'Executive dysfunction detected' : null].filter(Boolean);
}

function extractExecFuncTechniques(moduleData, text) {
  return [{ name: 'Task Breakdown', description: 'Chunking large tasks into micro-steps' }];
}

function generateExecFuncRecommendations(techniques) {
  return ['Break tasks into micro-steps (2 min max each)'];
}

function analyzeMetacognitivePatterns(text) {
  return [/düşün|neden|niçin|analiz|ruminasyon/.test(text) ? 'Rumination/overthinking pattern detected' : null].filter(Boolean);
}

function extractMetacognitiveTechniques(moduleData) {
  return [{ name: 'Thought Defusion', description: 'Notice thoughts without engagement' }];
}

function generateMetacognitiveRecommendations(insights) {
  return ['Observe thoughts as mental events, not facts'];
}

/**
 * Format module results for LLM injection
 * Converts technical module output into therapeutic context
 */
export function formatModuleResultsForLLM(moduleResults) {
  const formattedPrompt = Object.entries(moduleResults)
    .filter(([_, result]) => result.status === 'executed')
    .map(([moduleName, result]) => {
      const { analysis } = result;
      return `
## ${moduleName}
${analysis.insights.map(i => `- ${i}`).join('\n')}

**Techniques:** ${analysis.techniques.map(t => t.name).join(', ')}
**Recommendations:** ${analysis.recommendations.join(' → ')}
`;
    })
    .join('\n');

  return formattedPrompt;
}
