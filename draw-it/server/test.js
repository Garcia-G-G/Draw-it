import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_URL = 'http://localhost:3001';

// Create a minimal valid PNG: 200x200 solid red square
// This is a programmatically generated PNG without needing the canvas package
async function createTestPng() {
  const width = 200;
  const height = 200;

  // Raw RGBA pixel data: solid red
  const rawPixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rawPixels[i * 4] = 255;     // R
    rawPixels[i * 4 + 1] = 0;   // G
    rawPixels[i * 4 + 2] = 0;   // B
    rawPixels[i * 4 + 3] = 255; // A
  }

  // Build PNG manually
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const payload = Buffer.concat([typeBytes, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(payload));
    return Buffer.concat([length, payload, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (no alpha to keep it simple)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw pixel data with filter bytes
  const { deflateSync } = await import('zlib');
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 3) + 1 + x * 3;
      rawData[dstIdx] = rawPixels[srcIdx];     // R
      rawData[dstIdx + 1] = rawPixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = rawPixels[srcIdx + 2]; // B
    }
  }
  const compressed = deflateSync(rawData);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

async function main() {
  console.log('Draw It API Test Script');
  console.log('='.repeat(40));

  // Step 1: Health check
  console.log('\n[1/3] Checking server health...');
  try {
    const healthRes = await fetch(`${SERVER_URL}/api/health`);
    const health = await healthRes.json();
    console.log('  Health:', JSON.stringify(health, null, 2));

    if (!health.hasApiKey) {
      console.error('\n  ✗ No API key configured. Set OPENAI_API_KEY in .env');
      process.exit(1);
    }
    console.log('  ✓ Server is healthy and API key is configured');
  } catch (error) {
    console.error(`  ✗ Could not reach server at ${SERVER_URL}. Is it running?`);
    console.error(`    Error: ${error.message}`);
    process.exit(1);
  }

  // Step 2: Create test image
  console.log('\n[2/3] Creating test image...');
  const pngBuffer = await createTestPng();
  const base64Image = pngBuffer.toString('base64');
  console.log(`  ✓ Test PNG created (${pngBuffer.length} bytes)`);

  // Step 3: Generate
  const payload = {
    imageBase64: base64Image,
    prompt: 'Transform this red square into a beautiful red rose on a white background.',
    quality: 'low',
    size: '1024x1024',
  };

  console.log('\n[3/3] Calling /api/generate...');
  let result = null;

  try {
    const res = await fetch(`${SERVER_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      result = await res.json();
      console.log('  ✓ Primary endpoint succeeded');
    } else {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      console.log(`  ✗ Primary endpoint failed (${res.status}): ${error.error}`);
      console.log('  Falling back to /api/generate-v2...');
    }
  } catch (error) {
    console.log(`  ✗ Primary endpoint error: ${error.message}`);
    console.log('  Falling back to /api/generate-v2...');
  }

  if (!result) {
    try {
      const res = await fetch(`${SERVER_URL}/api/generate-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        result = await res.json();
        console.log('  ✓ Fallback endpoint succeeded');
      } else {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`  ✗ Fallback endpoint also failed (${res.status}): ${error.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`  ✗ Fallback endpoint error: ${error.message}`);
      process.exit(1);
    }
  }

  // Save result
  const outputPath = path.join(__dirname, 'test-output.png');
  const imageBuffer = Buffer.from(result.imageBase64, 'base64');
  fs.writeFileSync(outputPath, imageBuffer);

  console.log(`\n${'='.repeat(40)}`);
  console.log(`✓ Success! Generated image saved to: ${outputPath}`);
  console.log(`  Image size: ${imageBuffer.length} bytes`);
  if (result.revisedPrompt) {
    console.log(`  Revised prompt: ${result.revisedPrompt}`);
  }
}

main().catch((error) => {
  console.error('\nUnhandled error:', error.message);
  process.exit(1);
});
