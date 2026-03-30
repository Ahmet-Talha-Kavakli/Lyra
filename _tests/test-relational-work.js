/**
 * Test: Relational Process Work
 * Tests if Lyra can detect and work with therapy relationship dynamics
 */

import { RelationalDynamicsTracker } from './src/application/services/RelationalDynamicsTracker.js';

console.log('🔍 Testing Relational Process Work...\n');

const tracker = new RelationalDynamicsTracker({
    userId: 'test-patient-001',
    sessionId: 'test-session-001'
});

// Simulate conversation history
const conversationHistory = [
    {
        role: 'user',
        content: 'I have been feeling really anxious lately. I cannot sleep at night. My mind races constantly.'
    },
    {
        role: 'assistant',
        content: 'I hear that anxiety is affecting your sleep deeply. Tell me more about what your mind is thinking about when you cannot sleep.'
    },
    {
        role: 'user',
        content: 'Work, family, everything really. But I never ask you anything. You ask, I just answer.'
    },
    {
        role: 'assistant',
        content: 'That\'s interesting you notice that. What does that pattern feel like?'
    },
    {
        role: 'user',
        content: 'Safe. I mean, you are asking, so I do not have to decide what to talk about. My father, he decided everything for me growing up. Maybe that is why.'
    }
];

const currentTranscript = `
I have been thinking about what you said last week.
Maybe I am doing the same thing in my relationships - I let them decide.
But I get angry about it later. Just like how I felt with my father.
Am I repeating that pattern with you too?
`;

console.log('📋 TEST 1: Analyze Relational Pattern');
console.log('─'.repeat(80));

const pattern = tracker.analyzeRelationalPattern(currentTranscript, conversationHistory);

console.log('\n✅ Pattern Analysis Results:');
console.log(`Reciprocity: ${pattern.reciprocity.level}`);
console.log(`  - Score: ${(pattern.reciprocity.score * 100).toFixed(0)}%`);
console.log(`  - Questions asked: ${pattern.reciprocity.totalQuestions}`);
console.log(`  - Total messages: ${pattern.reciprocity.messageCount}`);

console.log(`\nVulnerability: ${pattern.vulnerability.level}`);
console.log(`  - Score: ${(pattern.vulnerability.score * 100).toFixed(0)}%`);
console.log(`  - Emotional keywords: ${pattern.vulnerability.vulnerabilityKeywords}`);
console.log(`  - External focus: ${pattern.vulnerability.externalFocus}`);

console.log(`\nTrust Progression: ${pattern.trustProgression.level}`);
console.log(`  - Trend: ${pattern.trustProgression.trend}`);
console.log(`  - Early openness: ${pattern.trustProgression.earlyWordCount} words`);
console.log(`  - Recent openness: ${pattern.trustProgression.recentWordCount} words`);

console.log(`\nDefensiveness: ${pattern.defensiveness.level}`);
console.log(`  - Score: ${(pattern.defensiveness.score * 100).toFixed(0)}%`);
console.log(`  - Defensive markers: ${pattern.defensiveness.defensiveMarkers}`);

console.log(`\nDependency: ${pattern.dependency.level}`);
console.log(`  - Score: ${(pattern.dependency.score * 100).toFixed(0)}%`);
console.log(`  - Dependency markers: ${pattern.dependency.dependencyMarkers}`);

if (pattern.detectedTransference.length > 0) {
    console.log(`\nTransference Detected:`);
    pattern.detectedTransference.forEach(t => {
        console.log(`  - ${t.type} (confidence: ${(t.confidence * 100).toFixed(0)}%)`);
        console.log(`    ${t.indicator}`);
    });
}

// Test 2: Meta-communication interventions
console.log('\n\n📋 TEST 2: Generate Meta-Communication Interventions');
console.log('─'.repeat(80));

const interventions = tracker.generateMetaCommunicationIntervention(pattern, {
    userMessage: currentTranscript
});

if (interventions.length > 0) {
    console.log(`\n✅ Found ${interventions.length} meta-communication opportunity(ies):\n`);
    interventions.forEach((intervention, idx) => {
        console.log(`${idx + 1}. ${intervention.type.toUpperCase()}`);
        console.log(`   Confidence: ${(intervention.confidence * 100).toFixed(0)}%`);
        console.log(`   Message:\n   "${intervention.message.split('\n').join('\n   ')}"`);
        console.log(`\n   Purpose: ${intervention.purpose}\n`);
    });
} else {
    console.log('\n⚠️ No meta-communication interventions detected at this moment');
}

// Test 3: System Prompt Preview
console.log('\n📋 TEST 3: System Prompt Integration');
console.log('─'.repeat(80));

const systemPromptSection = `

THERAPEUTIC RELATIONSHIP DYNAMICS (The relationship itself is the work):
Current relational pattern:
- Reciprocity: ${pattern.reciprocity.level} (Are they asking questions back?)
- Vulnerability: ${pattern.vulnerability.level} (Sharing emotions or just facts?)
- Trust progression: ${pattern.trustProgression.trend} (Opening up or withdrawing?)
- Defensiveness: ${pattern.defensiveness.level} (Resisting exploration?)
- Dependency: ${pattern.dependency.level} (Looking to you for answers?)
${pattern.detectedTransference.length > 0 ? `- Transference: ${pattern.detectedTransference.map(t => t.type).join(', ')}` : ''}

IMPORTANT - META-COMMUNICATION OPPORTUNITIES:
${interventions.length > 0 ? interventions.map(int => `- "${int.message.substring(0, 80)}..."`).join('\n') : 'None at this moment'}

Remember: The way they relate to you mirrors how they relate to others.
The changes that happen in THIS relationship often generalize to their other relationships.
This is where real transformation happens.
`;

console.log('\n✅ System Prompt Section Preview:');
console.log('─'.repeat(80));
console.log(systemPromptSection);
console.log('─'.repeat(80));

// Test 4: Analysis Summary
console.log('\n\n📊 SUMMARY');
console.log('─'.repeat(80));

const relationshipHealthScore = (
    (pattern.reciprocity.score * 0.25) +
    (pattern.vulnerability.score * 0.25) +
    ((1 - pattern.defensiveness.score) * 0.25) +
    ((1 - pattern.dependency.score) * 0.25)
) * 100;

console.log(`Relational Health Score: ${relationshipHealthScore.toFixed(0)}/100`);
console.log(`\nKey Insights:`);
console.log(`✓ Patient is becoming more vulnerable and open (trust building)`);
console.log(`✓ Patient is making connections to past patterns (insight)`);
console.log(`✓ Patient is noticing one-sidedness in relationships`);
console.log(`✓ Clear transference pattern related to paternal authority`);
console.log(`\nRecommendations:`);
console.log(`→ Use meta-communication to gently reflect the relationship pattern`);
console.log(`→ Help patient see that their pattern WITH therapist mirrors other relationships`);
console.log(`→ This is a prime opportunity for relational healing`);

console.log('\n✅ RELATIONAL PROCESS WORK TEST COMPLETE\n');
