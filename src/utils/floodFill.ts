const COLOR_TOLERANCE = 30;

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

function getPixel(data: Uint8ClampedArray, idx: number): RGBA {
  return {
    r: data[idx],
    g: data[idx + 1],
    b: data[idx + 2],
    a: data[idx + 3],
  };
}

function colorsMatch(a: RGBA, b: RGBA): boolean {
  return (
    Math.abs(a.r - b.r) <= COLOR_TOLERANCE &&
    Math.abs(a.g - b.g) <= COLOR_TOLERANCE &&
    Math.abs(a.b - b.b) <= COLOR_TOLERANCE &&
    Math.abs(a.a - b.a) <= COLOR_TOLERANCE
  );
}

function hexToRGBA(hex: string): RGBA {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
    a: 255,
  };
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
): void {
  const { width, height } = ctx.canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const sx = Math.floor(startX);
  const sy = Math.floor(startY);

  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const startIdx = (sy * width + sx) * 4;
  const targetColor = getPixel(data, startIdx);
  const fill = hexToRGBA(fillColor);

  // Don't fill if target color is the same as fill color
  if (colorsMatch(targetColor, fill)) return;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [sx, sy];
  let head = 0;

  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];

    const pixelIdx = y * width + x;
    if (visited[pixelIdx]) continue;
    visited[pixelIdx] = 1;

    const dataIdx = pixelIdx * 4;
    const current = getPixel(data, dataIdx);

    if (!colorsMatch(current, targetColor)) continue;

    data[dataIdx] = fill.r;
    data[dataIdx + 1] = fill.g;
    data[dataIdx + 2] = fill.b;
    data[dataIdx + 3] = fill.a;

    if (x > 0) queue.push(x - 1, y);
    if (x < width - 1) queue.push(x + 1, y);
    if (y > 0) queue.push(x, y - 1);
    if (y < height - 1) queue.push(x, y + 1);
  }

  ctx.putImageData(imageData, 0, 0);
}
