import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { renderDoctorText, runDoctor } from "../src/doctor.js";
import type { RepoScan } from "../src/types.js";

describe("doctor", () => {
  it("warns about missing agent readiness signals", () => {
    const result = runDoctor(makeScan());

    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "test-command", level: "warn" }),
        expect.objectContaining({ id: "env-example", level: "warn" }),
        expect.objectContaining({ id: "agents", level: "warn" })
      ])
    );
    expect(renderDoctorText(result)).toContain("AI agent readiness");
  });

  it("has a stable JSON shape", () => {
    const result = runDoctor(makeScan());
    const parsed = JSON.parse(JSON.stringify(result)) as typeof result;

    expect(parsed).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        ready: expect.any(Boolean),
        score: expect.any(Number),
        checks: expect.any(Array)
      })
    );
    expect(parsed.checks[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        level: expect.any(String),
        message: expect.any(String)
      })
    );
  });
});

function makeScan(): RepoScan {
  return {
    root: "C:/repo",
    generatedAt: "2026-06-25T00:00:00.000Z",
    config: DEFAULT_CONFIG,
    stats: {
      totalFiles: 4,
      scannedTextFiles: 4,
      skippedLargeFiles: 0,
      keyFiles: 6
    },
    files: [
      {
        path: "README.md",
        size: 200,
        extension: ".md",
        isText: true,
        isKey: true,
        isLockFile: false,
        reasons: ["readme"],
        symbols: [],
        envVars: [],
        todos: []
      }
    ],
    importantFiles: [],
    packageInfo: [],
    techStack: ["Node.js"],
    commands: {
      install: ["npm install"],
      dev: ["npm run dev"],
      build: [],
      test: [],
      lint: [],
      other: []
    },
    envVars: ["OPENAI_API_KEY"],
    todos: [],
    git: {
      available: false,
      changedFiles: [],
      recentCommits: []
    }
  };
}
