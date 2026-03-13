interface GeneratePayload {
  imageBase64: string;
  prompt: string;
  quality: string;
  size: string;
}

interface GenerateResult {
  imageBase64: string;
  detectedSubject: string | null;
  revisedPrompt: string | null;
}

interface HealthResponse {
  status: string;
  hasApiKey: boolean;
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

  // Try primary endpoint (Images Edit API)
  const primaryResponse = await fetch('/api/generate', { method: 'POST', headers, body });

  if (primaryResponse.ok) {
    return primaryResponse.json() as Promise<GenerateResult>;
  }

  const primaryError = await parseErrorResponse(primaryResponse);
  console.error(`[generateImage] Primary endpoint failed: ${primaryError}`);

  // Fall back to Responses API
  const fallbackResponse = await fetch('/api/generate-v2', { method: 'POST', headers, body });

  if (fallbackResponse.ok) {
    return fallbackResponse.json() as Promise<GenerateResult>;
  }

  const fallbackError = await parseErrorResponse(fallbackResponse);
  throw new Error(fallbackError);
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}
