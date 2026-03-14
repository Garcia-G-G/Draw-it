import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';
import { fal } from '@fal-ai/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_TIMEOUT_MS = 60_000;

const openaiKey = process.env.OPENAI_API_KEY;
const falKey = process.env.FAL_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey, timeout: OPENAI_TIMEOUT_MS }) : null;

if (falKey) fal.config({ credentials: falKey });

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'] }));
app.use(express.json({ limit: '10mb' }));

function ts() { return new Date().toISOString(); }
function logError(ctx, err) { console.error(`[${ts()}] [${ctx}]`, err.message || err); }
function logInfo(ctx, msg) { console.log(`[${ts()}] [${ctx}]`, msg); }
function strip(b64) { return b64.replace(/^data:image\/\w+;base64,/, ''); }

function mapOpenAIError(error) {
  if (!error.status) {
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout'))
      return { status: 504, message: "Generation timed out. Try with 'low' quality." };
    return { status: 500, message: 'An unexpected error occurred. Please try again.' };
  }
  switch (error.status) {
    case 401: return { status: 401, message: 'Invalid API key. Check your .env file.' };
    case 429: return { status: 429, message: 'Rate limit exceeded. Please wait and try again.' };
    case 400: {
      const m = error.message?.toLowerCase() || '';
      if (m.includes('content_policy') || m.includes('safety') || m.includes('flagged'))
        return { status: 400, message: 'Content policy violation. Try something different.' };
      return { status: 400, message: 'Could not process. Try clearing and redrawing.' };
    }
    case 500: case 502: case 503:
      return { status: 502, message: 'OpenAI is experiencing issues. Try again in a minute.' };
    default:
      return { status: error.status, message: error.message || 'An unexpected error occurred.' };
  }
}

// ─── Vision Analysis ─────────────────────────────────────────────────────────
// Now MORE important than ever — the text description is the ONLY input to the
// image generator. Must be detailed enough to produce a complete image.

const VISION_PROMPT = `You are a creative art director analyzing a rough hand-drawn sketch from a simple drawing app.

Your job is to produce a COMPLETE, VIVID description that an image generator can use to create a stunning professional image — WITHOUT seeing the original sketch.

Your description MUST include:
1. WHAT the subject is (be specific — not "a face" but "a friendly young woman with round cheeks and bright eyes")
2. The POSE or ORIENTATION (facing forward, profile view, three-quarter angle, etc.)
3. KEY FEATURES visible in the sketch (any details the user included intentionally)
4. COMPOSITION (centered, off to the side, close-up, full body, etc.)
5. A suggested ENVIRONMENT or BACKGROUND that fits the subject naturally
6. MOOD and ATMOSPHERE (cheerful, dramatic, peaceful, energetic, etc.)

Example good descriptions:
- Sketch of a face → "A warm, friendly character with a perfectly round face, two large expressive oval eyes with bright highlights, and a wide cheerful smile. Centered head-and-shoulders composition. Warm, inviting personality radiating joy, placed against a soft warm-toned background."
- Sketch of pants → "A pair of well-fitted casual blue jeans with straight legs and natural drape, viewed from the front. Classic five-pocket design with subtle knee fading. Fashion product shot on a clean minimalist background with soft studio lighting."
- Sketch of a house → "A charming two-story cottage with a steep triangular roof, warm-lit windows, and a welcoming front door with a small porch. Nestled in a peaceful green garden with a stone path. Late afternoon golden hour lighting with a warm sky."
- Sketch of a cat → "An adorable domestic cat with alert pointed ears, large round curious eyes, and delicate whiskers, sitting upright with its tail curled around its paws. Soft natural lighting in a cozy indoor setting."

CRITICAL: Your description must be detailed enough that someone could create the image WITHOUT ever seeing the sketch. Fill in textures, materials, lighting, atmosphere that simple lines can't convey.

Respond with ONLY the description (3-4 sentences). No preamble, no "I see", no "This appears to be".`;

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

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function suggestEnvironment(subject) {
  const s = subject.toLowerCase();
  if (/face|person|character|man|woman|boy|girl|child|figure|portrait/.test(s))
    return 'Place against a complementary background — soft professional gradient or contextual environment. NOT plain white.';
  if (/cat|dog|animal|bird|fish|pet|bunny|rabbit|horse/.test(s))
    return 'Place in natural habitat or warm, inviting setting.';
  if (/house|building|castle|church|tower|cabin|cottage/.test(s))
    return 'Set in appropriate landscape with sky, ground, and atmospheric depth.';
  if (/car|truck|vehicle|bus|train|airplane|boat|ship|bicycle/.test(s))
    return 'Place in appropriate setting — road, runway, ocean — with context and depth.';
  if (/tree|flower|plant|garden|forest|mountain|landscape|nature/.test(s))
    return 'Full natural scene with sky, ground, atmospheric perspective.';
  if (/food|cake|pizza|fruit|drink|coffee|cup|plate/.test(s))
    return 'Appetizing food photography — attractive surface, warm lighting, subtle depth of field.';
  if (/pants|jeans|shirt|dress|clothes|fashion|shoe|jacket|skirt/.test(s))
    return 'Professional fashion product photography — clean studio setup, soft directional lighting, neutral or minimal background.';
  if (/sun|moon|star|cloud|sky|rainbow/.test(s))
    return 'Full atmospheric sky scene with rich colors and depth.';
  return 'Add appropriate, contextual background with depth and atmosphere. NOT plain white.';
}

