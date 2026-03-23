import { NAI_BASE_URL, getToken } from "./config.mjs";

function arrayBufferToBase64(arrayBuffer) {
  return Buffer.from(arrayBuffer).toString("base64");
}

export async function novelAiRequest(path, body) {
  const token = getToken();

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Please use Node.js 18 or newer.");
  }

  const url = `${NAI_BASE_URL}${path}`;
  console.error(`[NovelAI] POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
      "accept": "application/json, text/event-stream, application/zip, application/octet-stream"
    },
    body: JSON.stringify(body)
  });

  const contentType = response.headers.get("content-type") || "";
  console.error(
    `[NovelAI] ${response.status} ${response.statusText} content-type=${contentType}`
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `NovelAI request failed: ${response.status} ${response.statusText}\nResponse body:\n${text || "<empty body>"}`
    );
  }

  if (contentType.includes("application/json")) {
    const text = await response.text();
    try {
      return {
        mode: "json",
        contentType,
        data: JSON.parse(text)
      };
    } catch {
      throw new Error(`JSON parse failed. Raw response:\n${text}`);
    }
  }

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    const events = [];
    const texts = [];

    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload);
        events.push(parsed);

        const choices = Array.isArray(parsed?.choices) ? parsed.choices : [];
        for (const choice of choices) {
          if (typeof choice?.text === "string") texts.push(choice.text);
          if (typeof choice?.delta?.text === "string") texts.push(choice.delta.text);
          if (typeof choice?.delta?.content === "string") texts.push(choice.delta.content);
          if (typeof choice?.message?.content === "string") texts.push(choice.message.content);
        }
      } catch {
        events.push({ raw: payload });
      }
    }

    return {
      mode: "sse",
      contentType,
      text: texts.join(""),
      events,
      raw: text
    };
  }

  const arrayBuffer = await response.arrayBuffer();

  return {
    mode: "binary",
    contentType,
    size: arrayBuffer.byteLength,
    base64: arrayBufferToBase64(arrayBuffer)
  };
}