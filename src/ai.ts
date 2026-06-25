import type { ModelConfig, ScannedFile } from "./types.js";

export async function maybeSummarizeFiles(files: ScannedFile[], model: ModelConfig): Promise<ScannedFile[]> {
  const apiKey = process.env[model.apiKeyEnv];
  if (!model.enabled || !apiKey) return files;

  const candidates = files
    .filter((file) => file.content && file.content.length > 6000 && file.isKey)
    .slice(0, 8);

  for (const file of candidates) {
    try {
      file.summary = await summarizeContent(file.path, file.content ?? "", model, apiKey);
    } catch {
      file.summary = heuristicSummary(file);
    }
  }

  return files;
}

export function heuristicSummary(file: ScannedFile): string {
  if (file.symbols.length > 0) {
    return `Defines: ${file.symbols.slice(0, 12).join(", ")}`;
  }
  if (!file.content) return "Metadata only; content was not included.";

  const headings = [...file.content.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((match) => match[1].trim())
    .slice(0, 8);
  if (headings.length > 0) return `Sections: ${headings.join(", ")}`;

  const lines = file.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");
  return lines.slice(0, 480) || "No compact summary available.";
}

async function summarizeContent(path: string, content: string, model: ModelConfig, apiKey: string): Promise<string> {
  const endpoint = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: model.name,
    messages: [
      {
        role: "system",
        content:
          "Summarize repository files for an AI coding assistant. Be concise. Mention responsibilities, public interfaces, env vars, and risky details."
      },
      {
        role: "user",
        content: `File: ${path}\n\n${content.slice(0, model.maxInputChars)}`
      }
    ],
    temperature: 0.1
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() || "";
}
