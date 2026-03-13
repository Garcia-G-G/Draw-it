/**
 * Export a canvas element to a base64 data URL.
 */
export function canvasToBase64(
  canvas: HTMLCanvasElement,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality = 0.92,
): string {
  return canvas.toDataURL(format, quality);
}

/**
 * Export canvas with a solid white background composited behind the drawing.
 * The main canvas uses transparency for erasing, so raw toDataURL() sends
 * mostly-transparent pixels to OpenAI which can't "see" the sketch.
 */
export function canvasToBase64WithWhiteBg(canvas: HTMLCanvasElement): string {
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);

  // Draw the user's sketch on top
  ctx.drawImage(canvas, 0, 0);

  return offscreen.toDataURL('image/png');
}

/**
 * Strip the data URL prefix, returning only the base64 payload.
 */
export function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}
