import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import JSZip from "jszip";
import { jsonText } from "./utils.mjs";
import { getToken, NAI_IMAGE_BASE_URL } from "./config.mjs";
import { NAI_IMAGE_MODELS, NAI_IMAGE_MODEL_IDS } from "./image-models.mjs";

function makeCorrelationId(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function isV45Model(model) {
  return model.includes("4-5");
}

function getOutputDir() {
  return path.resolve(process.env.NOVELAI_IMAGE_OUTPUT_DIR || "./outputs");
}

function getPublicBaseUrl() {
  const value = (process.env.NOVELAI_IMAGE_PUBLIC_BASE_URL || "").trim();
  return value.replace(/\/+$/, "");
}

function sanitizeEntryName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "file";
}

function stripMimeParameters(contentType = "") {
  return String(contentType || "").split(";")[0].trim().toLowerCase();
}

function detectBinaryKind(buffer, contentType = "") {
  const type = stripMimeParameters(contentType);

  if (type.includes("application/zip")) {
    return { ext: "zip", mimeType: "application/zip", kind: "zip" };
  }
  if (type.includes("png")) {
    return { ext: "png", mimeType: "image/png", kind: "image" };
  }
  if (type.includes("jpeg") || type.includes("jpg")) {
    return { ext: "jpg", mimeType: "image/jpeg", kind: "image" };
  }
  if (type.includes("webp")) {
    return { ext: "webp", mimeType: "image/webp", kind: "image" };
  }

  if (buffer.length >= 4) {
    const isZip =
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04;

    if (isZip) {
      return { ext: "zip", mimeType: "application/zip", kind: "zip" };
    }
  }

  if (buffer.length >= 8) {
    const isPng =
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;

    if (isPng) {
      return { ext: "png", mimeType: "image/png", kind: "image" };
    }
  }

  if (buffer.length >= 3) {
    const isJpg =
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    if (isJpg) {
      return { ext: "jpg", mimeType: "image/jpeg", kind: "image" };
    }
  }

  if (buffer.length >= 12) {
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;

    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;

    if (isRiff && isWebp) {
      return { ext: "webp", mimeType: "image/webp", kind: "image" };
    }
  }

  return {
    ext: "bin",
    mimeType: type || "application/octet-stream",
    kind: "binary"
  };
}

