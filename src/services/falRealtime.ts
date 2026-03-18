import { fal } from '@fal-ai/client';

// Configure fal client to use our server proxy (keeps FAL_KEY server-side)
fal.config({
  proxyUrl: '/api/fal/proxy',
});

export interface FalRealtimeResult {
  images: Array<{ url: string; content_type: string }>;
}

type OnResultCallback = (result: FalRealtimeResult) => void;
type OnErrorCallback = (error: Error) => void;

let currentOnResult: OnResultCallback | null = null;
let currentOnError: OnErrorCallback | null = null;
let isConnected = false;

// "Latest wins" pattern: only one request at a time, queue the latest frame
let isRequestInFlight = false;
let pendingFrame: { imageDataUrl: string; prompt: string; strength: number } | null = null;
let requestCounter = 0;

// ─── Model config ──────────────────────────────────────────────────────────
// SDXL Lightning: 4-step model that understands composition far better than
// SD1.5 LCM. It treats the input image as a real structural reference, not
// just noise — sketches come through recognizably.
const FAL_MODEL = 'fal-ai/fast-lightning-sdxl/image-to-image';

/**
 * Initialize the fal.ai service.
 */
export function initFalRealtime(
  onResult: OnResultCallback,
  onError: OnErrorCallback,
): void {
  closeFalRealtime();
  currentOnResult = onResult;
  currentOnError = onError;
  isConnected = true;
  console.log(`[fal-realtime] Initialized (${FAL_MODEL} via fal.subscribe)`);
}

/**
 * Process a single frame through fal.ai SDXL Lightning img2img.
 */
async function processFrame(
  imageDataUrl: string,
  prompt: string,
  strength: number,
): Promise<void> {
  const myId = ++requestCounter;

  try {
    const result = await fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        image_url: imageDataUrl,
        strength,
        num_inference_steps: 4,
        // SDXL Lightning doesn't use guidance_scale
        image_size: 'square',
        num_images: 1,
        format: 'jpeg',
        enable_safety_checker: true,
        sync_mode: true,
      },
      pollInterval: 200,
    });

    if (myId !== requestCounter) return; // stale

    const data = (result as any).data ?? result;

    if (currentOnResult) {
      currentOnResult(data as FalRealtimeResult);
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    console.error('[fal-realtime] Error:', error);
    if (currentOnError && error instanceof Error) {
      currentOnError(error);
    }
  }
}

/**
 * Send a canvas frame for generation.
 * Uses "latest wins": if in-flight, saves as pending → processes when done.
 */
export async function sendFrame(
  imageDataUrl: string,
  prompt: string,
  strength: number = 0.75,
): Promise<void> {
  if (!isConnected || !currentOnResult) return;

  if (isRequestInFlight) {
    pendingFrame = { imageDataUrl, prompt, strength };
    return;
  }

  isRequestInFlight = true;
  pendingFrame = null;

  await processFrame(imageDataUrl, prompt, strength);

  isRequestInFlight = false;

  if (pendingFrame && isConnected) {
    const { imageDataUrl: img, prompt: p, strength: s } = pendingFrame;
    pendingFrame = null;
    sendFrame(img, p, s);
  }
}

/**
 * Close and clean up.
 */
export function closeFalRealtime(): void {
  currentOnResult = null;
  currentOnError = null;
  isConnected = false;
  isRequestInFlight = false;
  pendingFrame = null;
  requestCounter++;
}

export function isFalRealtimeConnected(): boolean {
  return isConnected;
}
