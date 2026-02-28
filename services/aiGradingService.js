/**
 * AI Grading Service - Evaluates scored sections using LLM
 *
 * Used in hybrid grading: keyword-based for checkboxes, AI for scored sections.
 * Evaluates competency rather than keyword presence.
 */

const { openai } = require('../config/openai');

const USE_AI_GRADING = process.env.USE_AI_GRADING !== 'false';

function formatConversation(conversation) {
  if (!Array.isArray(conversation)) return '';
  return conversation
    .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant'))
    .map(msg => {
      const role = msg.role === 'user' ? 'EMT Student' : 'Patient';
      return `${role}: ${(msg.content || '').trim()}`;
    })
    .join('\n\n');
}

function buildScoringPrompt(conversationText, sections, scenarioData) {
  const scenarioContext = scenarioData
    ? `Scenario: ${scenarioData.mainScenario || 'Medical'} / ${scenarioData.subScenario || 'General'}`
    : 'Scenario: EMT medical/trauma assessment';

  const sectionBlocks = sections.map(s => {
    return `- ${s.id} (${s.name}): 0=${s.criteria[0]}, 1=${s.criteria[1]}, 2=${s.criteria[2]}, 3=${s.criteria[3]}`;
  }).join('\n');

  return `You are an EMT educator grading a student's scenario performance. Evaluate the conversation and assign a score 0-3 for each section based on the criteria. Be fair: credit the student for demonstrated competency even if wording differs from exact rubric phrases.

${scenarioContext}

## Conversation
${conversationText || '(empty)'}

## Sections and Criteria (0-3 each)
${sectionBlocks}

## Output
Return ONLY valid JSON in this exact format, no other text:
{"hpi":N,"pmh":N,"vitals":N,"physicalExam":N,"medicalManagement":N,"patientInteraction":N,"hospitalRadio":N,"handover":N,"leadership":N}
where N is 0, 1, 2, or 3 for each section.`;
}

/**
 * Grade scored sections using AI. Returns { sectionId: score } or null on failure.
 */
async function gradeScoredSectionsWithAI(conversation, rubricSections, scenarioData) {
  if (!USE_AI_GRADING) return null;

  try {
    const conversationText = formatConversation(conversation);
    const prompt = buildScoringPrompt(conversationText, rubricSections, scenarioData);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2
    });

    const content = response.choices?.[0]?.message?.content?.trim() || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    const parsed = JSON.parse(jsonStr);

    const results = {};
    for (const section of rubricSections) {
      let score = parseInt(parsed[section.id], 10);
      if (isNaN(score) || score < 0 || score > 3) score = 0;
      results[section.id] = Math.min(3, Math.max(0, score));
    }
    return results;
  } catch (err) {
    console.warn('AI grading failed, will fall back to keyword-based:', err.message);
    return null;
  }
}

module.exports = {
  gradeScoredSectionsWithAI,
  USE_AI_GRADING
};
