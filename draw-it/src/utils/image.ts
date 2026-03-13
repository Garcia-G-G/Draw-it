/**
 * Load a base64 string into an HTMLImageElement.
 */
export function base64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from base64'));
    img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  });
}
