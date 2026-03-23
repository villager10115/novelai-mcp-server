export function logError(prefix, error) {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[${new Date().toISOString()}] ${prefix}: ${message}`);
}

export function okText(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

export function jsonText(obj) {
  return okText(JSON.stringify(obj, null, 2));
}