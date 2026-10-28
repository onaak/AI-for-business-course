// Adapter for any endpoint that speaks the OpenAI chat-completions format.
import { GatewayError, RATE_LIMIT_STATUSES, RateLimitError, retryAfterMs, type Provider } from './types';

export function openAiCompatibleProvider(apiKey: string, baseUrl: string): Provider {
  const root = baseUrl.replace(/\/+$/, '');
  return {
    name: 'openai-compatible',
    async complete({ system, user, model, temperature }) {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
      if (temperature !== null) body.temperature = temperature;
      const res = await fetch(`${root}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (RATE_LIMIT_STATUSES.has(res.status)) {
        throw new RateLimitError(`Model provider answered ${res.status} (too many requests or overloaded): ${(await res.text()).slice(0, 200)}`, retryAfterMs(res.headers.get('retry-after')));
      }
      if (!res.ok) {
        throw new GatewayError(502, `Model provider answered ${res.status}: ${(await res.text()).slice(0, 300)}`, 'provider_error');
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? '';
      if (!text) throw new GatewayError(502, 'Model provider returned no text.', 'provider_error');
      return text;
    },
  };
}
