import os from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export function getUserDataDir() {
  const configured = process.env.PUPPETEER_USER_DATA_DIR?.trim();
  if (!configured) {
    const legacyRepoProfile = path.join(process.cwd(), "chrome-profile");
    if (existsSync(legacyRepoProfile)) {
      return legacyRepoProfile;
    }

    return path.join(os.homedir(), ".nextbot", "chrome-profile");
  }

  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function resolveChromeExecutable() {
  if (process.env.CHROME_EXECUTABLE_PATH) {
    return process.env.CHROME_EXECUTABLE_PATH;
  }

  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
  ];

  return candidates[0];
}

function getRuntimeDir() {
  return path.join(process.cwd(), ".nextbot");
}

function getSessionFilePath() {
  return path.join(getRuntimeDir(), "browser-session.json");
}

export async function writeBrowserSession(data: {
  port: number;
  targetUrl: string;
  userDataDir: string;
  executablePath: string;
}) {
  await mkdir(getRuntimeDir(), { recursive: true });
  await writeFile(getSessionFilePath(), JSON.stringify(data, null, 2), "utf8");
}

export async function readBrowserSession(): Promise<null | {
  port: number;
  targetUrl: string;
  userDataDir: string;
  executablePath: string;
}> {
  try {
    const raw = await readFile(getSessionFilePath(), "utf8");
    return JSON.parse(raw) as {
      port: number;
      targetUrl: string;
      userDataDir: string;
      executablePath: string;
    };
  } catch {
    return null;
  }
}
