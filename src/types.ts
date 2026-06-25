export type SectionFlags = {
  tree: boolean;
  scripts: boolean;
  dependencies: boolean;
  git: boolean;
  todos: boolean;
  files: boolean;
};

export type OutputConfig = {
  markdown: string;
  html: string;
  cache: string;
  agents: string;
};

export type ModelConfig = {
  enabled: boolean;
  baseUrl: string;
  apiKeyEnv: string;
  name: string;
  maxInputChars: number;
};

export type AgentsConfig = {
  maxBytes: number;
  linkContext: boolean;
};

export type AppConfig = {
  include: string[];
  exclude: string[];
  maxFileBytes: number;
  output: OutputConfig;
  agents: AgentsConfig;
  model: ModelConfig;
  sections: SectionFlags;
};

export type PackageInfo = {
  path: string;
  manager: "npm" | "pnpm" | "yarn" | "bun" | "python" | "go" | "rust" | "unknown";
  name?: string;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
};

export type GitInfo = {
  available: boolean;
  branch?: string;
  changedFiles: string[];
  recentCommits: string[];
};

export type TodoItem = {
  file: string;
  line: number;
  text: string;
};

export type ScannedFile = {
  path: string;
  size: number;
  extension: string;
  isText: boolean;
  isKey: boolean;
  isLockFile: boolean;
  reasons: string[];
  language?: string;
  content?: string;
  summary?: string;
  symbols: string[];
  envVars: string[];
  todos: TodoItem[];
};

export type RepoStats = {
  totalFiles: number;
  scannedTextFiles: number;
  skippedLargeFiles: number;
  keyFiles: number;
};

export type RepoScan = {
  root: string;
  generatedAt: string;
  config: AppConfig;
  stats: RepoStats;
  files: ScannedFile[];
  importantFiles: ScannedFile[];
  packageInfo: PackageInfo[];
  techStack: string[];
  commands: Record<string, string[]>;
  envVars: string[];
  todos: TodoItem[];
  git: GitInfo;
};
