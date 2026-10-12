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