function buildPrompt(subject, stylePrompt, promptOverride) {
  const description = promptOverride || subject;

  if (description) {
    const env = suggestEnvironment(description);
    return `Create a STUNNING, publication-quality artwork from scratch.

SUBJECT: ${description}

STYLE: ${stylePrompt}

ENVIRONMENT: ${env}

REQUIREMENTS:
- Create a BRAND NEW professional image — do NOT trace or reference any sketch
- EXCEPTIONAL detail, depth, and professional quality throughout
- Clear lighting with defined light source, realistic shadows, and highlights
- Rich textures appropriate to every material (skin, fabric, metal, wood, fur, etc.)
- Depth and dimension — three-dimensional, NOT flat
- Professional composition with proper proportions
- The quality of professional concept art, editorial illustration, or studio photography

DO NOT create simple, flat, clipart-like, emoji-like, or icon-like images.
DO NOT use plain white backgrounds unless the style demands it.
Push for MAXIMUM quality and detail.`;
  }

  return `Create a stunning professional artwork. ${stylePrompt} Rich detail, professional lighting, textures, appropriate background. NOT flat clipart.`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', hasOpenAI: Boolean(openaiKey), hasFal: Boolean(falKey), timestamp: ts() });
});

// ─── Realtime: fal.ai SDXL Lightning ─────────────────────────────────────────

