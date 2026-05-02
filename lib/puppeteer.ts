import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdir } from "node:fs/promises";

import puppeteer, { type Browser, type Page } from "puppeteer-core";

import {
  getUserDataDir,
  readBrowserSession,
  resolveChromeExecutable,
} from "@/lib/browser";
import type { ListingDraft, PublishMode } from "@/lib/types";

const SELECTOR_TIMEOUT_MS = 5_000;

async function tryConnectToExistingBrowser(logs: string[]) {
  const session = await readBrowserSession();
  if (!session) {
    logs.push("Kayitli browser session bulunamadi, yeni tarayıcı acilacak.");
    return null;
  }

  try {
    const response = await fetch(
      `http://127.0.0.1:${session.port}/json/version`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      logs.push(
        "Kayitli browser session endpointine ulasilamadi, yeni tarayıcı acilacak.",
      );
      return null;
    }

    const json = (await response.json()) as { webSocketDebuggerUrl?: string };
    if (!json.webSocketDebuggerUrl) {
      logs.push("Browser websocket adresi bulunamadi, yeni tarayıcı acilacak.");
      return null;
    }

    logs.push(`Mevcut tarayıcı oturumuna baglaniliyor (${session.port}).`);
    return puppeteer.connect({
      browserWSEndpoint: json.webSocketDebuggerUrl,
      defaultViewport: null,
    });
  } catch {
    logs.push(
      "Mevcut tarayıcı oturumuna baglanma denemesi basarisiz oldu, yeni tarayıcı acilacak.",
    );
    return null;
  }
}

type LogLevel = "INFO" | "WARN" | "ERROR" | "OK" | "STEP" | "DEBUG";

const LOG_EMOJI: Record<LogLevel, string> = {
  INFO: "ℹ️",
  WARN: "⚠️",
  ERROR: "❌",
  OK: "✅",
  STEP: "🔷",
  DEBUG: "🔍",
};

let _stepCounter = 0;
let _publishStartTime = 0;

function addLog(logs: string[], message: string, level: LogLevel = "INFO") {
  const now = new Date();
  const time = now.toLocaleTimeString("tr-TR", { hour12: false });
  const elapsed = _publishStartTime
    ? `+${((Date.now() - _publishStartTime) / 1000).toFixed(1)}s`
    : "";
  const prefix = `${LOG_EMOJI[level]} [${time}]${elapsed ? ` (${elapsed})` : ""}`;
  const line = `${prefix} ${message}`;
  logs.push(line);
  // Also log to server console for real-time debugging
  if (level === "ERROR") {
    console.error(`[NEXTBOT] ${line}`);
  } else if (level === "WARN") {
    console.warn(`[NEXTBOT] ${line}`);
  } else {
    console.log(`[NEXTBOT] ${line}`);
  }
}

function stepLog(logs: string[], stepName: string) {
  _stepCounter++;
  addLog(logs, `━━━ ADIM ${_stepCounter}: ${stepName} ━━━`, "STEP");
  return _stepCounter;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number,
  logs: string[],
  label: string,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        addLog(logs, `${label} — Deneme ${attempt}/${retries}`, "WARN");
      }
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      addLog(logs, `${label} — Deneme ${attempt} başarısız: ${lastError.message}`, "WARN");
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastError!;
}

