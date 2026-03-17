import { fal } from '@fal-ai/client';

// Configure fal client to use our server proxy for auth
fal.config({
  proxyUrl: '/api/fal/proxy',
});

export interface FalRealtimeResult {
  images: Array<{ url: string; content_type: string }>;
}

type OnResultCallback = (result: FalRealtimeResult) => void;
type OnErrorCallback = (error: Error) => void;

let connection: ReturnType<typeof fal.realtime.connect> | null = null;
let currentOnResult: OnResultCallback | null = null;
let currentOnError: OnErrorCallback | null = null;

/**
 * Initialize the real-time WebSocket connection to fal.ai LCM model.
 * Call once when hasFal becomes true.
 */
export function initFalRealtime(
  onResult: OnResultCallback,
  onError: OnErrorCallback,
): void {
  closeFalRealtime();

  currentOnResult = onResult;
  currentOnError = onError;

  connection = fal.realtime.connect('fal-ai/lcm-sd15-i2i', {
    connectionKey: 'drawit-realtime',
    throttleInterval: 150,
    onResult: (result: FalRealtimeResult) => {
      if (currentOnResult) currentOnResult(result);
    },
    onError: (error: Error) => {
      console.error('[fal-realtime] Error:', error);
      if (currentOnError) currentOnError(error);
    },
  });
}

/**
 * Send a canvas frame to fal.ai for real-time LCM generation.
 * The connection handles throttling internally via throttleInterval.
 */
export function sendFrame(
  imageDataUrl: string,
  prompt: string,
  strength: number = 0.65,
): void {
  if (!connection) return;

  connection.send({
    prompt,
    image_url: imageDataUrl,
    strength,
    num_inference_steps: 4,
    guidance_scale: 1.0,
    width: 512,
    height: 512,
    enable_safety_checker: true,
  });
}

/**
 * Close the WebSocket connection and clean up callbacks.
 */
export function closeFalRealtime(): void {
  if (connection) {
    try {
      connection.close();
    } catch {
      // Ignore close errors
    }
    connection = null;
  }
  currentOnResult = null;
  currentOnError = null;
}

/**
 * Check if the WebSocket connection is active.
 */
export function isFalRealtimeConnected(): boolean {
  return connection !== null;
}
