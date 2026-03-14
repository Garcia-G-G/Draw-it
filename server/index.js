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
        return { status: 400, message: 'Your drawing was flagged by content policy. Try something different.' };
      return { status: 400, message: 'Could not process the image. Try clearing and redrawing.' };
    }
    case 500: case 502: case 503:
      return { status: 502, message: 'OpenAI is experiencing issues. Try again in a minute.' };
    default:
      return { status: error.status, message: error.message || 'An unexpected error occurred.' };
  }
}

// ─── Vision Analysis (Creative, detail-filling) ──────────────────────────────

const VISION_PROMPT = `You are a creative art director analyzing a rough hand-drawn sketch from a simple drawing app.

The drawing is INTENTIONALLY rough and simple — it was made with a mouse or touchscreen, not by a professional artist. Your job is to interpret what the user INTENDED to draw and describe it richly.

RULES:
1. Be SPECIFIC and CREATIVE. Don't just describe lines — describe the CHARACTER, MOOD, and SCENE.
2. FILL IN THE BLANKS. If someone drew a simple face, describe it as a full character with personality.
3. SUGGEST ENVIRONMENT. If the subject could plausibly exist somewhere, describe that setting.
4. ADD PERSONALITY. Give subjects emotion, energy, and life.

Examples of good interpretation:
- Two vertical lines + curve = "A cheerful, friendly character with bright round eyes and a wide, warm smile, radiating happiness"
- Triangle on square = "A cozy two-story cottage with a pointed roof, nestled in a peaceful green neighborhood with a small front garden"
- Circle with rays = "A brilliant golden sun with warm radiating beams, shining brightly in a clear blue sky"
- Stick figure = "A lively person standing confidently with arms slightly outstretched, full of energy and optimism"
- Circle + triangle ears = "An adorable cat with perky pointed ears and curious whisker-tipped face, sitting attentively"
- Vertical line + cloud top = "A majestic oak tree with a full, lush green canopy and a strong brown trunk, standing in a sunlit meadow"

CRITICAL: Always assume intentionality. Every line means something. A rough circle IS a face/ball/sun. Two triangles on a circle ARE cat ears. Be generous in your interpretation.

Respond with ONLY the rich description (2-3 sentences). No preamble, no "I see", no "This appears to be".`;

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

// ─── HD Prompt Builder (with environment intelligence) ───────────────────────

function suggestEnvironment(subject) {
  const s = subject.toLowerCase();
  if (/face|person|character|man|woman|boy|girl|child|figure|portrait/.test(s))
    return 'Place the subject against a complementary background — a soft, professional gradient or a contextual environment that enhances the character. NOT plain white.';
  if (/cat|dog|animal|bird|fish|pet|bunny|rabbit|horse/.test(s))
    return 'Place the animal in its natural habitat or a warm, inviting setting that suits the creature.';
  if (/house|building|castle|church|tower|cabin|cottage/.test(s))
    return 'Set the building in an appropriate landscape — a neighborhood, countryside, hillside, or scenic environment with sky, ground, and atmospheric depth.';
  if (/car|truck|vehicle|bus|train|airplane|boat|ship|bicycle/.test(s))
    return 'Place the vehicle in an appropriate setting — a road, runway, ocean, or scene that gives context and depth.';
  if (/tree|flower|plant|garden|forest|mountain|landscape|nature/.test(s))
    return 'Create a full natural scene with sky, ground, atmospheric perspective, and complementary natural elements.';
  if (/food|cake|pizza|fruit|drink|coffee|cup|plate/.test(s))
    return 'Present as appetizing food photography — on an attractive surface with warm, inviting lighting and subtle depth of field.';
  if (/sun|moon|star|cloud|sky|rainbow|weather/.test(s))
    return 'Create a full atmospheric sky scene with rich colors, depth, and complementary celestial elements.';
  return 'Add an appropriate, contextual background that complements the subject. NOT a plain white background — add depth, atmosphere, and visual interest.';
}

