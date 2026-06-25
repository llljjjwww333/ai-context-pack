import type { RepoScan, ScannedFile } from "./types.js";

export function renderMarkdown(scan: RepoScan): string {
  const lines: string[] = [];
  lines.push("# AI Context Pack");
  lines.push("");
  lines.push(`Generated: ${scan.generatedAt}`);
  lines.push(`Root: ${scan.root}`);
  lines.push("");

  lines.push("## Repository Summary");
  lines.push("");
  lines.push(`- Files considered: ${scan.stats.totalFiles}`);
  lines.push(`- Text files scanned: ${scan.stats.scannedTextFiles}`);
  lines.push(`- Important files: ${scan.stats.keyFiles}`);
  lines.push(`- Large files skipped: ${scan.stats.skippedLargeFiles}`);
  if (scan.techStack.length > 0) lines.push(`- Detected stack: ${scan.techStack.join(", ")}`);
  lines.push("");

  if (scan.config.sections.git && scan.git.available) {
    lines.push("## Git Context");
    lines.push("");
    if (scan.git.branch) lines.push(`- Branch: ${scan.git.branch}`);
    if (scan.git.changedFiles.length > 0) {
      lines.push("- Changed files:");
      for (const file of scan.git.changedFiles.slice(0, 40)) lines.push(`  - ${file}`);
    } else {
      lines.push("- Changed files: none detected");
    }
    if (scan.git.recentCommits.length > 0) {
      lines.push("- Recent commits:");
      for (const commit of scan.git.recentCommits) lines.push(`  - ${commit}`);
    }
    lines.push("");
  }

  if (scan.config.sections.scripts) {
    lines.push("## Commands");
    lines.push("");
    for (const [kind, commands] of Object.entries(scan.commands)) {
      if (commands.length === 0) continue;
      lines.push(`### ${title(kind)}`);
      lines.push("");
      for (const command of commands) lines.push(`- \`${command}\``);
      lines.push("");
    }
  }

  if (scan.config.sections.dependencies && scan.packageInfo.length > 0) {
    lines.push("## Packages and Dependencies");
    lines.push("");
    for (const pkg of scan.packageInfo) {
      lines.push(`### ${pkg.name ?? pkg.path}`);
      lines.push("");
      lines.push(`- Manifest: \`${pkg.path}\``);
      lines.push(`- Manager: ${pkg.manager}`);
      if (pkg.dependencies.length > 0) lines.push(`- Dependencies: ${pkg.dependencies.slice(0, 40).join(", ")}`);
      if (pkg.devDependencies.length > 0) lines.push(`- Dev dependencies: ${pkg.devDependencies.slice(0, 40).join(", ")}`);
      lines.push("");
    }
  }

  if (scan.envVars.length > 0) {
    lines.push("## Environment Variables");
    lines.push("");
    for (const envVar of scan.envVars.slice(0, 80)) lines.push(`- \`${envVar}\``);
    lines.push("");
  }

  if (scan.config.sections.tree) {
    lines.push("## Project Tree");
    lines.push("");
    lines.push("```text");
    lines.push(...renderTree(scan.files.map((file) => file.path), 160));
    lines.push("```");
    lines.push("");
  }

  if (scan.config.sections.files) {
    lines.push("## Important Files");
    lines.push("");
    for (const file of scan.importantFiles.slice(0, 35)) {
      lines.push(renderFile(file));
    }
  }

  if (scan.config.sections.todos && scan.todos.length > 0) {
    lines.push("## TODO and FIXME");
    lines.push("");
    for (const todo of scan.todos.slice(0, 60)) {
      lines.push(`- \`${todo.file}:${todo.line}\` ${todo.text}`);
    }
    lines.push("");
  }

  lines.push("## Suggested AI Assistant Prompt");
  lines.push("");
  lines.push("```text");
  lines.push(renderAssistantPrompt(scan));
  lines.push("```");
  lines.push("");

  return `${lines.join("\n").trim()}\n`;
}

export function renderAssistantPrompt(scan: RepoScan): string {
  const stack = scan.techStack.length > 0 ? scan.techStack.join(", ") : "unknown stack";
  const commands = Object.entries(scan.commands)
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => `${key}: ${values.slice(0, 4).join(" | ")}`)
    .join("\n");
  const keyFiles = scan.importantFiles
    .slice(0, 20)
    .map((file) => `- ${file.path}: ${file.summary ?? file.reasons.join(", ")}`)
    .join("\n");

  return [
    "You are working in this repository. Use the context below before editing.",
    "",
    `Stack: ${stack}`,
    commands ? `Commands:\n${commands}` : "Commands: none detected",
    "",
    "Important files:",
    keyFiles || "- No important files detected",
    "",
    scan.envVars.length > 0 ? `Environment variables: ${scan.envVars.slice(0, 40).join(", ")}` : "Environment variables: none detected",
    scan.git.changedFiles.length > 0 ? `Changed files: ${scan.git.changedFiles.slice(0, 40).join(", ")}` : "Changed files: none detected",
    "",
    "When making changes, prefer the existing project conventions and run the relevant commands above."
  ].join("\n");
}

function renderFile(file: ScannedFile): string {
  const lines: string[] = [];
  lines.push(`### ${file.path}`);
  lines.push("");
  lines.push(`- Size: ${file.size} bytes`);
  if (file.language) lines.push(`- Language: ${file.language}`);
  if (file.reasons.length > 0) lines.push(`- Why it matters: ${file.reasons.join(", ")}`);
  if (file.summary) lines.push(`- Summary: ${file.summary.replace(/\s+/g, " ").slice(0, 900)}`);
  if (file.symbols.length > 0) lines.push(`- Symbols: ${file.symbols.slice(0, 20).join(", ")}`);
  if (file.envVars.length > 0) lines.push(`- Env vars: ${file.envVars.slice(0, 20).join(", ")}`);
  lines.push("");
  return lines.join("\n");
}

function renderTree(paths: string[], limit: number): string[] {
  const sorted = paths.slice().sort((a, b) => a.localeCompare(b)).slice(0, limit);
  const lines = sorted.map((file) => file);
  if (paths.length > limit) lines.push(`... ${paths.length - limit} more files`);
  return lines;
}

function title(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
