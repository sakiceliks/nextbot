import { spawn } from "node:child_process";

import { getUserDataDir, readBrowserSession, resolveChromeExecutable, writeBrowserSession } from "@/lib/browser";

type BrowserLaunchMode = "home" | "login" | "post-ad";
const REMOTE_DEBUGGING_PORT = 9222;

function getLaunchUrl(mode: BrowserLaunchMode) {
  switch (mode) {
    case "login":
      return "https://banaozel.sahibinden.com/giris";
    case "post-ad":
      return "https://banaozel.sahibinden.com/ilan-ver/adim-1?state=new";
    case "home":
    default:
      return "https://www.sahibinden.com";
  }
}

async function getExistingSessionPort() {
  const session = await readBrowserSession();
  if (!session?.port) {
    return null;
  }

  try {
    const response = await fetch(`http://127.0.0.1:${session.port}/json/version`, {
      cache: "no-store"
    });

    return response.ok ? session.port : null;
  } catch {
    return null;
  }
}

async function openTargetInExistingChrome(port: number, targetUrl: string) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/json/new?${new URLSearchParams({ url: targetUrl }).toString()}`,
      { method: "PUT" }
    );

    return response.ok;
  } catch {
    return false;
  }
}

export async function openChromeSession(mode: BrowserLaunchMode) {
  const executablePath = resolveChromeExecutable();
  const userDataDir = getUserDataDir();
  const targetUrl = getLaunchUrl(mode);
  const existingPort = await getExistingSessionPort();

  if (existingPort) {
    await openTargetInExistingChrome(existingPort, targetUrl);

    await writeBrowserSession({
      port: existingPort,
      targetUrl,
      userDataDir,
      executablePath
    });

    return {
      executablePath,
      userDataDir,
      targetUrl,
      port: existingPort
    };
  }

  const child = spawn(
    executablePath,
    [
      `--user-data-dir=${userDataDir}`,
      `--remote-debugging-port=${REMOTE_DEBUGGING_PORT}`,
      "--start-maximized",
      targetUrl
    ],
    {
      detached: true,
      stdio: "ignore"
    }
  );

  child.unref();

  await writeBrowserSession({
    port: REMOTE_DEBUGGING_PORT,
    targetUrl,
    userDataDir,
    executablePath
  });

  return {
    executablePath,
    userDataDir,
    targetUrl,
    port: REMOTE_DEBUGGING_PORT
  };
}
