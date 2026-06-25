import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./types.js";

export const DEFAULT_CONFIG: AppConfig = {
  include: ["**/*"],
  exclude: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    ".next/**",
    "coverage/**",
    ".turbo/**",
    ".vercel/**",
    ".ai-context/**",
    "AI_CONTEXT*.md",
    "ai-context*.html",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.webp",
    "*.ico",
    "*.pdf",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.7z",
    "*.exe",
    "*.dll"
  ],
  maxFileBytes: 120000,
  output: {
    markdown: "AI_CONTEXT.md",
    html: "ai-context.html",
    cache: ".ai-context/cache.json",
    agents: "AGENTS.md"
  },
  agents: {
    maxBytes: 32768,
    linkContext: true
  },
  model: {
    enabled: true,
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    name: "gpt-4.1-mini",
    maxInputChars: 24000
  },
  sections: {
    tree: true,
    scripts: true,
    dependencies: true,
    git: true,
    todos: true,
    files: true
  }
};

export async function loadConfig(cwd: string): Promise<AppConfig> {
  const configPath = path.join(cwd, "ai-context.config.json");
  try {
    await access(configPath);
  } catch {
    return DEFAULT_CONFIG;
  }

  const raw = await readFile(configPath, "utf8");
  const userConfig = JSON.parse(raw) as Partial<AppConfig>;
  return mergeConfig(DEFAULT_CONFIG, userConfig);
}

export async function writeDefaultConfig(cwd: string): Promise<string> {
  const target = path.join(cwd, "ai-context.config.json");
  try {
    await access(target);
    return target;
  } catch {
    await writeFile(target, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
    return target;
  }
}

function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    include: override.include ?? base.include,
    exclude: override.exclude ?? base.exclude,
    maxFileBytes: override.maxFileBytes ?? base.maxFileBytes,
    output: { ...base.output, ...override.output },
    agents: { ...base.agents, ...override.agents },
    model: { ...base.model, ...override.model },
    sections: { ...base.sections, ...override.sections }
  };
}
