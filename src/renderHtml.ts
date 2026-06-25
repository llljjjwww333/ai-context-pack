import type { RepoScan } from "./types.js";

export function renderHtml(scan: RepoScan): string {
  const importantRows = scan.importantFiles
    .slice(0, 60)
    .map(
      (file) => `<tr><td><code>${escapeHtml(file.path)}</code></td><td>${escapeHtml(file.reasons.join(", ") || "signals")}</td><td>${escapeHtml((file.summary ?? "").slice(0, 260))}</td></tr>`
    )
    .join("\n");
  const commandRows = Object.entries(scan.commands)
    .filter(([, commands]) => commands.length > 0)
    .map(
      ([kind, commands]) => `<tr><td>${escapeHtml(kind)}</td><td>${commands.map((command) => `<code>${escapeHtml(command)}</code>`).join("<br>")}</td></tr>`
    )
    .join("\n");
  const todoRows = scan.todos
    .slice(0, 50)
    .map((todo) => `<li><code>${escapeHtml(todo.file)}:${todo.line}</code> ${escapeHtml(todo.text)}</li>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Context Pack</title>
  <style>
    :root { color-scheme: light; --bg: #f6f7f9; --panel: #ffffff; --text: #17202a; --muted: #607086; --line: #dbe1e8; --accent: #1967d2; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
    header { background: #111827; color: white; padding: 32px 40px; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 24px 56px; }
    h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 20px; }
    p { color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .metric, section { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .metric { padding: 16px; }
    .metric strong { display: block; font-size: 24px; margin-bottom: 4px; }
    .metric span { color: var(--muted); font-size: 13px; }
    section { padding: 18px; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    code { background: #eef2f7; border-radius: 4px; padding: 2px 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    ul { margin: 0; padding-left: 20px; }
    .stack { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { background: #e8f0fe; color: #174ea6; border: 1px solid #c6dafc; border-radius: 999px; padding: 5px 10px; font-size: 13px; }
    @media (max-width: 820px) { header { padding: 24px; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .grid { grid-template-columns: 1fr; } table { font-size: 13px; } }
  </style>
</head>
<body>
  <header>
    <h1>AI Context Pack</h1>
    <p>Generated ${escapeHtml(scan.generatedAt)} for ${escapeHtml(scan.root)}</p>
  </header>
  <main>
    <div class="grid">
      <div class="metric"><strong>${scan.stats.totalFiles}</strong><span>Files considered</span></div>
      <div class="metric"><strong>${scan.stats.scannedTextFiles}</strong><span>Text files scanned</span></div>
      <div class="metric"><strong>${scan.stats.keyFiles}</strong><span>Important files</span></div>
      <div class="metric"><strong>${scan.stats.skippedLargeFiles}</strong><span>Large files skipped</span></div>
    </div>

    <section>
      <h2>Detected Stack</h2>
      <div class="stack">${scan.techStack.length > 0 ? scan.techStack.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("") : "<p>No stack detected.</p>"}</div>
    </section>

    <section>
      <h2>Commands</h2>
      <table><thead><tr><th>Kind</th><th>Commands</th></tr></thead><tbody>${commandRows || "<tr><td colspan=\"2\">No commands detected.</td></tr>"}</tbody></table>
    </section>

    <section>
      <h2>Git</h2>
      <p>${scan.git.available ? `Branch: ${escapeHtml(scan.git.branch ?? "unknown")}` : "Git data unavailable."}</p>
      <p>${scan.git.changedFiles.length > 0 ? `Changed files: ${escapeHtml(scan.git.changedFiles.slice(0, 50).join(", "))}` : "No changed files detected."}</p>
    </section>

    <section>
      <h2>Important Files</h2>
      <table><thead><tr><th>File</th><th>Reason</th><th>Summary</th></tr></thead><tbody>${importantRows || "<tr><td colspan=\"3\">No important files detected.</td></tr>"}</tbody></table>
    </section>

    <section>
      <h2>TODO and FIXME</h2>
      <ul>${todoRows || "<li>No TODO/FIXME items detected.</li>"}</ul>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
