interface GeneratePayload {
  imageBase64: string;
  prompt: string;
  quality: string;
  size: string;
  promptOverride?: string;
}

interface GenerateResult {
  imageBase64: string;
  detectedSubject: string | null;
  revisedPrompt: string | null;
}

interface RefineResult {
  imageBase64: string;
}

interface HealthResponse {
  status: string;
  hasOpenAI: boolean;
  hasFal: boolean;
  timestamp: string;
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function generateImage(payload: GeneratePayload): Promise<GenerateResult> {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json' };

  const primaryResponse = await fetch('/api/generate', { method: 'POST', headers, body });
  if (primaryResponse.ok) return primaryResponse.json() as Promise<GenerateResult>;

  const primaryError = await parseErrorResponse(primaryResponse);
  console.error(`[generateImage] Primary failed: ${primaryError}`);

  const fallbackResponse = await fetch('/api/generate-v2', { method: 'POST', headers, body });
  if (fallbackResponse.ok) return fallbackResponse.json() as Promise<GenerateResult>;

  throw new Error(await parseErrorResponse(fallbackResponse));
}

export async function refineImage(imageBase64: string, quality: string): Promise<RefineResult> {
  const response = await fetch('/api/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, quality }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response.json() as Promise<RefineResult>;
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return response.json() as Promise<HealthResponse>;
}
