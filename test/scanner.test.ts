import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepository } from "../src/scanner.js";

describe("scanner ranking", () => {
  it("prioritizes source entrypoints above readme and manifests for coding context", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "ai-context-pack-rank-"));
    try {
      await writeFile(path.join(cwd, "README.md"), "# Demo\n\nA useful project.", "utf8");
      await writeFile(
        path.join(cwd, "package.json"),
        JSON.stringify({
          name: "demo",
          scripts: { test: "node src/index.js" },
          dependencies: {}
        }),
        "utf8"
      );
      await mkdir(path.join(cwd, "src"));
      await writeFile(
        path.join(cwd, "src", "index.ts"),
        "export function runApp() {\n  return 'ok';\n}\n",
        "utf8"
      );

      const scan = await scanRepository({ cwd, aiEnabled: false });
      const paths = scan.importantFiles.map((file) => file.path);

      expect(paths.indexOf("src/index.ts")).toBeLessThan(paths.indexOf("README.md"));
      expect(paths.indexOf("src/index.ts")).toBeLessThan(paths.indexOf("package.json"));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
