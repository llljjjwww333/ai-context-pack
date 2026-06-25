#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { writeDefaultConfig } from "./config.js";
import { renderDoctorText, runDoctor } from "./doctor.js";
import { renderAgents } from "./renderAgents.js";
import { renderHtml } from "./renderHtml.js";
import { renderAssistantPrompt, renderMarkdown } from "./renderMarkdown.js";
import { scanRepository, writeCache } from "./scanner.js";

const program = new Command();

program
  .name("ai-context-pack")
  .description("Generate compact AI-ready context packs for software repositories.")
  .version("0.1.0");

program
  .command("init")
  .description("Create ai-context.config.json in the target repository.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .action(async (options: { cwd: string }) => {
    const target = await writeDefaultConfig(path.resolve(options.cwd));
    console.log(`Config ready: ${target}`);
  });

program
  .command("scan", { isDefault: true })
  .description("Scan the current repository and write AI_CONTEXT.md, ai-context.html, and cache.json.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .option("--no-ai", "Disable optional OpenAI-compatible summaries")
  .option("--markdown <path>", "Markdown output path")
  .option("--html <path>", "HTML output path")
  .action(async (options: ScanCommandOptions) => {
    await runScan({ ...options, diffOnly: false });
  });

program
  .command("diff")
  .description("Generate context focused on current Git changes.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .option("--no-ai", "Disable optional OpenAI-compatible summaries")
  .option("--markdown <path>", "Markdown output path")
  .option("--html <path>", "HTML output path")
  .action(async (options: ScanCommandOptions) => {
    await runScan({ ...options, diffOnly: true });
  });

program
  .command("prompt")
  .description("Print a compact prompt that can be pasted into an AI coding assistant.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .option("--diff", "Focus on current Git changes")
  .option("--no-ai", "Disable optional OpenAI-compatible summaries")
  .action(async (options: { cwd: string; diff?: boolean; ai?: boolean }) => {
    const scan = await scanRepository({
      cwd: path.resolve(options.cwd),
      diffOnly: Boolean(options.diff),
      aiEnabled: options.ai
    });
    console.log(renderAssistantPrompt(scan));
  });

program
  .command("agents")
  .description("Generate Codex-ready AGENTS.md instructions from repository signals.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .option("--write", "Write AGENTS.md instead of printing to stdout")
  .option("--link-context", "Link to the detailed AI_CONTEXT.md report")
  .option("--no-link-context", "Do not link to the detailed AI_CONTEXT.md report")
  .option("--no-ai", "Disable optional OpenAI-compatible summaries")
  .action(async (options: AgentsCommandOptions) => {
    const cwd = path.resolve(options.cwd);
    const scan = await scanRepository({
      cwd,
      aiEnabled: options.ai
    });
    const content = renderAgents(scan, {
      linkContext: options.linkContext,
      maxBytes: scan.config.agents.maxBytes
    });

    if (!options.write) {
      console.log(content);
      return;
    }

    const agentsPath = path.resolve(cwd, scan.config.output.agents);
    await mkdir(path.dirname(agentsPath), { recursive: true });
    await writeFile(agentsPath, content, "utf8");
    console.log(`Wrote ${path.relative(cwd, agentsPath) || agentsPath}`);
  });

program
  .command("doctor")
  .description("Check whether the repository is ready for AI coding agents.")
  .option("-c, --cwd <path>", "Repository directory", process.cwd())
  .option("--json", "Print machine-readable JSON")
  .option("--no-ai", "Disable optional OpenAI-compatible summaries")
  .action(async (options: DoctorCommandOptions) => {
    const scan = await scanRepository({
      cwd: path.resolve(options.cwd),
      aiEnabled: options.ai
    });
    const result = runDoctor(scan);
    console.log(options.json ? JSON.stringify(result, null, 2) : renderDoctorText(result));
    if (result.checks.some((check) => check.level === "fail")) process.exitCode = 1;
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ai-context-pack failed: ${message}`);
  process.exitCode = 1;
});

type ScanCommandOptions = {
  cwd: string;
  ai?: boolean;
  markdown?: string;
  html?: string;
};

type AgentsCommandOptions = {
  cwd: string;
  write?: boolean;
  linkContext?: boolean;
  ai?: boolean;
};

type DoctorCommandOptions = {
  cwd: string;
  json?: boolean;
  ai?: boolean;
};

async function runScan(options: ScanCommandOptions & { diffOnly: boolean }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const scan = await scanRepository({
    cwd,
    diffOnly: options.diffOnly,
    aiEnabled: options.ai
  });

  const markdownPath = path.resolve(cwd, options.markdown ?? scan.config.output.markdown);
  const htmlPath = path.resolve(cwd, options.html ?? scan.config.output.html);
  await mkdir(path.dirname(markdownPath), { recursive: true });
  await mkdir(path.dirname(htmlPath), { recursive: true });

  await writeFile(markdownPath, renderMarkdown(scan), "utf8");
  await writeFile(htmlPath, renderHtml(scan), "utf8");
  await writeCache(scan);

  console.log(`Wrote ${path.relative(cwd, markdownPath) || markdownPath}`);
  console.log(`Wrote ${path.relative(cwd, htmlPath) || htmlPath}`);
  console.log(`Wrote ${scan.config.output.cache}`);
  console.log(`Detected stack: ${scan.techStack.join(", ") || "unknown"}`);
  console.log(`Important files: ${scan.stats.keyFiles}`);
}
