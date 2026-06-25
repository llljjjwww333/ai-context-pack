import path from "node:path";
import type { PackageInfo, ScannedFile } from "./types.js";

export function detectLanguage(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const byExt: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".cs": "C#",
    ".php": "PHP",
    ".rb": "Ruby",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".sql": "SQL",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS"
  };
  return byExt[ext];
}

export function isLockFile(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  return [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "poetry.lock",
    "uv.lock",
    "cargo.lock",
    "composer.lock"
  ].includes(name);
}

export function keyFileReasons(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, "/");
  const name = path.basename(normalized).toLowerCase();
  const reasons: string[] = [];

  if (name === "readme.md") reasons.push("readme");
  if (["package.json", "pyproject.toml", "requirements.txt", "go.mod", "cargo.toml"].includes(name)) {
    reasons.push("manifest");
  }
  if (["vite.config.ts", "vite.config.js", "next.config.js", "next.config.mjs", "nuxt.config.ts"].includes(name)) {
    reasons.push("frontend config");
  }
  if (["dockerfile", "docker-compose.yml", "compose.yml", "render.yaml"].includes(name)) {
    reasons.push("deployment config");
  }
  if (/(\.env\.example|\.env\.sample|example\.env)$/i.test(name)) reasons.push("environment template");
  if (/src\/(main|index|app|server)\.(ts|tsx|js|jsx|py)$/i.test(normalized)) reasons.push("entrypoint");
  if (/(routes?|controllers?|api)\//i.test(normalized)) reasons.push("route or api");
  if (/(schema|model|migration|prisma)\//i.test(normalized) || /schema\.prisma$/i.test(normalized)) {
    reasons.push("data model");
  }

  return reasons;
}

export function extractSymbols(filePath: string, content: string): string[] {
  const symbols = new Set<string>();
  const patterns = [
    /\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g,
    /\bexport\s+const\s+([A-Za-z0-9_]+)/g,
    /\bfunction\s+([A-Za-z0-9_]+)/g,
    /\bclass\s+([A-Za-z0-9_]+)/g,
    /\b(?:GET|POST|PUT|PATCH|DELETE)\s*\(/g,
    /\bapp\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)/g,
    /\brouter\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)/g,
    /\bdef\s+([A-Za-z0-9_]+)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[2]) symbols.add(`${match[1].toUpperCase()} ${match[2]}`);
      else if (match[1]) symbols.add(match[1]);
      else if (match[0]) symbols.add(match[0].replace(/\s+/g, " "));
      if (symbols.size >= 20) return [...symbols];
    }
  }

  if (symbols.size === 0 && path.extname(filePath).toLowerCase() === ".md") {
    for (const match of content.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      symbols.add(match[1].trim());
      if (symbols.size >= 12) break;
    }
  }

  return [...symbols];
}

