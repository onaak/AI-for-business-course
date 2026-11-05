// Adapter for the Anthropic Messages API. The key stays on the server.
import { GatewayError, RATE_LIMIT_STATUSES, RateLimitError, retryAfterMs, type Provider } from './types';

export function anthropicProvider(apiKey: string, baseUrl = 'https://api.anthropic.com'): Provider {
  return {
    name: 'anthropic',
    async complete({ system, user, model, temperature }) {
      const body: Record<string, unknown> = {
        model,
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: user }],
      };
      if (temperature !== null) body.temperature = temperature;
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      });
      if (RATE_LIMIT_STATUSES.has(res.status)) {
        throw new RateLimitError(`Model provider answered ${res.status} (too many requests or overloaded): ${(await res.text()).slice(0, 200)}`, retryAfterMs(res.headers.get('retry-after')));
      }
      if (!res.ok) {
        throw new GatewayError(502, `Model provider answered ${res.status}: ${(await res.text()).slice(0, 300)}`, 'provider_error');
      }
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = (json.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (!text) throw new GatewayError(502, 'Model provider returned no text.', 'provider_error');
      return text;
    },
  };
}