function buildHDPrompt(subject, stylePrompt, promptOverride) {
  const description = promptOverride || subject;

  if (description) {
    const env = suggestEnvironment(description);
    return `You are creating a STUNNING, publication-quality artwork. This must look like it was made by a top professional artist.

SUBJECT: ${description}

STYLE: ${stylePrompt}

ENVIRONMENT: ${env}

ABSOLUTE REQUIREMENTS — follow every single one:
- EXCEPTIONAL detail, depth, and professional quality throughout
- Clear lighting with defined light source, realistic shadows, and highlights
- Rich textures appropriate to every material (skin, fabric, metal, wood, fur, etc.)
- Depth and dimension — the image must feel three-dimensional, NOT flat
- Professional composition with proper proportions and visual balance
- The quality of professional concept art, editorial illustration, or studio photography

CRITICAL — DO NOT:
- Do NOT create a simple, flat, clipart-like, or emoji-like image
- Do NOT use plain white backgrounds (unless the style specifically demands it)
- Do NOT make it look like a basic icon, sticker, or children's doodle
- Do NOT create a minimal or lazy interpretation — push for MAXIMUM quality and detail`;
  }

  return `Transform this sketch into a STUNNING professional artwork. ${stylePrompt} Add rich detail, professional lighting, textures, and an appropriate background. Do NOT create flat clipart.`;
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

// ─── HD Generate: Two-step (Vision → Image) ─────────────────────────────────

app.post('/api/generate', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, prompt, quality = 'low', size = '1024x1024', promptOverride } = req.body;
    if (!imageBase64 || !prompt) return res.status(400).json({ error: 'Missing required fields' });

    const rawBase64 = strip(imageBase64);

    // Step 1: Vision (skip if user provided manual override)
    let detectedSubject = null;
    if (!promptOverride) {
      logInfo('generate', 'Step 1: Analyzing sketch...');
      detectedSubject = await analyzeSketch(rawBase64);
    } else {
      logInfo('generate', `Using prompt override: "${promptOverride}"`);
    }

    // Step 2: Generate
    logInfo('generate', 'Step 2: Generating HD image...');
    const finalPrompt = buildHDPrompt(detectedSubject, prompt, promptOverride);

    const imageBuffer = Buffer.from(rawBase64, 'base64');
    const imageFile = await toFile(imageBuffer, 'sketch.png', { type: 'image/png' });

    const response = await openai.images.edit({
      model: 'gpt-image-1', image: imageFile, prompt: finalPrompt, n: 1, size, quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) return res.status(502).json({ error: 'OpenAI returned empty response.' });

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

// ─── HD Fallback: Responses API ──────────────────────────────────────────────

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
    const finalPrompt = buildHDPrompt(detectedSubject, prompt, promptOverride);

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

// ─── Refine: image-to-image enhancement pass ─────────────────────────────────

app.post('/api/refine', async (req, res) => {
  if (!openai) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env' });
  try {
    const { imageBase64, quality = 'medium' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    logInfo('refine', 'Refining image...');
    const rawBase64 = strip(imageBase64);
    const imageBuffer = Buffer.from(rawBase64, 'base64');
    const imageFile = await toFile(imageBuffer, 'image.png', { type: 'image/png' });

    const refinePrompt = `Enhance and refine this image significantly. Make it look like a masterpiece:
- Add much more detail to every surface and texture
- Improve the lighting — add clear light source with realistic shadows and highlights
- Enhance colors to be richer, more vibrant, and more professionally graded
- Add depth — sharpen foreground, add atmospheric perspective to background
- Refine all edges, shapes, and proportions to look more professional
- Add subtle environmental details that make the scene feel alive and complete
- The final result should look like a professional artist spent hours perfecting every pixel
Keep the EXACT same subject, composition, and style. Just make it dramatically better.`;

    const response = await openai.images.edit({
      model: 'gpt-image-1', image: imageFile, prompt: refinePrompt, n: 1, size: '1024x1024', quality,
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
  console.log(`  OpenAI: ${openaiKey ? '\u2713' : '\u2717 missing'}`);
  console.log(`  fal.ai: ${falKey ? '\u2713 realtime' : '\u2717 disabled'}\n`);
});