export function extractEnvVars(content: string): string[] {
  const vars = new Set<string>();
  const patterns = [
    /process\.env\.([A-Z0-9_]+)/g,
    /process\.env\[['"]([A-Z0-9_]+)['"]\]/g,
    /import\.meta\.env\.([A-Z0-9_]+)/g,
    /os\.environ\.get\(['"]([A-Z0-9_]+)['"]\)/g,
    /\b([A-Z][A-Z0-9_]{2,})=/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      vars.add(match[1]);
      if (vars.size >= 60) return [...vars];
    }
  }

  return [...vars];
}

export function extractTodos(filePath: string, content: string) {
  const todos = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
      todos.push({
        file: filePath,
        line: index + 1,
        text: line.trim().slice(0, 240)
      });
    }
    if (todos.length >= 100) break;
  }
  return todos;
}

export function parsePackageInfo(files: ScannedFile[]): PackageInfo[] {
  const packages: PackageInfo[] = [];

  for (const file of files) {
    const name = path.basename(file.path).toLowerCase();
    if (!file.content) continue;

    if (name === "package.json") {
      try {
        const parsed = JSON.parse(file.content) as {
          name?: string;
          scripts?: Record<string, string>;
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          packageManager?: string;
        };
        packages.push({
          path: file.path,
          manager: managerFromPackageJson(parsed.packageManager, files),
          name: parsed.name,
          scripts: parsed.scripts ?? {},
          dependencies: Object.keys(parsed.dependencies ?? {}),
          devDependencies: Object.keys(parsed.devDependencies ?? {})
        });
      } catch {
        packages.push({
          path: file.path,
          manager: "unknown",
          scripts: {},
          dependencies: [],
          devDependencies: []
        });
      }
    }

    if (name === "pyproject.toml") {
      packages.push({
        path: file.path,
        manager: "python",
        name: matchFirst(file.content, /^name\s*=\s*["']([^"']+)["']/m),
        scripts: {},
        dependencies: extractTomlDependencies(file.content),
        devDependencies: []
      });
    }

    if (name === "requirements.txt") {
      packages.push({
        path: file.path,
        manager: "python",
        scripts: {},
        dependencies: file.content
          .split(/\r?\n/)
          .map((line) => line.trim().split(/[=<>~!]/)[0])
          .filter((line) => line && !line.startsWith("#")),
        devDependencies: []
      });
    }

    if (name === "go.mod") {
      packages.push({
        path: file.path,
        manager: "go",
        name: matchFirst(file.content, /^module\s+(.+)$/m),
        scripts: {},
        dependencies: [...file.content.matchAll(/^\s*([A-Za-z0-9_.\-\/]+)\s+v[0-9]/gm)].map((match) => match[1]),
        devDependencies: []
      });
    }

    if (name === "cargo.toml") {
      packages.push({
        path: file.path,
        manager: "rust",
        name: matchFirst(file.content, /^name\s*=\s*["']([^"']+)["']/m),
        scripts: {},
        dependencies: extractTomlDependencies(file.content),
        devDependencies: []
      });
    }
  }

  return packages;
}

export function detectTechStack(files: ScannedFile[], packages: PackageInfo[]): string[] {
  const stack = new Set<string>();
  const paths = new Set(files.map((file) => file.path.replace(/\\/g, "/").toLowerCase()));
  const deps = new Set(packages.flatMap((pkg) => [...pkg.dependencies, ...pkg.devDependencies]).map((dep) => dep.toLowerCase()));

  if (paths.has("package.json")) stack.add("Node.js");
  if (deps.has("typescript") || files.some((file) => file.extension === ".ts" || file.extension === ".tsx")) stack.add("TypeScript");
  if (deps.has("react")) stack.add("React");
  if (deps.has("vue")) stack.add("Vue");
  if (deps.has("svelte")) stack.add("Svelte");
  if (deps.has("next")) stack.add("Next.js");
  if (deps.has("vite") || [...paths].some((item) => item.includes("vite.config"))) stack.add("Vite");
  if (deps.has("express")) stack.add("Express");
  if (deps.has("fastify")) stack.add("Fastify");
  if (deps.has("prisma") || paths.has("prisma/schema.prisma")) stack.add("Prisma");
  if (paths.has("pyproject.toml") || paths.has("requirements.txt") || files.some((file) => file.extension === ".py")) stack.add("Python");
  if (deps.has("fastapi")) stack.add("FastAPI");
  if (deps.has("django")) stack.add("Django");
  if (paths.has("go.mod")) stack.add("Go");
  if (paths.has("cargo.toml")) stack.add("Rust");
  if (paths.has("dockerfile") || paths.has("docker-compose.yml") || paths.has("compose.yml")) stack.add("Docker");
  if (paths.has("render.yaml")) stack.add("Render");

  return [...stack].sort();
}

export function collectCommands(packages: PackageInfo[]): Record<string, string[]> {
  const commands: Record<string, string[]> = {
    install: [],
    dev: [],
    build: [],
    test: [],
    lint: [],
    other: []
  };

  for (const pkg of packages) {
    if (pkg.manager === "npm") commands.install.push("npm install");
    if (pkg.manager === "pnpm") commands.install.push("pnpm install");
    if (pkg.manager === "yarn") commands.install.push("yarn install");
    if (pkg.manager === "bun") commands.install.push("bun install");
    if (pkg.manager === "python") commands.install.push("pip install -r requirements.txt");
    if (pkg.manager === "go") commands.install.push("go mod download");
    if (pkg.manager === "rust") commands.install.push("cargo fetch");

    for (const [script, command] of Object.entries(pkg.scripts)) {
      const prefix = pkg.manager === "pnpm" ? "pnpm" : pkg.manager === "yarn" ? "yarn" : pkg.manager === "bun" ? "bun" : "npm run";
      const full = `${prefix} ${script}`;
      if (/^(dev|start|serve)$/i.test(script)) commands.dev.push(full);
      else if (/build/i.test(script)) commands.build.push(full);
      else if (/test|spec|e2e/i.test(script)) commands.test.push(full);
      else if (/lint|format|check/i.test(script)) commands.lint.push(full);
      else commands.other.push(`${full} # ${command}`);
    }
  }

  for (const key of Object.keys(commands)) {
    commands[key] = [...new Set(commands[key])];
  }

  return commands;
}

function managerFromPackageJson(packageManager: string | undefined, files: ScannedFile[]): PackageInfo["manager"] {
  if (packageManager?.startsWith("pnpm")) return "pnpm";
  if (packageManager?.startsWith("yarn")) return "yarn";
  if (packageManager?.startsWith("bun")) return "bun";
  if (files.some((file) => path.basename(file.path).toLowerCase() === "pnpm-lock.yaml")) return "pnpm";
  if (files.some((file) => path.basename(file.path).toLowerCase() === "yarn.lock")) return "yarn";
  if (files.some((file) => path.basename(file.path).toLowerCase() === "bun.lockb")) return "bun";
  return "npm";
}

function extractTomlDependencies(content: string): string[] {
  const deps = new Set<string>();
  const lines = content.split(/\r?\n/);
  let inDeps = false;

  for (const line of lines) {
    const arrayMatch = line.match(/^\s*dependencies\s*=\s*\[(.*)\]/);
    if (arrayMatch) {
      for (const match of arrayMatch[1].matchAll(/["']([A-Za-z0-9_.\-]+)(?:[<>=~! ].*)?["']/g)) {
        deps.add(match[1]);
      }
      continue;
    }

    if (/^\[(project\.)?dependencies\]/.test(line) || /^\[tool\.poetry\.dependencies\]/.test(line)) inDeps = true;
    else if (/^\[/.test(line)) inDeps = false;

    if (inDeps) {
      const match = line.match(/^\s*["']?([A-Za-z0-9_.\-]+)["']?\s*[=,]/);
      if (match && match[1].toLowerCase() !== "python") deps.add(match[1]);
    }
  }

  return [...deps];
}

function matchFirst(content: string, pattern: RegExp): string | undefined {
  return content.match(pattern)?.[1]?.trim();
}