function makeStampedFilename(prefix, ext) {
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}_${random}.${ext}`;
}

async function saveBufferLocally(buffer, filename) {
  const outputDir = getOutputDir();
  const localPath = path.join(outputDir, filename);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(localPath, buffer);

  return {
    filename,
    localPath,
    outputDir
  };
}

function buildPublicUrl(filename) {
  const publicBaseUrl = getPublicBaseUrl();
  if (!publicBaseUrl) {
    return null;
  }
  return `${publicBaseUrl}/${encodeURIComponent(filename)}`;
}

function buildImagePayload(input) {
  const negativePrompt = input.negative_prompt || "";

  if (isV45Model(input.model)) {
    const fullPrompt = `${input.prompt}, very aesthetic, masterpiece, best quality, rating:general`;
    const fullNegative =
      negativePrompt ||
      "lowres, bad anatomy, bad hands, text, error, missing fingers, blurry, very displeasing";

    return {
      input: fullPrompt,
      model: input.model,
      action: "generate",
      parameters: {
        params_version: 3,
        width: input.width,
        height: input.height,
        scale: 6.0,
        sampler: "k_euler_ancestral",
        steps: input.steps,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        seed: Number.isInteger(input.seed)
          ? input.seed
          : Math.floor(Math.random() * 4294967295),
        v4_prompt: {
          caption: {
            base_caption: fullPrompt,
            char_captions: []
          },
          use_coords: false,
          use_order: true
        },
        v4_negative_prompt: {
          caption: {
            base_caption: fullNegative,
            char_captions: []
          }
        },
        negative_prompt: fullNegative,
        prefer_brownian: true
      }
    };
  }

  return {
    input: input.prompt,
    model: input.model,
    action: "generate",
    parameters: {
      width: input.width,
      height: input.height,
      scale: 5.0,
      sampler: "k_euler_ancestral",
      steps: input.steps,
      uc: negativePrompt,
      ucPreset: 0,
      qualityToggle: true
    }
  };
}

async function requestImageGeneration(payload) {
  const token = getToken();
  const url = `${NAI_IMAGE_BASE_URL}/ai/generate-image`;

  console.error(`[NovelAI Image] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-correlation-id": makeCorrelationId(),
      accept: "image/png, image/jpeg, image/webp, application/zip, application/octet-stream"
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get("content-type") || "";
  console.error(
    `[NovelAI Image] ${response.status} ${response.statusText} content-type=${contentType}`
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `NovelAI request failed: ${response.status} ${response.statusText}\nResponse body:\n${text || "<empty body>"}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    contentType,
    size: arrayBuffer.byteLength,
    buffer: Buffer.from(arrayBuffer)
  };
}

async function normalizeImageResult(result, input) {
  const detected = detectBinaryKind(result.buffer, result.contentType);
  const prefix = input.filename_prefix || "nai";

  if (detected.ext === "png" || detected.ext === "jpg") {
    const filename = makeStampedFilename(prefix, detected.ext);
    return {
      kind: "direct-image",
      filename,
      mimeType: detected.mimeType,
      buffer: result.buffer,
      size: result.buffer.length,
      sourceContentType: result.contentType,
      packaged: false,
      packagedEntries: []
    };
  }

  if (detected.ext === "zip") {
    const filename = makeStampedFilename(prefix, "zip");
    return {
      kind: "zip",
      filename,
      mimeType: "application/zip",
      buffer: result.buffer,
      size: result.buffer.length,
      sourceContentType: result.contentType,
      packaged: true,
      packagedEntries: ["response.zip"]
    };
  }

  const zip = new JSZip();
  const entryName = sanitizeEntryName(`${prefix}_image.${detected.ext}`);
  zip.file(entryName, result.buffer);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });

  return {
    kind: "zip",
    filename: makeStampedFilename(prefix, "zip"),
    mimeType: "application/zip",
    buffer: zipBuffer,
    size: zipBuffer.length,
    sourceContentType: result.contentType,
    packaged: true,
    packagedEntries: [entryName],
    originalDetectedType: {
      ext: detected.ext,
      mimeType: detected.mimeType,
      kind: detected.kind
    }
  };
}

async function buildStoredResult(result, input) {
  const storage = input.output_mode || "local";
  const normalized = await normalizeImageResult(result, input);
  const saved = await saveBufferLocally(normalized.buffer, normalized.filename);
  const publicUrl = buildPublicUrl(saved.filename);

  const baseResult = {
    filename: saved.filename,
    mime_type: normalized.mimeType,
    size: normalized.size,
    source_mime_type: normalized.sourceContentType || null,
    packaged_as_zip: normalized.packaged,
    zip_entries: normalized.packagedEntries,
    original_detected_type: normalized.originalDetectedType || null
  };

  if (storage === "remote") {
    if (!publicUrl) {
      throw new Error(
        "output_mode=remote requires NOVELAI_IMAGE_PUBLIC_BASE_URL. Without a public base URL, please use output_mode=local."
      );
    }

    return {
      storage: "remote",
      ...baseResult,
      public_url: publicUrl,
      note: normalized.packaged
        ? "Response was normalized to a zip file by project policy and exposed through the public URL."
        : "Response was saved in its original png/jpg form and exposed through the public URL."
    };
  }

  if (storage === "both") {
    return {
      storage: "both",
      ...baseResult,
      local_path: saved.localPath,
      public_url: publicUrl,
      note: publicUrl
        ? normalized.packaged
          ? "Saved locally as zip and mapped to a public URL."
          : "Saved locally as png/jpg and mapped to a public URL."
        : normalized.packaged
          ? "Saved locally as zip. public_url is null because NOVELAI_IMAGE_PUBLIC_BASE_URL is not set."
          : "Saved locally as png/jpg. public_url is null because NOVELAI_IMAGE_PUBLIC_BASE_URL is not set."
    };
  }

  return {
    storage: "local",
    ...baseResult,
    local_path: saved.localPath,
    display_hint: normalized.packaged
      ? "Open the local zip file to access the generated payload."
      : "Open the local png/jpg file with your image viewer. Chat clients may not inline-render local paths."
  };
}

export function registerImageTools(server) {
  server.tool(
    "novelai_image_models",
    {},
    async () => {
      return jsonText({
        ok: true,
        models: NAI_IMAGE_MODELS,
        endpoint: `${NAI_IMAGE_BASE_URL}/ai/generate-image`
      });
    }
  );

  server.tool(
    "novelai_image_generate",
    {
      prompt: z.string().min(1),
      model: z.enum(NAI_IMAGE_MODEL_IDS).default("nai-diffusion-4-5-curated"),
      negative_prompt: z.string().optional(),
      width: z.number().int().positive().default(832),
      height: z.number().int().positive().default(1216),
      steps: z.number().int().positive().max(50).default(28),
      seed: z.number().int().optional(),
      output_mode: z.enum(["local", "remote", "both"]).default("local"),
      filename_prefix: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/).default("nai")
    },
    async (input) => {
      try {
        const payload = buildImagePayload(input);
        const result = await requestImageGeneration(payload);
        const stored = await buildStoredResult(result, input);

        return jsonText({
          ok: true,
          endpoint: `${NAI_IMAGE_BASE_URL}/ai/generate-image`,
          policy: {
            direct_return_formats: ["png", "jpg"],
            fallback_package_format: "zip"
          },
          requestPreview: {
            input: payload.input,
            model: payload.model,
            action: payload.action,
            parameters: payload.parameters
          },
          result: stored
        });
      } catch (error) {
        return jsonText({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  );
}