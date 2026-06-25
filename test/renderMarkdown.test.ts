import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { renderAssistantPrompt, renderMarkdown } from "../src/renderMarkdown.js";
import type { RepoScan } from "../src/types.js";

describe("renderMarkdown", () => {
  it("renders key repository context", () => {
    const scan: RepoScan = {
      root: "C:/repo",
      generatedAt: "2026-06-25T00:00:00.000Z",
      config: DEFAULT_CONFIG,
      stats: {
        totalFiles: 3,
        scannedTextFiles: 2,
        skippedLargeFiles: 0,
        keyFiles: 1
      },
      files: [],
      importantFiles: [
        {
          path: "package.json",
          size: 200,
          extension: ".json",
          isText: true,
          isKey: true,
          isLockFile: false,
          reasons: ["manifest"],
          language: "JSON",
          summary: "Package manifest.",
          symbols: [],
          envVars: [],
          todos: []
        }
      ],
      packageInfo: [],
      techStack: ["Node.js", "TypeScript"],
      commands: {
        install: ["npm install"],
        dev: ["npm run dev"],
        build: [],
        test: ["npm test"],
        lint: [],
        other: []
      },
      envVars: ["OPENAI_API_KEY"],
      todos: [],
      git: {
        available: true,
        branch: "main",
        changedFiles: ["src/index.ts"],
        recentCommits: ["abc123 test"]
      }
    };

    const markdown = renderMarkdown(scan);
    expect(markdown).toContain("AI Context Pack");
    expect(markdown).toContain("Node.js, TypeScript");
    expect(markdown).toContain("npm run dev");
    expect(markdown).toContain("package.json");
    expect(renderAssistantPrompt(scan)).toContain("OPENAI_API_KEY");
  });
});
