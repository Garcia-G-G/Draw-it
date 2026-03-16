import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';
import Together from 'together-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_TIMEOUT_MS = 60_000;

const openaiKey = process.env.OPENAI_API_KEY;
const togetherKey = process.env.TOGETHER_API_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey, timeout: OPENAI_TIMEOUT_MS }) : null;
const together = togetherKey ? new Together({ apiKey: togetherKey }) : null;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'] }));
app.use(express.json({ limit: '10mb' }));

let imageModel = 'gpt-image-1';

async function detectBestModel() {
  if (!openai) return;
  try {
    await openai.images.generate({ model: 'gpt-image-1.5', prompt: 'A small red dot.', n: 1, size: '1024x1024', quality: 'low' });
    imageModel = 'gpt-image-1.5';
    logInfo('startup', 'Using gpt-image-1.5');
  } catch (err) {
    logInfo('startup', `gpt-image-1.5 not available (${err.status || err.message}), using gpt-image-1`);
  }
}

function ts() { return new Date().toISOString(); }
function logError(ctx, err) { console.error(`[${ts()}] [${ctx}]`, err.message || err); }
function logInfo(ctx, msg) { console.log(`[${ts()}] [${ctx}]`, msg); }
function strip(b64) { return b64.replace(/^data:image\/\w+;base64,/, ''); }

function mapOpenAIError(error) {
  if (!error.status) {
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout'))
      return { status: 504, message: "Timed out. Try 'low' quality." };
    return { status: 500, message: 'An unexpected error occurred.' };
  }
  switch (error.status) {
    case 401: return { status: 401, message: 'Invalid API key.' };
    case 429: return { status: 429, message: 'Rate limit exceeded. Wait and retry.' };
    case 400: {
      const m = error.message?.toLowerCase() || '';
      if (m.includes('content_policy') || m.includes('safety') || m.includes('flagged'))
        return { status: 400, message: 'Content policy violation.' };
      return { status: 400, message: 'Could not process. Try redrawing.' };
    }
    case 500: case 502: case 503:
      return { status: 502, message: 'OpenAI issues. Try again shortly.' };
    default:
      return { status: error.status, message: error.message || 'Unexpected error.' };
  }
}

// ─── Vision ──────────────────────────────────────────────────────────────────

const VISION_PROMPT = `You are analyzing a rough hand-drawn sketch. Describe what it depicts in vivid detail so an image generator can create a professional version WITHOUT seeing the sketch.

Include: the specific subject, its pose/orientation, key features, composition, and a fitting background.

Be creative — fill in details the sketcher couldn't convey: textures, materials, lighting, mood.

Respond with ONLY 2-3 sentences of vivid description. No preamble.`;

async function analyzeSketch(rawBase64) {
  if (!openai) return null;
  try {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: [
        { type: 'input_image', image_url: `data:image/png;base64,${rawBase64}` },
        { type: 'input_text', text: VISION_PROMPT },
      ]}],
    });
    const textOut = response.output?.find((i) => i.type === 'message');
    const desc = textOut?.content?.find((c) => c.type === 'output_text')?.text?.trim();
    if (!desc || desc.length < 10) return null;
    logInfo('vision', `Detected: "${desc}"`);
    return desc;
  } catch (error) {
    logError('vision', error);
    return null;
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function suggestEnvironment(subject) {
  const s = subject.toLowerCase();
  if (/face|person|character|man|woman|portrait/.test(s)) return 'Soft gradient background.';
  if (/cat|dog|animal|bird|pet/.test(s)) return 'Natural setting.';
  if (/house|building|castle|cottage/.test(s)) return 'Landscape with sky and garden.';
  if (/car|truck|vehicle|bicycle/.test(s)) return 'Appropriate road or setting.';
  if (/tree|flower|plant|mountain|landscape/.test(s)) return 'Full natural scene.';
  if (/food|cake|pizza|fruit|coffee/.test(s)) return 'Appetizing food photography setup.';
  if (/pants|shirt|dress|clothes|shoe|fashion/.test(s)) return 'Clean fashion product photography.';
  return 'Appropriate contextual background.';
}

function buildPrompt(subject, stylePrompt, promptOverride) {
  const desc = promptOverride || subject;
  if (!desc) return `${stylePrompt}. Professional quality, rich detail.`;
  const env = suggestEnvironment(desc);
  return `${stylePrompt} of ${desc}. ${env} Professional quality with rich detail and depth.`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasOpenAI: Boolean(openaiKey),
    hasTogether: Boolean(togetherKey),
    hasFal: false,
    imageModel,
    timestamp: ts(),
  });
});

// ─── Live Preview: Together.ai FLUX.1 [schnell] (~300ms-2s) ─────────────────

