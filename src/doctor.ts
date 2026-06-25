import type { RepoScan } from "./types.js";

export type DoctorLevel = "pass" | "warn" | "fail";

export type DoctorCheck = {
  id: string;
  level: DoctorLevel;
  message: string;
  fix?: string;
};

export type DoctorResult = {
  generatedAt: string;
  ready: boolean;
  score: number;
  checks: DoctorCheck[];
};

export function runDoctor(scan: RepoScan): DoctorResult {
  const checks: DoctorCheck[] = [
    checkReadme(scan),
    checkAgents(scan),
    checkTestCommand(scan),
    checkBuildOrLint(scan),
    checkEnvExample(scan),
    checkGit(scan),
    checkImportantFiles(scan),
    checkInstallCommand(scan)
  ];
  const passed = checks.filter((check) => check.level === "pass").length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    ready: checks.every((check) => check.level !== "fail") && score >= 70,
    score,
    checks
  };
}

export function renderDoctorText(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push(`AI agent readiness: ${result.ready ? "ready" : "needs work"} (${result.score}/100)`);
  lines.push("");

  for (const check of result.checks) {
    const icon = check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : "FAIL";
    lines.push(`[${icon}] ${check.message}`);
    if (check.fix) lines.push(`      Fix: ${check.fix}`);
  }

  return `${lines.join("\n")}\n`;
}

function checkReadme(scan: RepoScan): DoctorCheck {
  const hasReadme = scan.files.some((file) => file.path.toLowerCase().endsWith("readme.md"));
  return hasReadme
    ? { id: "readme", level: "pass", message: "README.md is present." }
    : { id: "readme", level: "warn", message: "README.md was not found.", fix: "Add a README with setup, commands, and project purpose." };
}

function checkAgents(scan: RepoScan): DoctorCheck {
  const target = scan.config.output.agents.toLowerCase();
  const hasAgents = scan.files.some((file) => file.path.toLowerCase() === target);
  return hasAgents
    ? { id: "agents", level: "pass", message: `${scan.config.output.agents} is present for Codex instructions.` }
    : {
        id: "agents",
        level: "warn",
        message: `${scan.config.output.agents} was not found.`,
        fix: "Run `ai-context-pack agents --write` to create Codex-ready repository instructions."
      };
}

function checkTestCommand(scan: RepoScan): DoctorCheck {
  const hasTests = (scan.commands.test ?? []).length > 0;
  return hasTests
    ? { id: "test-command", level: "pass", message: "A test command was detected." }
    : { id: "test-command", level: "warn", message: "No test command was detected.", fix: "Add a test script or document the relevant validation command in AGENTS.md." };
}

function checkBuildOrLint(scan: RepoScan): DoctorCheck {
  const hasBuild = (scan.commands.build ?? []).length > 0;
  const hasLint = (scan.commands.lint ?? []).length > 0;
  return hasBuild || hasLint
    ? { id: "build-or-lint", level: "pass", message: "Build or lint/check command was detected." }
    : { id: "build-or-lint", level: "warn", message: "No build or lint/check command was detected.", fix: "Add build/lint scripts or document manual validation steps." };
}

function checkEnvExample(scan: RepoScan): DoctorCheck {
  const hasEnvVars = scan.envVars.length > 0;
  const hasExample = scan.files.some((file) => /\.env\.(example|sample)$/i.test(file.path) || /example\.env$/i.test(file.path));
  if (!hasEnvVars) return { id: "env-example", level: "pass", message: "No environment variables were detected." };
  return hasExample
    ? { id: "env-example", level: "pass", message: "Environment variables and an env example file were detected." }
    : { id: "env-example", level: "warn", message: "Environment variables were detected but no env example file was found.", fix: "Add `.env.example` with placeholder values." };
}

function checkGit(scan: RepoScan): DoctorCheck {
  return scan.git.available
    ? { id: "git", level: "pass", message: "Git context is available." }
    : { id: "git", level: "warn", message: "Git context is unavailable.", fix: "Run inside a Git repository to enable branch, diff, and recent commit context." };
}

function checkImportantFiles(scan: RepoScan): DoctorCheck {
  if (scan.stats.keyFiles >= 3) {
    return { id: "important-files", level: "pass", message: `${scan.stats.keyFiles} important files were detected.` };
  }

  return scan.stats.keyFiles > 0
    ? { id: "important-files", level: "warn", message: "Few important files were detected.", fix: "Confirm include/exclude settings or add README/manifests/config files." }
    : { id: "important-files", level: "fail", message: "No important files were detected.", fix: "Confirm include/exclude settings or add README/manifests/config files." };
}

function checkInstallCommand(scan: RepoScan): DoctorCheck {
  const hasInstall = (scan.commands.install ?? []).length > 0;
  return hasInstall
    ? { id: "install-command", level: "pass", message: "Install command was detected." }
    : { id: "install-command", level: "warn", message: "No install command was detected.", fix: "Add a recognized manifest or document setup steps in AGENTS.md." };
}