app.post('/api/realtime-generate', async (req, res) => {
  if (!falKey) return res.status(503).json({ error: 'fal.ai not configured.' });
  try {
    const { imageBase64, prompt, strength = 0.65 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
    const raw = strip(imageBase64);
    const startMs = Date.now();
    const result = await fal.subscribe('fal-ai/fast-lightning-sdxl/image-to-image', {
      input: {
        image_url: `data:image/jpeg;base64,${raw}`,
        prompt: prompt || 'Professional artwork, high quality, detailed',
        strength, num_inference_steps: 4, image_size: 'square_hd', enable_safety_checker: true,
      },
    });
    const latency = Date.now() - startMs;
    const outputUrl = result.data?.images?.[0]?.url;
    if (!outputUrl) return res.status(502).json({ error: 'fal.ai returned no image.' });
    const imgRes = await fetch(outputUrl);
    const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
    logInfo('realtime', `Generated in ${latency}ms`);
    res.json({ imageBase64: b64, latency });
  } catch (error) {
    logError('realtime', error);
    res.status(500).json({ error: error.message || 'Realtime generation failed.' });
  }
});

// ─── PRIMARY: Text-to-image generation (NO sketch as input) ──────────────────
// This is the KEY architectural change. We use images.generate() which creates
// a NEW image from TEXT ONLY. The sketch is used ONLY for the vision analysis
// step — it never touches the image generator.

app.post('/api/generate', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, prompt, quality = 'low', size = '1024x1024', promptOverride } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Missing required fields' });

    const rawBase64 = strip(imageBase64);

    // Step 1: Vision analysis — sketch is ONLY used here for understanding
    let detectedSubject = null;
    if (!promptOverride) {
      logInfo('generate', 'Step 1: Analyzing sketch with vision...');
      detectedSubject = await analyzeSketch(rawBase64);
    } else {
      logInfo('generate', `Using prompt override: "${promptOverride}"`);
    }

    // Step 2: Generate NEW image from TEXT ONLY — no sketch input!
    logInfo('generate', 'Step 2: Generating image from text (images.generate)...');
    const finalPrompt = buildPrompt(detectedSubject, prompt, promptOverride);

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) return res.status(502).json({ error: 'OpenAI returned empty response.' });

    logInfo('generate', 'Generation complete (text-to-image)');
    res.json({
      imageBase64: generatedBase64,
      detectedSubject: promptOverride || detectedSubject || null,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
    });
  } catch (error) {
    logError('generate', error);
    const mapped = mapOpenAIError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// ─── FALLBACK: Responses API with sketch as compositional reference ──────────
// The sketch is passed but we EXPLICITLY tell the model not to trace it.

app.post('/api/generate-v2', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, prompt, quality = 'low', size = '1024x1024', promptOverride } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Missing required fields' });

    const rawBase64 = strip(imageBase64);
    let detectedSubject = null;
    if (!promptOverride) {
      detectedSubject = await analyzeSketch(rawBase64);
    }
    const basePrompt = buildPrompt(detectedSubject, prompt, promptOverride);

    // Wrap with explicit anti-tracing instructions
    const finalPrompt = `This is a rough hand-drawn sketch showing the CONCEPT of what I want.

DO NOT trace, follow, or replicate the sketch lines. The sketch is ONLY a loose reference for what subject to create and roughly where to place it.

Instead, create a COMPLETELY NEW, professional image based on this description:

${basePrompt}

IMPORTANT: Create a brand new image from scratch. Do NOT modify, enhance, or trace the sketch. The sketch only tells you WHAT to draw, not HOW to draw it.`;

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input: [{ role: 'user', content: [
        { type: 'input_image', image_url: `data:image/png;base64,${rawBase64}` },
        { type: 'input_text', text: finalPrompt },
      ]}],
      tools: [{ type: 'image_generation', quality, size }],
    });

    const imageOutput = response.output?.find((i) => i.type === 'image_generation_call');
    if (!imageOutput?.result) return res.status(502).json({ error: 'OpenAI returned empty response.' });

    logInfo('generate-v2', 'Generation complete (responses API)');
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

// ─── Refine: image-to-image enhancement (edit API is fine here) ──────────────
// Edit API works well for REFINING an already-good image (not a rough sketch)

app.post('/api/refine', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, quality = 'medium' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    logInfo('refine', 'Refining image...');
    const rawBase64 = strip(imageBase64);
    const imageBuffer = Buffer.from(rawBase64, 'base64');
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: `Enhance and refine this image significantly. Add much more detail to every surface and texture. Improve lighting with clear light source, realistic shadows and highlights. Enhance colors to be richer and more professionally graded. Add depth and atmospheric perspective. Refine all edges and proportions. Keep the EXACT same subject, composition, and style. Make it dramatically better — like a professional artist spent hours perfecting every pixel.`,
      n: 1, size: '1024x1024', quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) return res.status(502).json({ error: 'Refine returned empty response.' });

    logInfo('refine', 'Refinement complete');
    res.json({ imageBase64: generatedBase64 });
  } catch (error) {
    logError('refine', error);
    res.status(mapOpenAIError(error).status).json({ error: mapOpenAIError(error).message });
  }
});

// ─── Server startup ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Draw It API server running on http://localhost:${PORT}`);
  console.log(`  OpenAI: ${openaiKey ? '\u2713' : '\u2717 missing'} (text-to-image mode)`);
  console.log(`  fal.ai: ${falKey ? '\u2713 realtime' : '\u2717 disabled'}\n`);
});