app.post('/api/realtime-generate', async (req, res) => {
  if (!together) return res.status(503).json({ error: 'Set TOGETHER_API_KEY in .env' });
  try {
    const { imageBase64, prompt } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    const raw = strip(imageBase64);
    const startMs = Date.now();

    const response = await together.images.create({
      model: 'black-forest-labs/FLUX.1-schnell-Free',
      prompt: prompt || 'Professional high quality artwork, detailed, beautiful',
      image_url: `data:image/jpeg;base64,${raw}`,
      width: 1024,
      height: 1024,
      steps: 4,
      n: 1,
      response_format: 'base64',
    });

    const latency = Date.now() - startMs;
    const b64 = response.data?.[0]?.b64_json;

    if (!b64) {
      // Try paid model if free model fails
      logInfo('realtime', 'Free model failed, trying paid model...');
      const fallback = await together.images.create({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: prompt || 'Professional high quality artwork, detailed, beautiful',
        image_url: `data:image/jpeg;base64,${raw}`,
        width: 1024,
        height: 1024,
        steps: 4,
        n: 1,
        response_format: 'base64',
      });
      const fb64 = fallback.data?.[0]?.b64_json;
      if (!fb64) return res.status(502).json({ error: 'Together.ai returned no image.' });
      logInfo('realtime', `FLUX schnell (paid): ${Date.now() - startMs}ms`);
      return res.json({ imageBase64: fb64, latency: Date.now() - startMs });
    }

    logInfo('realtime', `FLUX schnell: ${latency}ms`);
    res.json({ imageBase64: b64, latency });
  } catch (error) {
    logError('realtime', error);
    res.status(500).json({ error: error.message || 'Realtime generation failed.' });
  }
});

// ─── HD: Text-to-image via OpenAI ────────────────────────────────────────────

app.post('/api/generate', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, prompt, quality = 'medium', size = '1024x1024', promptOverride } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Missing required fields' });

    let detectedSubject = null;
    if (!promptOverride) {
      logInfo('generate', 'Step 1: Vision...');
      detectedSubject = await analyzeSketch(strip(imageBase64));
    } else {
      logInfo('generate', `Override: "${promptOverride}"`);
    }

    const finalPrompt = buildPrompt(detectedSubject, prompt, promptOverride);
    logInfo('generate', `Step 2: ${imageModel} | "${finalPrompt.slice(0, 100)}..."`);

    const response = await openai.images.generate({
      model: imageModel, prompt: finalPrompt, n: 1, size, quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) return res.status(502).json({ error: 'Empty response.' });

    logInfo('generate', 'Done');
    res.json({
      imageBase64: generatedBase64,
      detectedSubject: promptOverride || detectedSubject || null,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
    });
  } catch (error) {
    logError('generate', error);
    res.status(mapOpenAIError(error).status).json({ error: mapOpenAIError(error).message });
  }
});

// ─── HD Fallback: Responses API ──────────────────────────────────────────────

app.post('/api/generate-v2', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, prompt, quality = 'medium', size = '1024x1024', promptOverride } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Missing required fields' });

    const rawBase64 = strip(imageBase64);
    let detectedSubject = null;
    if (!promptOverride) detectedSubject = await analyzeSketch(rawBase64);

    const basePrompt = buildPrompt(detectedSubject, prompt, promptOverride);
    const finalPrompt = `Create a brand new professional image (DO NOT trace the sketch): ${basePrompt}`;

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input: [{ role: 'user', content: [
        { type: 'input_image', image_url: `data:image/png;base64,${rawBase64}` },
        { type: 'input_text', text: finalPrompt },
      ]}],
      tools: [{ type: 'image_generation', quality, size }],
    });

    const imageOutput = response.output?.find((i) => i.type === 'image_generation_call');
    if (!imageOutput?.result) return res.status(502).json({ error: 'Empty response.' });

    res.json({
      imageBase64: imageOutput.result,
      detectedSubject: promptOverride || detectedSubject || null,
      revisedPrompt: null,
    });
  } catch (error) {
    logError('generate-v2', error);
    res.status(mapOpenAIError(error).status).json({ error: mapOpenAIError(error).message });
  }
});

// ─── Refine ──────────────────────────────────────────────────────────────────

app.post('/api/refine', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, quality = 'medium' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    const imageFile = await toFile(Buffer.from(strip(imageBase64), 'base64'), 'image.png', { type: 'image/png' });
    const response = await openai.images.edit({
      model: imageModel, image: imageFile,
      prompt: 'Enhance: more detail, better lighting, richer colors, refined edges. Keep same subject. Make dramatically better.',
      n: 1, size: '1024x1024', quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) return res.status(502).json({ error: 'Refine failed.' });
    res.json({ imageBase64: generatedBase64 });
  } catch (error) {
    logError('refine', error);
    res.status(mapOpenAIError(error).status).json({ error: mapOpenAIError(error).message });
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n  Draw It API server running on http://localhost:${PORT}`);
  console.log(`  OpenAI: ${openaiKey ? '\u2713' : '\u2717 missing'}`);
  console.log(`  Together.ai: ${togetherKey ? '\u2713 realtime (FLUX schnell)' : '\u2717 disabled'}`);

  if (openaiKey) {
    console.log('  Detecting best image model...');
    await detectBestModel();
    console.log(`  Image model: ${imageModel}`);
  }
  console.log();
});
