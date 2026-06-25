import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitInfo } from "./types.js";

const execFileAsync = promisify(execFile);

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  try {
    const [branch, changed, untracked, commits] = await Promise.all([
      git(["branch", "--show-current"], cwd),
      git(["diff", "--name-only", "--relative", "HEAD"], cwd),
      git(["ls-files", "--others", "--exclude-standard"], cwd),
      git(["log", "--oneline", "-5"], cwd)
    ]);

    const changedFiles = uniqueLines(`${changed}\n${untracked}`);
    return {
      available: true,
      branch: branch.trim() || undefined,
      changedFiles,
      recentCommits: uniqueLines(commits)
    };
  } catch {
    return {
      available: false,
      changedFiles: [],
      recentCommits: []
    };
  }
}

async function git(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 1024 * 1024 * 8,
    windowsHide: true
  });
  return result.stdout;
}

function uniqueLines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}
