export interface CompletionRequest {
  system: string;
  user: string;
  model: string;
  temperature: number | null;
  /** The validated task input. Real providers ignore it; the scripted demo provider answers from it. */
  task?: string;
  input?: unknown;
}

/** A provider turns one prompt into one raw text answer. Nothing else. */
export interface Provider {
  name: string;
  complete(req: CompletionRequest): Promise<string>;
}

export class GatewayError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'gateway_error',
  ) {
    super(message);
  }
}

/**
 * The provider said "too many requests" (HTTP 429), or that it is overloaded (503, 529).
 * Free tiers limit requests per minute. The gateway waits and tries again; these waits do
 * not count as the one automatic retry.
 */
export class RateLimitError extends GatewayError {
  constructor(
    message: string,
    /** From the Retry-After header, when the provider sends one. */
    public retryAfterMs: number | null,
  ) {
    super(429, message, 'rate_limited');
  }
}

/** Reads Retry-After (seconds or an HTTP date). Null when absent or unreadable. */
export function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

export const RATE_LIMIT_STATUSES = new Set([429, 503, 529]);
