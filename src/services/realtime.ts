interface RealtimeResult {
  imageBase64: string;
  latency: number;
}

let inflightController: AbortController | null = null;

function compressCanvas(dataUrl: string, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      resolve(jpeg.replace(/^data:image\/\w+;base64,/, ''));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function realtimeGenerate(
  canvasDataUrl: string,
  prompt: string,
  strength: number,
): Promise<RealtimeResult> {
  // Cancel any in-flight request
  if (inflightController) {
    inflightController.abort();
  }
  inflightController = new AbortController();

  const compressed = await compressCanvas(canvasDataUrl, 512, 0.7);

  const response = await fetch('/api/realtime-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: compressed, prompt, strength }),
    signal: inflightController.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Realtime failed (${response.status})`);
  }

  const result = await response.json() as RealtimeResult;
  inflightController = null;
  return result;
}

export function cancelRealtime(): void {
  if (inflightController) {
    inflightController.abort();
    inflightController = null;
  }
}
