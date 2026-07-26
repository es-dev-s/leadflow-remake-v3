#!/usr/bin/env node
/**
 * Boots Next with PORT / HOST from .env.local (Next itself ignores PORT in .env).
 * Usage: node scripts/run-next.cjs dev | start | …
 */
const { spawn } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

function loadEnvFile(filePath, into) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (into[key] === undefined && process.env[key] === undefined) {
      into[key] = val;
    }
  }
}

const root = resolve(__dirname, "..");
const fileEnv = {};
loadEnvFile(resolve(root, ".env"), fileEnv);
loadEnvFile(resolve(root, ".env.local"), fileEnv);

const port =
  String(process.env.PORT || fileEnv.PORT || "3100").replace(/\D/g, "") ||
  "3100";
const host = process.env.HOSTNAME || fileEnv.HOSTNAME || "0.0.0.0";

const mode = process.argv[2] || "dev";
const extra = process.argv.slice(3);
const args = [mode, "-H", host, "-p", port, ...extra];

console.log(
  `[leadflow-ui] next ${mode} → http://${host === "0.0.0.0" ? "localhost" : host}:${port}`,
);

const child = spawn("npx", ["next", ...args], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...fileEnv, PORT: port, HOSTNAME: host },
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
