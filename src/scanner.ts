import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { maybeSummarizeFiles, heuristicSummary } from "./ai.js";
import { loadConfig } from "./config.js";
import {
  collectCommands,
  detectLanguage,
  detectTechStack,
  extractEnvVars,
  extractSymbols,
  extractTodos,
  isLockFile,
  keyFileReasons,
  parsePackageInfo
} from "./detect.js";
import { getGitInfo } from "./git.js";
import type { AppConfig, RepoScan, ScannedFile } from "./types.js";

export type ScanOptions = {
  cwd: string;
  diffOnly?: boolean;
  aiEnabled?: boolean;
};

const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".env",
  ".go",
  ".graphql",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".php",
  ".prisma",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);

const TEXT_FILENAMES = new Set([
  "dockerfile",
  "makefile",
  "procfile",
  ".env",
  ".gitignore",
  ".dockerignore",
  ".env.example",
  ".env.sample"
]);

export async function scanRepository(options: ScanOptions): Promise<RepoScan> {
  const cwd = path.resolve(options.cwd);
  const config = await loadConfig(cwd);
  const git = await getGitInfo(cwd);
  const entries = await fg(config.include, {
    cwd,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: config.exclude,
    unique: true
  });

  const changedSet = new Set(git.changedFiles.map(normalizePath));
  const selectedEntries = options.diffOnly && changedSet.size > 0
    ? entries.filter((entry) => changedSet.has(normalizePath(entry)) || keyFileReasons(entry).some((reason) => reason === "manifest" || reason === "readme"))
    : entries;

  const files: ScannedFile[] = [];
  let skippedLargeFiles = 0;

  for (const entry of selectedEntries.slice(0, 5000)) {
    const absolute = path.join(cwd, entry);
    const fileStat = await stat(absolute);
    const relativePath = normalizePath(entry);
    const extension = path.extname(relativePath).toLowerCase();
    const lockFile = isLockFile(relativePath);
    const textLike = isTextLike(relativePath);
    const reasons = keyFileReasons(relativePath);
    const file: ScannedFile = {
      path: relativePath,
      size: fileStat.size,
      extension,
      isText: textLike,
      isKey: reasons.length > 0,
      isLockFile: lockFile,
      reasons,
      language: detectLanguage(relativePath),
      symbols: [],
      envVars: [],
      todos: []
    };

    if (textLike && !lockFile && fileStat.size <= config.maxFileBytes) {
      file.content = await readTextFile(absolute);
      file.symbols = extractSymbols(relativePath, file.content);
      file.envVars = extractEnvVars(file.content);
      file.todos = extractTodos(relativePath, file.content);
      file.summary = heuristicSummary(file);
    } else if (fileStat.size > config.maxFileBytes) {
      skippedLargeFiles += 1;
      file.summary = `Skipped content because file is larger than ${config.maxFileBytes} bytes.`;
    } else if (lockFile) {
      file.summary = "Lock file detected; content intentionally omitted.";
    }

    if (file.symbols.length > 0 || file.envVars.length > 0 || file.todos.length > 0) {
      file.isKey = true;
      if (!file.reasons.includes("contains signals")) file.reasons.push("contains signals");
    }

    files.push(file);
  }

  const configuredModel: AppConfig["model"] = {
    ...config.model,
    enabled: config.model.enabled && options.aiEnabled !== false
  };
  await maybeSummarizeFiles(files, configuredModel);

  const packageInfo = parsePackageInfo(files);
  const techStack = detectTechStack(files, packageInfo);
  const commands = collectCommands(packageInfo);
  const importantFiles = rankImportantFiles(files).slice(0, 80);
  const envVars = [...new Set(files.flatMap((file) => file.envVars))].sort();
  const todos = files.flatMap((file) => file.todos).slice(0, 120);

  return {
    root: cwd,
    generatedAt: new Date().toISOString(),
    config: {
      ...config,
      model: configuredModel
    },
    stats: {
      totalFiles: selectedEntries.length,
      scannedTextFiles: files.filter((file) => Boolean(file.content)).length,
      skippedLargeFiles,
      keyFiles: importantFiles.length
    },
    files,
    importantFiles,
    packageInfo,
    techStack,
    commands,
    envVars,
    todos,
    git
  };
}

export async function writeCache(scan: RepoScan): Promise<void> {
  const cachePath = path.join(scan.root, scan.config.output.cache);
  await mkdir(path.dirname(cachePath), { recursive: true });
  const compact = {
    generatedAt: scan.generatedAt,
    root: scan.root,
    stats: scan.stats,
    techStack: scan.techStack,
    git: scan.git,
    importantFiles: scan.importantFiles.map((file) => ({
      path: file.path,
      size: file.size,
      reasons: file.reasons,
      summary: file.summary,
      symbols: file.symbols
    }))
  };
  await writeFile(cachePath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
}

function rankImportantFiles(files: ScannedFile[]): ScannedFile[] {
  return [...files].sort((a, b) => scoreFile(b) - scoreFile(a));
}

function scoreFile(file: ScannedFile): number {
  let score = 0;
  score += file.reasons.length * 20;
  score += file.symbols.length * 2;
  score += file.envVars.length * 3;
  score += file.todos.length * 4;
  if (file.path.toLowerCase().includes("test")) score += 4;
  if (file.path.toLowerCase().includes("config")) score += 8;
  if (file.path.toLowerCase().endsWith("readme.md")) score += 30;
  if (file.path.toLowerCase().endsWith("package.json")) score += 35;
  if (file.size > 0 && file.size < 50000) score += 2;
  return score;
}

function isTextLike(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || TEXT_FILENAMES.has(name);
}

async function readTextFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  if (buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0)) {
    return "";
  }
  return buffer.toString("utf8");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
