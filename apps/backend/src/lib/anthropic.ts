import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ApiError(503, 'AI features are not configured on this server');
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Run a single-turn completion that must return JSON matching the caller's
 * expectations. Callers validate the parsed output with Zod.
 */
export async function completeJson(system: string, user: string, maxTokens = 2048): Promise<unknown> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: env.AI_MODEL,
    max_tokens: maxTokens,
    system: `${system}\n\nRespond with ONLY valid JSON — no prose, no markdown fences.`,
    messages: [{ role: 'user', content: user }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(jsonText);
  } catch {
    throw ApiError.internal('AI returned an unparseable response');
  }
}