async function resolveImagePath(listing: ListingDraft) {
  // Try to resolve listing.imagePath (can be absolute or relative to project root)
  if (listing.imagePath) {
    const absolutePath = path.isAbsolute(listing.imagePath) 
      ? listing.imagePath 
      : path.join(process.cwd(), listing.imagePath.replace(/^\//, ""));
    
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  const imageUrl = String(listing.imageUrl || "");
  if (!imageUrl) return null;

  // Local upload URL from this app: /uploads/<file>
  const uploadMarker = "/uploads/";
  const idx = imageUrl.indexOf(uploadMarker);
  if (idx >= 0) {
    const fileName = imageUrl.slice(idx + uploadMarker.length).split("?")[0];
    const localPath = path.join(process.cwd(), "uploads", fileName);
    if (fs.existsSync(localPath)) return localPath;
  }

  // Remote image download fallback
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const parsedUrl = new URL(imageUrl);
    const ext = path.extname(parsedUrl.pathname) || ".jpg";
    const tmpPath = path.join(os.tmpdir(), `listing_image_${Date.now()}${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  } catch (_) {
    return null;
  }
}

function guessMimeTypeFromPath(filePath: string) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".avif") return "image/avif";
  return "image/jpeg";
}

async function injectImageViaBase64(page: Page, inputSelector: string, imagePath: string) {
  const fileName = path.basename(imagePath);
  const mimeType = guessMimeTypeFromPath(imagePath);
  const base64Data = fs.readFileSync(imagePath).toString("base64");

  const result = await page.evaluate(async ({ selector, b64, fileName: innerName, mimeType: innerMime }) => {
    console.log(`[INJECT] Basliyor... Selector: ${selector}`);
    const input = document.querySelector(selector) as HTMLInputElement;
    if (!input) {
      console.error(`[INJECT] HATA: Input bulunamadi! Selector: ${selector}`);
      return { ok: false, reason: "input-not-found" };
    }

    try {
      console.log(`[INJECT] Input bulundu. Disabled: ${input.disabled}, Visibility: ${input.style.display}`);
      
      // Create File and DataTransfer
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], innerName, { type: innerMime });
      const dt = new DataTransfer();
      dt.items.add(file);
      console.log(`[INJECT] File nesnesi olusturuldu: ${innerName} (${file.size} bytes)`);

      // Set files to input
      input.files = dt.files;
      console.log(`[INJECT] input.files atandi. Yeni uzunluk: ${input.files.length}`);

      // Trigger initialization click
      console.log("[INJECT] MouseEvent(click) gonderiliyor...");
      input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

      // Dispatch events
      console.log("[INJECT] Change eventleri hazirlaniyor...");
      const changeEvent = new Event("change", { bubbles: true });
      Object.defineProperty(changeEvent, "target", { writable: false, value: input });
      Object.defineProperty(changeEvent, "files", { writable: false, value: dt.files });
      
      const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });

      input.dispatchEvent(new Event("input", { bubbles: true }));
      console.log("[INJECT] 'input' event gonderildi.");
      input.dispatchEvent(changeEvent);
      console.log("[INJECT] 'change' event gonderildi (files property ile).");
      
      const container = input.closest(".upload-image-container");
      if (container) {
        console.log("[INJECT] Kapsayici container bulundu, drop event gonderiliyor...");
        container.dispatchEvent(dropEvent);
      }

      // Angular specific fallback
      const win = window as any;
      if (win.angular) {
        try {
          const el = win.angular.element(input);
          const scope = el.scope();
          if (scope && typeof scope.onFileSelect === "function") {
            scope.$apply(() => {
              scope.onFileSelect(dt.files);
            });
            console.log("[INJECT] Angular scope.onFileSelect dogrudan tetiklendi.");
          }
        } catch (angularErr) {
          console.warn("[INJECT] Angular tetikleme hatasi:", angularErr);
        }
      }

      input.dispatchEvent(new Event("blur", { bubbles: true }));
      console.log("[INJECT] Enjeksiyon tamamlandi.");

      return { ok: true, selectedFiles: input.files ? input.files.length : 0 };
    } catch (e) {
      console.error(`[INJECT] Kritik Hata: ${String(e)}`);
      return { ok: false, reason: String(e) };
    }
  }, {
    selector: inputSelector,
    b64: base64Data,
    fileName,
    mimeType
  });

  return result;
}

function attachDebugLogging(browser: Browser, page: Page, logs: string[]) {
  browser.on("disconnected", () => {
    addLog(logs, "Browser disconnected event tetiklendi.");
  });

  browser.on(
    "targetcreated",
    (target: { type: () => string; url: () => string }) => {
      addLog(
        logs,
        `Yeni target olustu: ${target.type()} ${target.url() || "(bos url)"}`,
      );
    },
  );

  page.on("console", (message: { type: () => string; text: () => string }) => {
    const text = message.text().trim();
    if (text) {
      addLog(logs, `Page console [${message.type()}]: ${text}`);
    }
  });

  page.on("pageerror", (error: Error) => {
    addLog(logs, `Page error: ${error.message}`);
  });

  page.on("error", (error: Error) => {
    addLog(logs, `Page crash/error: ${error.message}`);
  });

  page.on(
    "requestfailed",
    (request: {
      method: () => string;
      url: () => string;
      failure: () => { errorText: string } | null;
    }) => {
      const failure = request.failure();
      addLog(
        logs,
        `Request failed: ${request.method()} ${request.url()} -> ${failure?.errorText ?? "unknown"}`,
      );
    },
  );

  page.on(
    "response",
    (response: { url: () => string; status: () => number }) => {
      if (response.status() >= 400) {
        addLog(logs, `HTTP ${response.status()}: ${response.url()}`);
      }
    },
  );

  page.on("framenavigated", (frame: { url: () => string }) => {
    if (frame === page.mainFrame()) {
      addLog(logs, `Main frame navigated: ${frame.url()}`);
    }
  });

  page.on(
    "dialog",
    async (dialog: {
      type: () => string;
      message: () => string;
      dismiss: () => Promise<void>;
    }) => {
      addLog(logs, `Dialog goruldu: [${dialog.type()}] ${dialog.message()}`);
    },
  );
}

async function persistDebugScreenshot(page: Page, logs: string[]) {
  const debugDir = path.join(process.cwd(), ".nextbot", "debug");
  await mkdir(debugDir, { recursive: true });
  const filePath = path.join(debugDir, `publish-failure-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  addLog(logs, `Hata ekrani kaydedildi: ${filePath}`);
}

async function clickCategoryItem(page: Page, label: string) {
  await page.waitForFunction(
    (targetLabel: string) => {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const spans = Array.from(
        document.querySelectorAll<HTMLElement>(
          "li.breadcrumb-item span.ng-binding, li.breadcrumb-item span",
        ),
      );

      return spans.some(
        (span) => normalize(span.textContent ?? "") === normalize(targetLabel),
      );
    },
    { timeout: 20_000 },
    label,
  );

  const clicked = await page.evaluate((targetLabel: string) => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("li.breadcrumb-item"),
    );
    const match = items.find((item) => {
      const span = item.querySelector<HTMLElement>("span.ng-binding, span");
      return (
        normalize(span?.textContent ?? item.innerText ?? "") ===
        normalize(targetLabel)
      );
    });

    if (!match) {
      return false;
    }

    match.scrollIntoView({ block: "center" });
    match.click();
    return true;
  }, label);

  if (!clicked) {
    throw new Error(`Kategori bulunamadi: ${label}`);
  }
}

async function typeIntoContentEditable(
  page: Page,
  selector: string,
  text: string,
) {
  await page.waitForSelector(selector, { timeout: SELECTOR_TIMEOUT_MS });
  await page.evaluate(
    ({
      targetSelector,
      nextText,
    }: {
      targetSelector: string;
      nextText: string;
    }) => {
      const element = document.querySelector<HTMLElement>(targetSelector);
      if (!element) {
        throw new Error(`Editor bulunamadi: ${targetSelector}`);
      }
      element.focus();
      element.innerHTML = `<p>${nextText.replace(/\n/g, "<br>")}</p>`;
      element.dispatchEvent(new InputEvent("input", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    },
    { targetSelector: selector, nextText: text },
  );
}

async function fillInputValue(page: Page, selector: string, value: string) {
  await page.waitForSelector(selector, { timeout: SELECTOR_TIMEOUT_MS });
  await page.evaluate(
    ({
      targetSelector,
      nextValue,
    }: {
      targetSelector: string;
      nextValue: string;
    }) => {
      const input = document.querySelector<HTMLInputElement>(targetSelector);
      if (!input) {
        throw new Error(`Input bulunamadi: ${targetSelector}`);
      }

      input.focus();
      input.value = "";
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
    },
    { targetSelector: selector, nextValue: value },
  );
}

async function selectByText(page: Page, selector: string, text: string) {
  await page.waitForSelector(selector, { timeout: SELECTOR_TIMEOUT_MS });
  const ok = await page.$eval(
    selector,
    (element: Element, targetText: string) => {
      const select = element as HTMLSelectElement;
      const option = Array.from(select.options).find(
        (item) => item.text.trim() === targetText,
      );
      if (!option) {
        return false;
      }
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    text,
  );

  if (!ok) {
    throw new Error(`Select icin option bulunamadi: ${selector} -> ${text}`);
  }
}

async function selectFirstMatchingSelector(
  page: Page,
  selectors: string[],
  text: string,
) {
  let lastError: Error | null = null;

  for (const selector of selectors) {
    const exists = await page.$(selector);
    if (!exists) {
      continue;
    }

    try {
      await selectByText(page, selector, text);
      return selector;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Select hatasi");
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    `Uygun select bulunamadi: ${selectors.join(", ")} -> ${text}`,
  );
}

async function logVisibleSelects(page: Page, logs: string[]) {
  const selectData = await page.evaluate(() => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

    return Array.from(document.querySelectorAll<HTMLSelectElement>("select"))
      .map((select) => {
        const formGroup = select.closest(
          "li, .form-group, .classifiedInfo, .classified-info, .row, .formArea",
        );
        const label =
          formGroup?.querySelector("label")?.textContent ??
          select.closest("label")?.textContent ??
          "";

        return {
          name: select.name || "",
          id: select.id || "",
          label: normalize(label),
          options: Array.from(select.options)
            .map((option) => normalize(option.textContent ?? ""))
            .filter(Boolean)
            .slice(0, 8),
        };
      })
      .filter((item) => item.name || item.id || item.label);
  });

  for (const item of selectData) {
    addLog(
      logs,
      `Select bulundu -> label: ${item.label || "(bos)"} | name: ${item.name || "(bos)"} | id: ${
        item.id || "(bos)"
      } | options: ${item.options.join(", ")}`,
    );
  }
}

async function selectByLabelText(
  page: Page,
  labelCandidates: string[],
  optionText: string,
) {
  const matched = await page.evaluate(
    ({
      candidates,
      targetOption,
    }: {
      candidates: string[];
      targetOption: string;
    }) => {
      const normalize = (value: string) =>
        value.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");

      const normalizedCandidates = candidates.map(normalize);
      const groups = Array.from(
        document.querySelectorAll<HTMLElement>(
          "li, .form-group, .classifiedInfo, .row",
        ),
      );

      const findSelectFromGroup = (group: HTMLElement) => {
        const select = group.querySelector<HTMLSelectElement>("select");
        if (select) {
          return select;
        }

        const nextSelect = group.nextElementSibling?.querySelector?.("select");
        return nextSelect instanceof HTMLSelectElement ? nextSelect : null;
      };

      for (const group of groups) {
        const labelText = normalize(
          group.querySelector("label")?.textContent ?? "",
        );
        if (!labelText) {
          continue;
        }

        if (
          !normalizedCandidates.some((candidate: string) =>
            labelText.includes(candidate),
          )
        ) {
          continue;
        }

        const select = findSelectFromGroup(group);
        if (!select) {
          continue;
        }

        const option = Array.from(select.options).find(
          (item) =>
            normalize(item.textContent ?? "") === normalize(targetOption),
        );

        if (!option) {
          return {
            found: true,
            selected: false,
            labelText,
            selectName: select.name || select.id || "",
          };
        }

        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return {
          found: true,
          selected: true,
          labelText,
          selectName: select.name || select.id || "",
        };
      }

      return { found: false, selected: false, labelText: "", selectName: "" };
    },
    { candidates: labelCandidates, targetOption: optionText },
  );

  if (!matched.found) {
    throw new Error(
      `Label ile select bulunamadi: ${labelCandidates.join(" / ")} -> ${optionText}`,
    );
  }

  if (!matched.selected) {
    throw new Error(
      `Label bulundu ama option bulunamadi: ${matched.labelText} (${matched.selectName}) -> ${optionText}`,
    );
  }
}

function inferProductTypeForForm(product: string) {
  const lower = product.toLocaleLowerCase("tr-TR");
  if (lower.includes("tampon")) {
    if (
      lower.includes("arka tampon") ||
      lower.includes("tampon arka") ||
      lower.includes("arka")
    ) {
      return "Tampon (Arka)";
    }

    if (
      lower.includes("ön tampon") ||
      lower.includes("on tampon") ||
      lower.includes("tampon ön") ||
      lower.includes("tampon on") ||
      lower.includes("ön") ||
      lower.includes("on")
    ) {
      return "Tampon (Ön)";
    }

    return "Tampon (Ön)";
  }
  if (lower.includes("far")) return "Far";
  if (lower.includes("stop")) return "Stop";
  return product;
}

const DEFAULT_PRODUCT_BRAND = "Fabrikasyon";
const DEFAULT_USED_PART = "Evet";
const DEFAULT_CONDITION = "İkinci El";
const DEFAULT_EXCHANGE = "Hayır";

function normalizeTurkishText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function selectOptionByHeuristic(
  page: Page,
  selector: string,
  targetText: string,
) {
  const result = await page.$eval(
    selector,
    (element: Element, rawTargetText: string) => {
      const normalize = (value: string) =>
        value
          .toLocaleLowerCase("tr-TR")
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();

      const select = element as HTMLSelectElement;
      const targetText = normalize(rawTargetText);
      const options = Array.from(select.options);

      const exact = options.find(
        (item) => normalize(item.textContent ?? "") === targetText,
      );
      const includes = options.find((item) =>
        normalize(item.textContent ?? "").includes(targetText),
      );
      const reverseIncludes = options.find((item) =>
        targetText.includes(normalize(item.textContent ?? "")),
      );
      const chosen = exact || includes || reverseIncludes;

      if (!chosen) {
        return false;
      }

      select.value = chosen.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    targetText,
  );

  if (!result) {
    throw new Error(
      `Heuristic option bulunamadi: ${selector} -> ${targetText}`,
    );
  }
}

async function selectUsingSelectorsWithHeuristic(
  page: Page,
  selectors: string[],
  text: string,
) {
  let lastError: Error | null = null;

  for (const selector of selectors) {
    const exists = await page.$(selector);
    if (!exists) {
      continue;
    }

    try {
      await selectByText(page, selector, text);
      return { selector, mode: "exact" as const };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Select exact hatasi");
    }

    try {
      await selectOptionByHeuristic(page, selector, text);
      return { selector, mode: "heuristic" as const };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Select heuristic hatasi");
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    `Uygun select bulunamadi: ${selectors.join(", ")} -> ${text}`,
  );
}

async function expandExistingSelectors(page: Page, selectors: string[]) {
  const resolved = new Set<string>();

  for (const selector of selectors) {
    if (selector.includes("^=")) {
      const handles = await page.$$(selector);
      for (const handle of handles) {
        const name = await handle.evaluate(
          (element: Element) => (element as HTMLSelectElement).name || "",
        );
        const id = await handle.evaluate(
          (element: Element) => (element as HTMLSelectElement).id || "",
        );

        if (name) {
          resolved.add(`select[name="${name}"]`);
        } else if (id) {
          resolved.add(`select#${id}`);
        }
      }
      continue;
    }

    resolved.add(selector);
  }

  return Array.from(resolved);
}

async function ensureCheckboxChecked(page: Page, selector: string) {
  const exists = await page.$(selector);
  if (!exists) {
    throw new Error(`Checkbox bulunamadi: ${selector}`);
  }

  await page.$eval(selector, (element: Element) => {
    const input = element as HTMLInputElement;
    if (!input.checked) {
      input.click();
    }
  });
}

async function clickContinueButton(page: Page) {
  const primarySelectors = [
    "button.add-classified-submit",
    ".add-classified-footer button.add-classified-submit",
    'button[type="submit"].add-classified-submit',
  ];

  for (const selector of primarySelectors) {
    const button = await page.$(selector);
    if (!button) {
      continue;
    }

    try {
      await page.waitForFunction(
        (targetSelector: string) => {
          const buttonEl =
            document.querySelector<HTMLButtonElement>(targetSelector);
          return !!buttonEl && !buttonEl.disabled;
        },
        { timeout: 10_000 },
        selector,
      );
    } catch {
      // fallback akisi asagida denenecek
    }

    try {
      await page.$eval(selector, (element: Element) => {
        const buttonEl = element as HTMLButtonElement;
        buttonEl.scrollIntoView({ block: "center", inline: "center" });
      });

      const handle = await page.$(selector);
      const box = await handle?.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        return `mouse:${selector}`;
      }
    } catch {
      // js click fallback denenecek
    }

    await page.$eval(selector, (element: Element) => {
      const buttonEl = element as HTMLButtonElement;
      buttonEl.scrollIntoView({ block: "center" });
      buttonEl.click();
    });
    return `selector:${selector}`;
  }

  const clickedByText = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    );
    const target = buttons.find(
      (button) => button.innerText.replace(/\s+/g, " ").trim() === "Devam",
    );
    if (!target) {
      return false;
    }

    target.scrollIntoView({ block: "center" });
    target.click();
    return true;
  });

  if (clickedByText) {
    return "text:Devam";
  }

  const submittedByForm = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      "button.add-classified-submit",
    );
    const form = button?.closest("form");
    if (!form) {
      return false;
    }

    form.requestSubmit();
    return true;
  });

  if (submittedByForm) {
    return "form:requestSubmit";
  }

  throw new Error("Devam butonu bulunamadi veya tetiklenemedi.");
}

