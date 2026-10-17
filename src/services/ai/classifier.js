import { z } from 'zod';
import aiClient from './aiClient.js';
import { buildClassificationPrompt } from './prompts.js';
import { classifyWithFallback } from './fallbackClassifier.js';
import { CATEGORIES, PRIORITIES } from '../../utils/constants.js';

const classificationOutputSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  confidence: z.coerce.number().min(0).max(1).optional().default(0.9),
  reason: z.string().optional().default('AI classification'),
});

export const classify = async ({ bookTitle, subject, description }) => {
  const textContent = `${subject} ${description}`;

  try {
    const { system, user } = buildClassificationPrompt({ bookTitle, subject, description });
    const response = await aiClient.complete({
      system,
      user,
      maxTokens: 150,
      temperature: 0,
      taskName: 'classification',
    });

    // Strip any backticks or formatting
    let cleanText = response.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText
        .replace(/^```json/, '')
        .replace(/```$/, '')
        .trim();
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleanText);
    const validated = classificationOutputSchema.parse(parsed);

    // Hard policy rule in code: ISBN & Metadata Issues must be at least High
    if (
      validated.category === 'ISBN & Metadata Issues' &&
      (validated.priority === 'Low' || validated.priority === 'Medium')
    ) {
      validated.priority = 'High';
      validated.reason = 'ISBN issue elevated to High by policy rule';
    }

    return {
      category: validated.category,
      priority: validated.priority,
      confidence: validated.confidence,
      reason: validated.reason,
      source: 'ai',
      usage: {
        task: 'classification',
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: response.latencyMs,
        at: new Date(),
      },
    };
  } catch (error) {
    console.warn(
      `⚠️ Live AI classification skipped/failed (${error.message}). Using fallback classifier.`
    );
    const fallback = classifyWithFallback(textContent);

    return {
      category: fallback.category,
      priority: fallback.priority,
      confidence: fallback.confidence,
      reason: fallback.reason,
      source: 'fallback',
      error: error.message,
    };
  }
};

export default { classify };
