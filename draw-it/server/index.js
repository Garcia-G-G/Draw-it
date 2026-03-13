import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI, { toFile } from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_TIMEOUT_MS = 60_000;

const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS }) : null;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'] }));
app.use(express.json({ limit: '10mb' }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString();
}

function logError(context, error) {
  console.error(`[${ts()}] [${context}]`, error.message || error);
}

function logInfo(context, msg) {
  console.log(`[${ts()}] [${context}]`, msg);
}

function stripDataUrlPrefix(base64) {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

function mapOpenAIError(error) {
  if (!error.status) {
    if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
      return { status: 504, message: "Generation timed out. Try with 'low' quality." };
    }
    return { status: 500, message: 'An unexpected error occurred. Please try again.' };
  }
  switch (error.status) {
    case 401:
      return { status: 401, message: 'Invalid API key. Check your .env file.' };
    case 429: {
      const retryAfter = error.headers?.['retry-after'];
      const suffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : '';
      return { status: 429, message: `Rate limit exceeded. Please wait and try again.${suffix}` };
    }
    case 400: {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('content_policy') || msg.includes('safety') || msg.includes('flagged')) {
        return { status: 400, message: 'Your drawing was flagged by content policy. Try something different.' };
      }
      return { status: 400, message: 'Could not process the image. Try clearing and redrawing.' };
    }
    case 500: case 502: case 503:
      return { status: 502, message: 'OpenAI is experiencing issues. Try again in a minute.' };
    default:
      return { status: error.status, message: error.message || 'An unexpected error occurred.' };
  }
}

function requireApiKey(_req, res, next) {
  if (!openai) {
    return res.status(503).json({ error: 'Server not configured. Set OPENAI_API_KEY in .env' });
  }
  next();
}

// ─── Step 1: Vision Analysis ─────────────────────────────────────────────────

const VISION_PROMPT = `You are analyzing a rough hand-drawn sketch made in a simple drawing app (like MS Paint).
The drawing is intentionally rough and simple — it's NOT meant to be high quality.

Your job is to identify what the user was TRYING to draw. Look at the shapes, lines, and overall composition.

Describe what this sketch depicts in one detailed sentence. Be specific about:
- What the subject/object is
- Its position and composition
- Any notable features or details you can identify
- The overall scene or context

Common patterns in rough sketches:
- Two vertical lines with a curve below = a smiley face
- A triangle on top of a square = a house
- A circle with lines radiating out = a sun
- A circle with two triangles on top = a cat face
- A vertical line with a cloud shape on top = a tree
- Five-pointed angular shape = a star

IMPORTANT: Always assume the user drew something intentional. Even very rough lines have meaning.

Respond with ONLY the description, nothing else.
Example: "A smiling face with two oval eyes and a wide curved smile, drawn in a simple cartoon style."`;

async function analyzeSketch(rawBase64) {
  try {
    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${rawBase64}`,
            },
            {
              type: 'input_text',
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    });

    // Extract text from the response
    const textOutput = response.output?.find((item) => item.type === 'message');
    const description = textOutput?.content?.find((c) => c.type === 'output_text')?.text?.trim();

    if (!description || description.length < 5) {
      logInfo('vision', 'Vision returned empty/short response, using fallback');
      return null;
    }

    logInfo('vision', `Detected: "${description}"`);
    return description;
  } catch (error) {
    logError('vision', error);
    return null;
  }
}

// ─── Step 2: Build Generation Prompt ─────────────────────────────────────────

function buildGenerationPrompt(detectedSubject, stylePrompt) {
  if (detectedSubject) {
    return `Create a professional, high-quality image of: ${detectedSubject}

Style: ${stylePrompt}

Important instructions:
- The image must depict EXACTLY what is described above
- Maintain the same composition and layout as the original sketch
- Make it look polished, refined, and professionally created
- Add appropriate details, shading, lighting, and depth for the chosen style`;
  }

  // Fallback: generic prompt if vision failed
  return `Transform this rough sketch into a professional, polished version. Keep the same subject, composition, and layout. ${stylePrompt}`;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: ts(),
  });
});

// Primary: Two-step pipeline (Vision + Images Edit API)
app.post('/api/generate', requireApiKey, async (req, res) => {
  try {
    const { imageBase64, prompt, quality = 'low', size = '1024x1024' } = req.body;

    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: 'Missing required fields: imageBase64, prompt' });
    }

    const rawBase64 = stripDataUrlPrefix(imageBase64);

    // Step 1: Vision analysis
    logInfo('generate', 'Step 1: Analyzing sketch with vision...');
    const detectedSubject = await analyzeSketch(rawBase64);

    // Step 2: Generate image
    logInfo('generate', 'Step 2: Generating image...');
    const finalPrompt = buildGenerationPrompt(detectedSubject, prompt);

    const imageBuffer = Buffer.from(rawBase64, 'base64');
    const imageFile = await toFile(imageBuffer, 'sketch.png', { type: 'image/png' });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: finalPrompt,
      n: 1,
      size,
      quality,
    });

    const generatedBase64 = response.data?.[0]?.b64_json;
    if (!generatedBase64) {
      logError('generate', new Error('No image data in OpenAI response'));
      return res.status(502).json({ error: 'OpenAI returned an empty response. Try again.' });
    }

    res.json({
      imageBase64: generatedBase64,
      detectedSubject: detectedSubject || null,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
    });
  } catch (error) {
    logError('generate', error);
    const mapped = mapOpenAIError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// Fallback: Two-step pipeline (Vision + Responses API)
app.post('/api/generate-v2', requireApiKey, async (req, res) => {
  try {
    const { imageBase64, prompt, quality = 'low', size = '1024x1024' } = req.body;

    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: 'Missing required fields: imageBase64, prompt' });
    }

    const rawBase64 = stripDataUrlPrefix(imageBase64);

    // Step 1: Vision analysis
    logInfo('generate-v2', 'Step 1: Analyzing sketch with vision...');
    const detectedSubject = await analyzeSketch(rawBase64);

    // Step 2: Generate image via Responses API
    logInfo('generate-v2', 'Step 2: Generating image...');
    const finalPrompt = buildGenerationPrompt(detectedSubject, prompt);

    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${rawBase64}`,
            },
            {
              type: 'input_text',
              text: finalPrompt,
            },
          ],
        },
      ],
      tools: [
        {
          type: 'image_generation',
          quality,
          size,
        },
      ],
    });

    const imageOutput = response.output?.find(
      (item) => item.type === 'image_generation_call',
    );

    if (!imageOutput?.result) {
      logError('generate-v2', new Error('No image_generation_call in response output'));
      return res.status(502).json({ error: 'OpenAI returned an empty response. Try again.' });
    }

    res.json({
      imageBase64: imageOutput.result,
      detectedSubject: detectedSubject || null,
      revisedPrompt: null,
    });
  } catch (error) {
    logError('generate-v2', error);
    const mapped = mapOpenAIError(error);
    res.status(mapped.status).json({ error: mapped.message });
  }
});

// ─── Server startup ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const keyStatus = apiKey ? '✓ API key configured' : '✗ API key missing — set OPENAI_API_KEY in .env';
  console.log(`\n  Draw It API server running on http://localhost:${PORT}`);
  console.log(`  Pipeline: Two-step (Vision Analysis → Image Generation)`);
  console.log(`  ${keyStatus}\n`);
});