async function dismissDraftResumeModal(page: Page, logs: string[]) {
  const foundModal = await page
    .waitForFunction(
      () => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button"),
        );
        return buttons.some(
          (button) =>
            button.innerText.replace(/\s+/g, " ").trim() ===
            "Hayır, Yeni Bir İlan Vermek İstiyorum",
        );
      },
      { timeout: 3_000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!foundModal) {
    addLog(logs, "Taslak devam modalı görünmedi.");
    return;
  }

  addLog(logs, "Taslak devam modalı bulundu.");

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    );
    const target = buttons.find(
      (button) =>
        button.innerText.replace(/\s+/g, " ").trim() ===
        "Hayır, Yeni Bir İlan Vermek İstiyorum",
    );

    if (!target) {
      return false;
    }

    target.scrollIntoView({ block: "center" });
    target.click();
    return true;
  });

  if (!clicked) {
    throw new Error(
      "Taslak modalı bulundu ama 'Hayır, Yeni Bir İlan Vermek İstiyorum' butonuna tıklanamadı.",
    );
  }

  addLog(
    logs,
    "Taslak modalında 'Hayır, Yeni Bir İlan Vermek İstiyorum' seçildi.",
  );
  await sleep(800);
}

async function clickStepThreeContinue(page: Page) {
  await page.waitForFunction(
    () => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      );
      const btn = buttons.find(
        (button) => button.innerText.replace(/\s+/g, " ").trim() === "Devam Et",
      );
      if (!btn) return false;
      const isDisabled =
        btn.classList.contains("loading-animation") ||
        btn.hasAttribute("disabled") ||
        (btn as any).disabled;
      return !isDisabled;
    },
    { timeout: 30_000 },
  );

  await sleep(1_000);

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    );
    const target = buttons.find(
      (button) => button.innerText.replace(/\s+/g, " ").trim() === "Devam Et",
    );

    if (!target) {
      return false;
    }

    target.scrollIntoView({ block: "center" });
    target.click();
    return true;
  });

  if (!clicked) {
    throw new Error("Adim 3 'Devam Et' butonu bulunamadi veya tiklanamadi.");
  }

  return "text:Devam Et";
}

