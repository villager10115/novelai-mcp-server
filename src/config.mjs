export const NAI_BASE_URL =
  process.env.NOVELAI_BASE_URL || "https://api.novelai.net";

export const NAI_IMAGE_BASE_URL =
  process.env.NOVELAI_IMAGE_BASE_URL || "https://image.novelai.net";

export function getToken() {
  const token =
    process.env.NOVELAI_TOKEN ||
    process.env.NAI_PERSISTENT_TOKEN ||
    process.env.NOVELAI_KEY ||
    "";

  if (!token) {
    throw new Error(
      "Missing NovelAI token. Please set NOVELAI_TOKEN (or NOVELAI_KEY) to your Persistent API Token."
    );
  }

  if (!token.startsWith("pst-")) {
    throw new Error(
      "Invalid NovelAI token format. This server expects a Persistent API Token starting with 'pst-'."
    );
  }

  return token;
}