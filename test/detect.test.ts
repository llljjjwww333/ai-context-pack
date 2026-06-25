import { describe, expect, it } from "vitest";
import { collectCommands, detectTechStack, parsePackageInfo } from "../src/detect.js";
import type { ScannedFile } from "../src/types.js";

describe("detect", () => {
  it("extracts package scripts and stack from package.json", () => {
    const files: ScannedFile[] = [
      {
        path: "package.json",
        size: 300,
        extension: ".json",
        isText: true,
        isKey: true,
        isLockFile: false,
        reasons: ["manifest"],
        content: JSON.stringify({
          name: "demo",
          scripts: {
            dev: "vite",
            build: "vite build",
            test: "vitest run"
          },
          dependencies: {
            react: "^19.0.0"
          },
          devDependencies: {
            typescript: "^5.0.0",
            vite: "^6.0.0"
          }
        }),
        symbols: [],
        envVars: [],
        todos: []
      }
    ];

    const packages = parsePackageInfo(files);
    const commands = collectCommands(packages);
    const stack = detectTechStack(files, packages);

    expect(packages[0]?.name).toBe("demo");
    expect(commands.dev).toEqual(["npm run dev"]);
    expect(commands.build).toEqual(["npm run build"]);
    expect(stack).toEqual(expect.arrayContaining(["Node.js", "React", "TypeScript", "Vite"]));
  });
});