async function dismissDopingModal(page: Page, logs: string[]) {
  const foundModal = await page
    .waitForFunction(
      () => {
        const popup = document.querySelector<HTMLElement>(
          ".first-classified-popup",
        );
        return !!popup;
      },
      { timeout: 5_000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!foundModal) {
    addLog(logs, "Doping modalı görünmedi.");
    return;
  }

  addLog(logs, "Doping modalı bulundu.");

  const clicked = await page.evaluate(() => {
    const closeButton = document.querySelector<HTMLElement>(
      ".first-classified-popup a.dialog-close",
    );
    if (!closeButton) {
      return false;
    }

    closeButton.scrollIntoView({ block: "center" });
    closeButton.click();
    return true;
  });

  if (!clicked) {
    throw new Error("Doping modalı bulundu ama kapatma butonuna tıklanamadı.");
  }

  addLog(logs, "Doping modalı kapatıldı.");
  await sleep(800);
}

async function clickDopingContinueButton(page: Page) {
  await page.waitForFunction(
    () => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      );
      return buttons.some(
        (button) => button.innerText.replace(/\s+/g, " ").trim() === "Devam Et",
      );
    },
    { timeout: 20_000 },
  );

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button"),
    );
    const target = buttons.find(
      (button) => button.innerText.replace(/\s+/g, " ").trim() === "Devam Et",
    );

    if (!target) {
      return false;
    }

    target.scrollIntoView({ block: "center" });
    target.click();
    return true;
  });

  if (!clicked) {
    throw new Error(
      "Doping sayfasindaki 'Devam Et' butonu bulunamadi veya tiklanamadi.",
    );
  }

  return "text:Devam Et";
}

