import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { renderAgents } from "../src/renderAgents.js";
import type { RepoScan } from "../src/types.js";

describe("renderAgents", () => {
  it("renders Codex-friendly AGENTS.md guidance", () => {
    const content = renderAgents(makeScan(), { linkContext: true });

    expect(content).toContain("# AGENTS.md");
    expect(content).toContain("Detected stack: Node.js, TypeScript");
    expect(content).toContain("Install: `npm install`");
    expect(content).toContain("Test: `npm test`");
    expect(content).toContain("`AI_CONTEXT.md`");
    expect(content).toContain("src/index.ts");
    expect(content).not.toContain("`AGENTS.md` -");
  });

  it("respects the configured max byte limit", () => {
    const content = renderAgents(makeScan(), { maxBytes: 900 });

    expect(Buffer.byteLength(content, "utf8")).toBeLessThanOrEqual(900);
  });
});

function makeScan(): RepoScan {
  return {
    root: "C:/repo",
    generatedAt: "2026-06-25T00:00:00.000Z",
    config: DEFAULT_CONFIG,
    stats: {
      totalFiles: 8,
      scannedTextFiles: 6,
      skippedLargeFiles: 0,
      keyFiles: 3
    },
    files: [],
    importantFiles: [
      {
        path: "AGENTS.md",
        size: 300,
        extension: ".md",
        isText: true,
        isKey: true,
        isLockFile: false,
        reasons: ["contains signals"],
        language: "Markdown",
        summary: "Existing generated agent instructions.",
        symbols: [],
        envVars: [],
        todos: []
      },
      {
        path: "package.json",
        size: 200,
        extension: ".json",
        isText: true,
        isKey: true,
        isLockFile: false,
        reasons: ["manifest"],
        language: "JSON",
        summary: "Package manifest with scripts and dependencies.",
        symbols: [],
        envVars: [],
        todos: []
      },
      {
        path: "src/index.ts",
        size: 400,
        extension: ".ts",
        isText: true,
        isKey: true,
        isLockFile: false,
        reasons: ["entrypoint"],
        language: "TypeScript",
        summary: "CLI entrypoint.",
        symbols: ["runScan"],
        envVars: [],
        todos: []
      }
    ],
    packageInfo: [],
    techStack: ["Node.js", "TypeScript"],
    commands: {
      install: ["npm install"],
      dev: ["npm run dev"],
      build: ["npm run build"],
      test: ["npm test"],
      lint: ["npm run typecheck"],
      other: []
    },
    envVars: ["OPENAI_API_KEY"],
    todos: [],
    git: {
      available: true,
      branch: "main",
      changedFiles: [],
      recentCommits: []
    }
  };
}