export async function publishListing(listing: ListingDraft, mode: PublishMode) {
  // Reset step counter and start timer for this publish run
  _stepCounter = 0;
  _publishStartTime = Date.now();

  const logs: string[] = [];
  addLog(logs, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "STEP");
  addLog(logs, `  NEXTBOT PUBLISH BAŞLADI — Mod: ${mode}`, "STEP");
  addLog(logs, `  İlan: ${listing.name} | Marka: ${listing.brand} | Model: ${listing.model}`, "STEP");
  addLog(logs, `  Fiyat: ${listing.price} TL | Görsel: ${listing.imagePath || listing.imageUrl || "(yok)"}`, "STEP");
  addLog(logs, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "STEP");

  // ──── ADIM 0: TARAYICI BAĞLANTISI ────
  stepLog(logs, "TARAYICI BAĞLANTISI");

  let browser = await tryConnectToExistingBrowser(logs);
  let shouldCloseBrowser = false;
  let shouldKeepOpenForDebug = false;

  if (!browser) {
    try {
      addLog(logs, "Mevcut oturum bulunamadı, yeni tarayıcı başlatılıyor...", "INFO");
      browser = await puppeteer.launch({
        executablePath: resolveChromeExecutable(),
        headless: false,
        userDataDir: getUserDataDir(),
        defaultViewport: null,
        args: ["--start-maximized", "--remote-debugging-port=9222"],
      });
      shouldCloseBrowser = true;
      addLog(logs, "Yeni tarayıcı oturumu açıldı.", "OK");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Tarayıcı başlatılamadı";
      addLog(logs, "Tarayıcı açılamadı. Muhtemelen aynı profil zaten açık.", "ERROR");
      addLog(logs, "Uygulamadaki 'Tarayıcıyı aç' veya 'Sahibinden oturum aç' butonuyla mevcut oturumu kullanın.", "WARN");
      addLog(logs, message, "ERROR");
      return { ok: false, mode, logs };
    }
  } else {
    addLog(logs, "Mevcut tarayıcı oturumuna bağlanıldı.", "OK");
  }

  const page = await browser.newPage();
  attachDebugLogging(browser, page, logs);
  addLog(logs, "Yeni sayfa (tab) oluşturuldu.", "OK");

  try {
    // ──── ADIM 1: SAYFAYA GİT ────
    stepLog(logs, "SAHIBINDEN İLAN VER SAYFASI");
    addLog(logs, "Sahibinden ilan verme sayfası açılıyor...", "INFO");
    await page.goto(
      "https://banaozel.sahibinden.com/ilan-ver/adim-1/?state=new",
      {
        waitUntil: "domcontentloaded",
      },
    );
    addLog(logs, `Sayfa yüklendi. URL: ${page.url()}`, "OK");

    // ──── ADIM 2: KATEGORİ ARAMA & SEÇİM ────
    stepLog(logs, "KATEGORİ ARAMA & SEÇİM");
    await page.waitForSelector("#keyword", { timeout: SELECTOR_TIMEOUT_MS });
    
    // Clean storage info (GB/TB) from model name for better category search
    const cleanModel = listing.model.replace(/\s\d+(GB|TB)$|^\d+(GB|TB)$|\s\d+\s*(GB|TB)$|\d+\s*(GB|TB)$|1TB|512GB|256GB|128GB|64GB/gi, "").trim();
    
    await page.type("#keyword", cleanModel, { delay: 50 });
    addLog(logs, `Arama terimi yazıldı: "${cleanModel}"`, "OK");
    
    // Wait for dropdown to appear and select the first relevant category
    addLog(logs, "Kategori önerileri bekleniyor...", "INFO");
    await sleep(1500); // Allow typeahead to fetch results

    const selectionResult = await page.evaluate((targetModel: string) => {
      const normalize = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
      const normalizedTarget = normalize(targetModel);
      
      // Sahibinden uses .suggestion-link class for search results
      const suggestions = Array.from(document.querySelectorAll<HTMLElement>("a.suggestion-link"));
      
      if (suggestions.length === 0) {
        // Fallback to generic dropdown items if .suggestion-link is not found
        const dropdownItems = Array.from(document.querySelectorAll<HTMLElement>("ul.dropdown-menu li a"));
        if (dropdownItems.length === 0) return { ok: false, error: "Kategori önerisi bulunamadı" };
        
        dropdownItems[0].click();
        return { ok: true, text: dropdownItems[0].innerText };
      }
      
      // Try to find the one that contains our model name in the <strong> tag
      const bestMatch = suggestions.find(s => {
        const strong = s.querySelector("strong");
        return strong && normalize(strong.innerText).includes(normalizedTarget);
      }) || suggestions[0];
      
      bestMatch.click();
      return { ok: true, text: bestMatch.innerText };
    }, cleanModel);

    if (!selectionResult.ok) {
      addLog(logs, `Kategori bulunamadı: ${selectionResult.error}`, "ERROR");
    } else {
      addLog(logs, `Kategori seçildi: ${selectionResult.text}`, "OK");
      await sleep(1000);
      await dismissDraftResumeModal(page, logs);
    }

    // ──── ADIM 3: İLAN VER BUTONU ────
    stepLog(logs, "İLAN VER BUTONU");
    addLog(logs, "'İlan Ver' butonu bekleniyor...", "INFO");
    await page.waitForSelector("#getsizButton", {
      visible: true,
      timeout: SELECTOR_TIMEOUT_MS * 4,
    });

    await page.waitForFunction(
      () => {
        const btn = document.querySelector("#getsizButton");
        if (!btn) return false;
        const isDisabled =
          btn.classList.contains("loading-animation") ||
          btn.hasAttribute("disabled") ||
          (btn as any).disabled;
        return !isDisabled;
      },
      { timeout: SELECTOR_TIMEOUT_MS * 3 },
    );

    await page.click("#getsizButton");
    addLog(logs, "'İlan Ver' butonuna tıklandı.", "OK");

    // Navigasyon bekle — İlan Ver sonrası sayfa değişebilir
    await page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
      .catch(() => null);
    await sleep(1500);

    const postClickUrl = page.url();
    addLog(logs, `İlan Ver sonrası URL: ${postClickUrl}`, "INFO");

    // ──── ÜRÜN ÖZELLİKLERİ (Opsiyonel Ara Adım) ────
    if (postClickUrl.includes("urun-ozellikleri")) {
      stepLog(logs, "ÜRÜN ÖZELLİKLERİ");
      try {
        // ── Renk (Lacivert, Gümüş, Turuncu arasından rastgele) ──
        try {
          const colorToSelect = ["Lacivert", "Gümüş", "Turuncu"][Math.floor(Math.random() * 3)];
          await selectOptionByHeuristic(page, 'select[name="a86470"]', colorToSelect);
          addLog(logs, `Renk → "${colorToSelect}"`, "OK");
        } catch {
          try {
            await selectByLabelText(page, ["Renk"], "RANDOM");
            addLog(logs, `Renk → Rastgele seçildi (fallback)`, "OK");
          } catch {
            addLog(logs, "Renk seçilemedi.", "WARN");
          }
        }
        await sleep(800);

        // ── Depolama Kapasitesi (Sabit: 256 GB) ──
        try {
          await selectOptionByHeuristic(page, 'select[name="a101170"]', "256 GB");
          addLog(logs, `Depolama Kapasitesi → "256 GB"`, "OK");
        } catch {
          await selectByLabelText(page, ["Depolama Kapasitesi"], "256 GB").catch(() => null);
        }
        await sleep(500);

        // ── Alındığı Yer (Sabit: Yurt dışı) ──
        try {
          await selectOptionByHeuristic(page, 'select[name="a120853"]', "Yurt dışı");
          addLog(logs, "Alındığı Yer → Yurt dışı", "OK");
        } catch {
          await selectByLabelText(page, ["Alındığı Yer"], "Yurt dışı").catch(() => null);
        }
        await sleep(500);

        // ── Garanti (Sabit: Distribütör Garantili) ──
        try {
          await selectOptionByHeuristic(page, 'select[name="a109392"]', "Distribütör Garantili");
          addLog(logs, "Garanti → Distribütör Garantili", "OK");
        } catch {
          await selectByLabelText(page, ["Garanti"], "Distribütör Garantili").catch(() => null);
        }
        await sleep(500);

        // ── Durumu (Sabit: Sıfır) ──
        try {
          await selectOptionByHeuristic(page, 'select[name="a119153"]', "Sıfır");
          addLog(logs, "Durumu → Sıfır", "OK");
        } catch {
          await selectByLabelText(page, ["Durumu"], "Sıfır").catch(() => null);
        }
        await sleep(500);

        // ── Takaslı (Sabit: Evet) ──
        try {
          await selectOptionByHeuristic(page, 'select[name="exchange"]', "Evet");
          addLog(logs, "Takaslı → Evet", "OK");
        } catch {
          await selectByLabelText(page, ["Takaslı", "Takas"], "Evet").catch(() => null);
        }
        await sleep(800);

        addLog(logs, "Tüm veriler dolduruldu, 2s bekleniyor...", "INFO");
        await sleep(2000); 

        addLog(logs, "Ürün özellikleri 'Devam' tıklanıyor...", "INFO");
        await clickContinueButton(page);
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
        addLog(logs, "Ürün özellikleri adımı tamamlandı.", "OK");
      } catch (error) {
        addLog(logs, `Ürün özellikleri adımında hata: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`, "ERROR");
        await persistDebugScreenshot(page, logs);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 5: FOTOĞRAF YÜKLEME (fotograf-video sayfası)
    // Sahibinden akışı: Kategori → İlan Ver → FOTOĞRAF → FORM → Doping
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("fotograf-video")) {
      stepLog(logs, "FOTOĞRAF YÜKLEME");
      await dismissDraftResumeModal(page, logs);
      
      const imagePath = await resolveImagePath(listing);
      if (!imagePath || !fs.existsSync(imagePath)) {
        addLog(logs, `Görsel dosyası bulunamadı! Yol: ${imagePath || "(boş)"}`, "ERROR");
        await persistDebugScreenshot(page, logs);
      } else {
        const fileSize = fs.statSync(imagePath).size;
        addLog(logs, `Görsel doğrulandı: ${imagePath} (${(fileSize / 1024).toFixed(1)} KB)`, "OK");

        const getUploadedCount = async () => page.evaluate(() => {
          const selectors = [
            '.classified-photo-list li.photo-item',
            '.classified-photo-item',
            '.classified-photo-preview',
            '[ng-repeat*="image in images"]',
            '.classified-photos li',
            '.photo-list li'
          ];
          const counts = selectors.map((sel) => document.querySelectorAll(sel).length);
          return Math.max(...counts, 0);
        }).catch(() => 0);

        let beforeCount = await getUploadedCount();
        addLog(logs, `Mevcut görsel sayısı: ${beforeCount}`, "DEBUG");

        // File input'u bul — butona tıklamadan direkt uploadFile kullan
        addLog(logs, "File input (#uploadImageField) aranıyor...", "INFO");
        await page.waitForSelector("#uploadImageField", { visible: false, timeout: 15_000 });
        const inputs = await page.$$("#uploadImageField");
        addLog(logs, `Bulunan input sayısı: ${inputs.length}`, "DEBUG");
        
        let fileInput = inputs[0]; // İlk input'u al
        if (!fileInput) {
          addLog(logs, "File input bulunamadı!", "ERROR");
          await persistDebugScreenshot(page, logs);
        } else {
          // Input'u etkinleştir (disabled ise aç) ama butona TIKLAMADAN
          await fileInput.evaluate((el) => {
            (el as any).disabled = false;
            el.removeAttribute('disabled');
          });
          addLog(logs, "File input etkinleştirildi.", "OK");

          // ── Yöntem 1: Direkt uploadFile (butona tıklamadan) ──
          let method = 'uploadFile';
          let uploadSuccess = false;
          try {
            addLog(logs, "📤 Yöntem 1: Direkt uploadFile...", "INFO");
            await (fileInput as any).uploadFile(imagePath);
            // Tüm gerekli event'leri tetikle — Angular'ın algılaması için
            await fileInput.evaluate((el) => {
              ['input', 'change', 'blur'].forEach((ev) => el.dispatchEvent(new Event(ev, { bubbles: true })));
            });
            addLog(logs, "uploadFile komutu gönderildi.", "OK");
          } catch (error) {
            addLog(logs, `uploadFile başarısız: ${error instanceof Error ? error.message : "?"}`, "WARN");

            // ── Yöntem 2: FileChooser ──
            method = 'fileChooser';
            try {
              addLog(logs, "📤 Yöntem 2: FileChooser deneniyor...", "INFO");
              const labelHandle = await page.$('label[for="uploadImageField"], .upload-image-click');
              if (labelHandle) {
                const [fileChooser] = await Promise.all([
                  page.waitForFileChooser({ timeout: 10000 }),
                  labelHandle.click({ delay: 50 })
                ]);
                await fileChooser.accept([imagePath]);
                addLog(logs, "FileChooser ile dosya seçildi.", "OK");
              } else {
                addLog(logs, "FileChooser label bulunamadı.", "WARN");
              }
            } catch (fcError) {
              addLog(logs, `FileChooser başarısız: ${fcError instanceof Error ? fcError.message : "?"}`, "WARN");
            }
          }

          // Yükleme sonucunu bekle
          try {
            addLog(logs, "Görselin işlenmesi bekleniyor (max 15s)...", "INFO");
            await page.waitForFunction((prevCount) => {
              const selectors = ['.classified-photo-list li.photo-item', '.classified-photo-item', '.classified-photo-preview', '[ng-repeat*="image in images"]'];
              const current = Math.max(...selectors.map(s => document.querySelectorAll(s).length), 0);
              return current > prevCount;
            }, { timeout: 15000 }, beforeCount);
          } catch {
            addLog(logs, "Standart yöntemlerle görsel artışı tespit edilemedi.", "WARN");
          }

          await sleep(1500);
          let uploaded = await getUploadedCount();

          // ── Yöntem 3: Base64 Injection (son çare) ──
          if (uploaded <= beforeCount) {
            addLog(logs, "📤 Yöntem 3: Angular/Base64 Injection deneniyor...", "WARN");
            method += '+base64';
            const injectResult = await injectImageViaBase64(page, '#uploadImageField', imagePath);
            addLog(logs, `Injection sonucu: ${JSON.stringify(injectResult)}`, "DEBUG");
            await sleep(4000);
            uploaded = await getUploadedCount();
          }

          // Sonuç raporu
          uploadSuccess = uploaded > beforeCount;
          if (uploadSuccess) {
            addLog(logs, `GÖRSEL YÜKLEME BAŞARILI ✓ (Önce: ${beforeCount}, Sonra: ${uploaded}, Yöntem: ${method})`, "OK");
          } else {
            addLog(logs, `GÖRSEL YÜKLEME BAŞARISIZ ✗ (Önce: ${beforeCount}, Sonra: ${uploaded}, Denenen: ${method})`, "ERROR");
            await persistDebugScreenshot(page, logs);
          }
        }
      }

      // Fotoğraf sayfasında Devam tıkla
      addLog(logs, "Fotoğraf adımında 'Devam Et' tıklanıyor...", "INFO");
      await sleep(1000);
      try {
        await clickContinueButton(page);
        await page
          .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
          .catch(() => null);
        addLog(logs, `Fotoğraf sonrası URL: ${page.url()}`, "OK");
      } catch (navErr) {
        addLog(logs, `Fotoğraf Devam Et hatası: ${navErr instanceof Error ? navErr.message : "?"}`, "WARN");
      }
    } else {
      addLog(logs, `Fotoğraf-video sayfası algılanmadı. URL: ${page.url()}`, "WARN");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 6: İLAN BİLGİLERİ FORMU (ilan-bilgileri sayfası)
    // Sahibinden akışı: fotoğraf-video → İLAN-BİLGİLERİ → doping
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("ilan-bilgileri")) {
      stepLog(logs, "İLAN DETAY FORMU DOLDURMA");
      
      // Form yüklenmesini bekle
      await page.waitForSelector('input[name="addClassifiedTitle"]', {
        timeout: SELECTOR_TIMEOUT_MS * 3,
      });
      addLog(logs, "İlan detay formu yüklendi.", "OK");

      // ── Başlık ──
      addLog(logs, "Başlık dolduruluyor...", "INFO");
      await fillInputValue(
        page,
        'input[name="addClassifiedTitle"]',
        listing.name,
      );
      addLog(logs, `Başlık → "${listing.name}"`, "OK");

      // ── Açıklama ──
      addLog(logs, "Açıklama dolduruluyor...", "INFO");
      try {
        const editorSelector = '[contenteditable="true"][name="Açıklama"], .ta-bind[contenteditable="true"], #taTextElement, div.ta-scroll-window [contenteditable="true"]';
        await typeIntoContentEditable(
          page,
          editorSelector,
          listing.description,
        );
        addLog(logs, `Açıklama dolduruldu (${listing.description.length} karakter).`, "OK");
      } catch (error) {
        addLog(logs, `Açıklama birincil yöntem başarısız: ${error instanceof Error ? error.message : "?"}. Fallback deneniyor...`, "WARN");
        try {
          await page.evaluate((text) => {
            const el = document.querySelector('[contenteditable="true"]') as HTMLElement;
            if (el) { el.innerHTML = text; el.dispatchEvent(new Event('input', { bubbles: true })); }
          }, listing.description);
          addLog(logs, "Açıklama fallback ile dolduruldu.", "OK");
        } catch (fallbackErr) {
          addLog(logs, `Açıklama doldurulamadı: ${fallbackErr instanceof Error ? fallbackErr.message : "?"}`, "ERROR");
        }
      }

      // ── Fiyat ──
      addLog(logs, "Fiyat dolduruluyor...", "INFO");
      try {
        const priceSelector = 'input[name="price"], #addClassifiedPrice, .classified-price input';
        await page.waitForSelector(priceSelector, { timeout: 5000 });
        await fillInputValue(page, priceSelector, String(listing.price));
        addLog(logs, `Fiyat → ${listing.price} TL`, "OK");
      } catch (error) {
        addLog(logs, `Fiyat alanı bulunamadı: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      // ── Select Alanları ──
      addLog(logs, "Sayfadaki select alanları taranıyor...", "DEBUG");
      await logVisibleSelects(page, logs);

      const productType = inferProductTypeForForm(
        listing.productType || listing.product,
      );

      stepLog(logs, "SELECT ALANLARI DOLDURMA");

      // ── Ürün Tipi ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          await expandExistingSelectors(page, [
            'select[name="a91472"]',
            'select[name="a88250"]',
            'select[name="a88320"]',
            'select[name="a88278"]',
            'select[name^="a914"]',
            'select[name^="a882"]',
            'select[name^="a883"]',
          ]),
          productType,
        );
        addLog(logs, `Ürün tipi → "${productType}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch {
        try {
          await selectByLabelText(
            page,
            ["urun tipi", "parça tipi", "parca tipi", "ürün türü", "urun turu"],
            productType,
          );
          addLog(logs, `Ürün tipi → "${productType}" (label fallback)`, "OK");
        } catch (error) {
          addLog(logs, `Ürün tipi seçilemedi: ${error instanceof Error ? error.message : "?"}`, "WARN");
        }
      }

      // ── Ürün Markası ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          await expandExistingSelectors(page, [
            'select[name="a88874"]',
            'select[name="a88866"]',
            'select[name^="a888"]',
          ]),
          DEFAULT_PRODUCT_BRAND,
        );
        addLog(logs, `Ürün markası → "${DEFAULT_PRODUCT_BRAND}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch (error) {
        addLog(logs, `Ürün markası seçilemedi: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      // ── Çıkma Yedek Parça ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          await expandExistingSelectors(page, [
            'select[name="a103870"]',
            'select[name="a103866"]',
            'select[name^="a1038"]',
          ]),
          DEFAULT_USED_PART,
        );
        addLog(logs, `Çıkma yedek parça → "${DEFAULT_USED_PART}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch (error) {
        addLog(logs, `Çıkma yedek parça seçilemedi: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      // ── Durum ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          ['select[name="condition"]'],
          DEFAULT_CONDITION,
        );
        addLog(logs, `Durum → "${DEFAULT_CONDITION}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch (error) {
        addLog(logs, `Durum seçilemedi: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      // ── Takas ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          ['select[name="exchange"]'],
          DEFAULT_EXCHANGE,
        );
        addLog(logs, `Takas → "${DEFAULT_EXCHANGE}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch (error) {
        addLog(logs, `Takas seçilemedi: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      // ── Marka ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          await expandExistingSelectors(page, [
            'select[name="a91512"]',
            'select[name="a91546"]',
            'select[name="a91538"]',
            'select[name^="a9153"]',
            'select[name^="a9154"]',
          ]),
          listing.brand,
        );
        addLog(logs, `Marka → "${listing.brand}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch {
        try {
          const selector =
            (
              await expandExistingSelectors(page, [
                'select[name="a91546"]',
                'select[name="a91538"]',
                'select[name^="a9153"]',
                'select[name^="a9154"]',
              ])
            )[0] ?? 'select[name="a91546"]';
          await selectOptionByHeuristic(page, selector, listing.brand);
          addLog(logs, `Marka → "${listing.brand}" (heuristic fallback, ${selector})`, "OK");
        } catch {
          try {
            await selectByLabelText(page, ["marka"], listing.brand);
            addLog(logs, `Marka → "${listing.brand}" (label fallback)`, "OK");
          } catch (err) {
            addLog(logs, `Marka seçilemedi: ${err instanceof Error ? err.message : "?"}`, "ERROR");
          }
        }
      }

      await sleep(600);

      // ── Model ──
      try {
        const matched = await selectUsingSelectorsWithHeuristic(
          page,
          await expandExistingSelectors(page, [
            'select[name="a91534"]',
            'select[name="a91566"]',
            'select[name="a91558"]',
            'select[name^="a9155"]',
            'select[name^="a9156"]',
          ]),
          listing.model,
        );
        addLog(logs, `Model → "${listing.model}" (${matched.mode}, ${matched.selector})`, "OK");
      } catch {
        try {
          const selector =
            (
              await expandExistingSelectors(page, [
                'select[name="a91566"]',
                'select[name="a91558"]',
                'select[name^="a9155"]',
                'select[name^="a9156"]',
              ])
            )[0] ?? 'select[name="a91566"]';
          await selectOptionByHeuristic(page, selector, listing.model);
          addLog(logs, `Model → "${listing.model}" (heuristic fallback, ${selector})`, "OK");
        } catch {
          try {
            await selectByLabelText(page, ["model"], listing.model);
            addLog(logs, `Model → "${listing.model}" (label fallback)`, "OK");
          } catch (err) {
            addLog(logs, `Model seçilemedi: ${err instanceof Error ? err.message : "?"}`, "ERROR");
          }
        }
      }

      // ── İl (City) Seçimi (Eğer seçili değilse İstanbul seç) ──
      try {
        await page.waitForSelector('select[name="city"]', { timeout: 5000 });
        const cityResult = await page.evaluate(() => {
          const sel = document.querySelector('select[name="city"]') as HTMLSelectElement;
          if (!sel) return { ok: false, label: 'not found' };
          if (sel.value && sel.value !== '' && sel.value !== '?') return { ok: true, label: sel.options[sel.selectedIndex]?.text, skipped: true };
          
          const istanbulOpt = Array.from(sel.options).find(o => o.text.includes("İstanbul"));
          if (istanbulOpt) {
            sel.value = istanbulOpt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            const angularEl = (window as any).angular?.element?.(sel);
            if (angularEl?.controller?.('ngModel')) {
              angularEl.controller('ngModel').$setViewValue(istanbulOpt.value);
              angularEl.scope()?.$apply?.();
            }
            return { ok: true, label: istanbulOpt.text, selected: true };
          }
          return { ok: false, label: 'İstanbul bulunamadı' };
        });
        if (cityResult.ok && (cityResult as any).selected) {
          addLog(logs, `İl → "İstanbul" seçildi.`, "OK");
          await sleep(2000); // İlçelerin yüklenmesi için bekle
        }
      } catch (err) {
        addLog(logs, `İl seçimi atlandı veya hata: ${err instanceof Error ? err.message : "?"}`, "DEBUG");
      }

      // ── İlçe Seçimi (Manuel formdan veya rastgele) ──
      try {
        await page.waitForSelector('select[name="town"]', { timeout: 5000 });
        
        // İlçelerin dolmasını bekle
        await page.waitForFunction(() => {
          const sel = document.querySelector('select[name="town"]') as HTMLSelectElement;
          return sel && sel.options.length > 1 && !sel.disabled;
        }, { timeout: 10000 }).catch(() => null);

        const targetTown = listing.town;
        
        const townResult = await page.evaluate((target) => {
          const sel = document.querySelector('select[name="town"]') as HTMLSelectElement;
          if (!sel) return { ok: false, value: '', label: 'select bulunamadı' };
          
          // Boş olmayan option'ları filtrele
          const options = Array.from(sel.options).filter(o => o.value && o.value !== '' && o.value !== '?');
          if (options.length === 0) return { ok: false, value: '', label: 'seçenek yok' };
          
          // Hedef ilçe varsa onu bul, yoksa rastgele
          let selectedOpt = null;
          if (target) {
            selectedOpt = options.find(o => o.text.toLowerCase().includes(target.toLowerCase()));
          }
          
          const finalOpt = selectedOpt || options[Math.floor(Math.random() * options.length)];
          
          sel.value = finalOpt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Angular ngModel güncelle
          const angularEl = (window as any).angular?.element?.(sel);
          if (angularEl?.controller?.('ngModel')) {
            angularEl.controller('ngModel').$setViewValue(finalOpt.value);
            angularEl.scope()?.$apply?.();
          }
          return { ok: true, value: finalOpt.value, label: finalOpt.text, isManual: !!selectedOpt };
        }, targetTown);

        if (townResult.ok) {
          addLog(logs, `İlçe → "${townResult.label}" ${townResult.isManual ? '(formdan)' : '(rastgele)'}`, "OK");
          // Puppeteer native select de yapalım garanti olsun
          await page.select('select[name="town"]', townResult.value).catch(() => null);
        } else {
          addLog(logs, `İlçe seçilemedi: ${townResult.label}`, "WARN");
        }
        await sleep(2000); // Mahalle listesinin yüklenmesini bekle
      } catch (err) {
        addLog(logs, `İlçe seçimi hatası: ${err instanceof Error ? err.message : "?"}`, "DEBUG");
      }

      // ── Mahalle Seçimi (rastgele) ──
      try {
        await page.waitForSelector('select[name="quarter"]', { timeout: 5000 });
        // Mahalle listesinin doldurulmasını bekle
        await page.waitForFunction(() => {
          const sel = document.querySelector('select[name="quarter"]') as HTMLSelectElement;
          return sel && !sel.disabled && sel.options.length > 1;
        }, { timeout: 10000 }).catch(() => null);

        const quarterResult = await page.evaluate(() => {
          const sel = document.querySelector('select[name="quarter"]') as HTMLSelectElement;
          if (!sel) return { ok: false, value: '', label: 'select bulunamadı' };
          
          const options = Array.from(sel.options).filter(o => o.value && o.value !== '' && o.value !== '?');
          if (options.length === 0) return { ok: false, value: '', label: 'seçenek yok' };
          
          const randomOpt = options[Math.floor(Math.random() * options.length)];
          sel.value = randomOpt.value;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          
          const angularEl = (window as any).angular?.element?.(sel);
          if (angularEl?.controller?.('ngModel')) {
            angularEl.controller('ngModel').$setViewValue(randomOpt.value);
            angularEl.scope()?.$apply?.();
          }
          return { ok: true, value: randomOpt.value, label: randomOpt.text };
        });
        if (quarterResult.ok) {
          addLog(logs, `Mahalle → "${quarterResult.label}" (rastgele)`, "OK");
          await page.select('select[name="quarter"]', quarterResult.value).catch(() => null);
        } else {
          addLog(logs, `Mahalle seçilemedi: ${quarterResult.label}`, "WARN");
        }
        await sleep(1000);
      } catch (err) {
        addLog(logs, `Mahalle seçimi hatası: ${err instanceof Error ? err.message : "?"}`, "DEBUG");
      }

      // ──── CHECKBOX'LAR ────
      stepLog(logs, "CHECKBOX'LAR");

      try {
        await ensureCheckboxChecked(page, "#autoPublishAuction");
        addLog(logs, "Otomatik yeniden yayın ✓", "OK");
      } catch (error) {
        addLog(logs, `Otomatik yeniden yayın checkbox bulunamadı: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      try {
        await ensureCheckboxChecked(page, "#showSendMessage");
        addLog(logs, "Mesaj tercihi ✓", "OK");
      } catch (error) {
        addLog(logs, `Mesaj tercihi checkbox bulunamadı: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }

      try {
        await ensureCheckboxChecked(page, "#postRulesCheck");
        addLog(logs, "Kurallar onayı ✓", "OK");
      } catch (error) {
        addLog(logs, `Kurallar checkbox hatası: ${error instanceof Error ? error.message : "?"}`, "ERROR");
      }

      if (mode === "draft") {
        addLog(logs, "Draft modu — son yayın adımından önce duruldu.", "OK");
        const elapsed = ((Date.now() - _publishStartTime) / 1000).toFixed(1);
        addLog(logs, `━━━ DRAFT TAMAMLANDI (${elapsed}s) ━━━`, "STEP");
        return { ok: true, mode, logs };
      }

      // ──── FORM DEVAM BUTONU ────
      stepLog(logs, "FORM DEVAM BUTONU");
      addLog(logs, "Devam butonundan önce 3 saniye bekleniyor...", "INFO");
      await sleep(3_000);

      // Angular form submit: .add-classified-submit butonunu tıkla
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('.add-classified-submit') as HTMLButtonElement;
          if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
        });
        addLog(logs, "Form submit butonu tıklandı.", "OK");
      } catch {
        const continueTrigger = await clickContinueButton(page);
        addLog(logs, `Devam butonuna tıklandı (fallback). Yöntem: ${continueTrigger}`, "OK");
      }

      await page
        .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 })
        .catch(() => null);
      addLog(logs, `Form sonrası URL: ${page.url()}`, "INFO");

    } else {
      addLog(logs, `ilan-bilgileri sayfası algılanmadı. Mevcut URL: ${page.url()}`, "WARN");
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 10: ÜRÜN ÖZELLİKLERİ & FİNAL
    // ═══════════════════════════════════════════════════════════════════
    stepLog(logs, "ADIM 10: ÜRÜN ÖZELLİKLERİ & FİNAL");

    // ── Doping Modalı (Varsa Kapat) ──
    try {
      await dismissDopingModal(page, logs);
      await clickDopingContinueButton(page);
    } catch {
      // Doping yoksa devam et
    }

    // ── Ürün Özellikleri Formu (Eğer bu adımda geldiyse) ──
    if (page.url().includes("urun-ozellikleri")) {
      try {
        // Renk (Lacivert, Gümüş, Turuncu arasından rastgele)
        try {
          await page.waitForSelector('select[name="a86470"]', { timeout: 3000 }).catch(() => null);
          const colorToSelect = ["Lacivert", "Gümüş", "Turuncu"][Math.floor(Math.random() * 3)];
          await selectOptionByHeuristic(page, 'select[name="a86470"]', colorToSelect);
          addLog(logs, `Renk → "${colorToSelect}"`, "OK");
        } catch (e) {
          try {
            await selectByLabelText(page, ["Renk"], "RANDOM");
            addLog(logs, `Renk → Rastgele seçildi (fallback)`, "OK");
          } catch {
            addLog(logs, "Renk seçilemedi.", "WARN");
          }
        }
        await sleep(800);

        // Depolama Kapasitesi (Sabit: 256 GB)
        try {
          await selectOptionByHeuristic(page, 'select[name="a101170"]', "256 GB");
          addLog(logs, `Depolama Kapasitesi → "256 GB"`, "OK");
        } catch {
          await selectByLabelText(page, ["Depolama Kapasitesi"], "256 GB").catch(() => null);
        }
        await sleep(500);

        // Alındığı Yer (Sabit: Yurt dışı)
        await selectOptionByHeuristic(page, 'select[name="a120853"]', "Yurt dışı").catch(() => 
          selectByLabelText(page, ["Alındığı Yer"], "Yurt dışı")
        );
        addLog(logs, "Alındığı Yer → Yurt dışı", "OK");
        await sleep(500);

        // Garanti (Sabit: Distribütör Garantili)
        await selectOptionByHeuristic(page, 'select[name="a109392"]', "Distribütör Garantili").catch(() => 
          selectByLabelText(page, ["Garanti"], "Distribütör Garantili")
        );
        addLog(logs, "Garanti → Distribütör Garantili", "OK");
        await sleep(500);

        // Durumu (Sabit: Sıfır)
        await selectOptionByHeuristic(page, 'select[name="a119153"]', "Sıfır").catch(() => 
          selectByLabelText(page, ["Durumu"], "Sıfır")
        );
        addLog(logs, "Durumu → Sıfır", "OK");
        await sleep(500);

        // Takaslı (Sabit: Evet)
        await selectOptionByHeuristic(page, 'select[name="exchange"]', "Evet").catch(() => 
          selectByLabelText(page, ["Takaslı", "Takas"], "Evet")
        );
        addLog(logs, "Takaslı → Evet", "OK");
        await sleep(800);

        addLog(logs, "Tüm veriler dolduruldu, 2s bekleniyor...", "INFO");
        await sleep(2000);

        addLog(logs, "Final 'Devam' tıklanıyor...", "INFO");
        await clickContinueButton(page);
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
      } catch (error) {
        addLog(logs, `Final ürün özellikleri hatası: ${error instanceof Error ? error.message : "?"}`, "WARN");
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 11: TESLİMAT TERCİHLERİ
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("teslimat-tercihleri")) {
      stepLog(logs, "ADIM 11: TESLİMAT TERCİHLERİ");
      try {
        await sleep(2000);
        addLog(logs, "Teslimat tercihleri 'Devam Et' tıklanıyor...", "INFO");
        await page.evaluate(() => {
          const btn = document.querySelector('button.add-classified-submit') as HTMLButtonElement;
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
        addLog(logs, "Teslimat tercihleri adımı tamamlandı.", "OK");
      } catch (err) {
        addLog(logs, `Teslimat tercihleri adımında hata: ${err instanceof Error ? err.message : "?"}`, "WARN");
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 12: ÜRÜN FİYATI
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("urun-fiyati")) {
      stepLog(logs, "ADIM 12: ÜRÜN FİYATI");
      try {
        addLog(logs, "Fiyat alanı dolduruluyor...", "INFO");
        await fillInputValue(page, 'input[name="addClassifiedPrice"]', String(listing.price));
        addLog(logs, `Fiyat → ${listing.price} TL`, "OK");
        
        await sleep(1000);
        addLog(logs, "Fiyat sayfasında 'Devam Et' tıklanıyor...", "INFO");
        await page.evaluate(() => {
          const btn = document.querySelector('button.add-classified-submit') as HTMLButtonElement;
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
        addLog(logs, "Fiyat adımı tamamlandı.", "OK");
      } catch (err) {
        addLog(logs, `Fiyat adımında hata: ${err instanceof Error ? err.message : "?"}`, "WARN");
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 13: ADIM-3 ONAY
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("adim-3")) {
      stepLog(logs, "ADIM 13: ADIM-3 ONAY");
      try {
        await page.waitForSelector('button.btn', { timeout: 5000 }).catch(() => null);
        await sleep(1000);
        addLog(logs, "Adım-3 onay sayfası 'Devam Et' tıklanıyor...", "INFO");
        
        const clicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button.btn'));
          const submitBtn = btns.find(b => b.textContent?.includes("Devam Et") || b.getAttribute('ng-click') === "submitClassified()") as HTMLButtonElement;
          if (submitBtn) {
            submitBtn.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
          addLog(logs, "Adım-3 onay adımı tamamlandı.", "OK");
        } else {
          addLog(logs, "Adım-3 onay butonu bulunamadı!", "WARN");
        }
      } catch (err) {
        addLog(logs, `Adım-3 onay adımında hata: ${err instanceof Error ? err.message : "?"}`, "WARN");
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADIM 14: DOPİNG SAYFASI
    // ═══════════════════════════════════════════════════════════════════
    if (page.url().includes("/ilan-ver/doping/")) {
      stepLog(logs, "ADIM 14: DOPİNG SAYFASI");
      try {
        addLog(logs, "Doping sayfası 'Devam Et' tıklanıyor...", "INFO");
        await page.evaluate(() => {
          const btn = document.querySelector('button.btn[ng-click="submit()"]') as HTMLButtonElement;
          if (btn) btn.click();
        });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
        addLog(logs, "Doping adımı tamamlandı.", "OK");
      } catch (err) {
        addLog(logs, `Doping sayfasında hata: ${err instanceof Error ? err.message : "?"}`, "WARN");
      }
    }

    // ── Sonuç ──
    const totalElapsed = ((Date.now() - _publishStartTime) / 1000).toFixed(1);
    addLog(logs, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "STEP");
    addLog(logs, `  ✅ PUBLISH TAMAMLANDI — ${totalElapsed}s`, "STEP");
    addLog(logs, `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "STEP");

    return { ok: true, mode, logs };
  } catch (error) {
    shouldKeepOpenForDebug = true;

    addLog(logs, `━━━ KRİTİK HATA YAKALANDI ━━━`, "ERROR");
    addLog(logs, `Son URL: ${page.url()}`, "ERROR");

    try {
      const title = await page.title();
      addLog(logs, `Sayfa başlığı: ${title || "(boş)"}`, "DEBUG");
    } catch {
      addLog(logs, "Sayfa başlığı okunamadı.", "DEBUG");
    }

    try {
      await persistDebugScreenshot(page, logs);
    } catch (screenshotError) {
      addLog(logs, `Screenshot alınamadı: ${screenshotError instanceof Error ? screenshotError.message : "?"}`, "WARN");
    }

    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen Puppeteer hatası";
    addLog(logs, errorMsg, "ERROR");

    const totalElapsed2 = ((Date.now() - _publishStartTime) / 1000).toFixed(1);
    addLog(logs, `━━━ PUBLISH BAŞARISIZ — ${totalElapsed2}s ━━━`, "ERROR");

    return { ok: false, mode, logs };
  } finally {
    if (shouldCloseBrowser && !shouldKeepOpenForDebug && mode !== "draft") {
      await browser.close();
      addLog(logs, "Tarayıcı kapatıldı.", "INFO");
    } else if (shouldCloseBrowser && shouldKeepOpenForDebug) {
      addLog(logs, "Tarayıcı debug amaçlı açık bırakıldı.", "WARN");
    }
  }
}

