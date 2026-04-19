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
    logs.push("Kayitli browser session bulunamadi, yeni Chrome acilacak.");
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
        "Kayitli browser session endpointine ulasilamadi, yeni Chrome acilacak.",
      );
      return null;
    }

    const json = (await response.json()) as { webSocketDebuggerUrl?: string };
    if (!json.webSocketDebuggerUrl) {
      logs.push("Browser websocket adresi bulunamadi, yeni Chrome acilacak.");
      return null;
    }

    logs.push(`Mevcut Chrome oturumuna baglaniliyor (${session.port}).`);
    return puppeteer.connect({
      browserWSEndpoint: json.webSocketDebuggerUrl,
      defaultViewport: null,
    });
  } catch {
    logs.push(
      "Mevcut Chrome oturumuna baglanma denemesi basarisiz oldu, yeni Chrome acilacak.",
    );
    return null;
  }
}

function addLog(logs: string[], message: string) {
  logs.push(
    `[${new Date().toLocaleTimeString("tr-TR", { hour12: false })}] ${message}`,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const logs: string[] = [];
  let browser = await tryConnectToExistingBrowser(logs);
  let shouldCloseBrowser = false;
  let shouldKeepOpenForDebug = false;

  if (!browser) {
    try {
      browser = await puppeteer.launch({
        executablePath: resolveChromeExecutable(),
        headless: false,
        userDataDir: getUserDataDir(),
        defaultViewport: null,
        args: ["--start-maximized", "--remote-debugging-port=9222"],
      });
      shouldCloseBrowser = true;
      addLog(logs, "Yeni Chrome oturumu acildi.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Chrome baslatilamadi";
      addLog(logs, "Chrome acilamadi. Muhtemelen ayni profil zaten acik.");
      addLog(
        logs,
        "Uygulamadaki 'Tarayiciyi ac' veya 'Sahibinden oturum ac' butonuyla mevcut oturumu kullanin.",
      );
      addLog(logs, message);
      return { ok: false, mode, logs };
    }
  }

  const page = await browser.newPage();
  attachDebugLogging(browser, page, logs);

  try {
    addLog(logs, `Publish akisi basladi. Mod: ${mode}`);
    addLog(
      logs,
      `Yeni page olusturuldu. Baslangic URL: ${page.url() || "(bos)"}`,
    );
    addLog(logs, "Sahibinden ilan verme sayfasi aciliyor.");
    await page.goto(
      "https://banaozel.sahibinden.com/ilan-ver/adim-1?state=new",
      {
        waitUntil: "domcontentloaded",
      },
    );
    addLog(logs, `Ilk sayfa yuklendi. Aktif URL: ${page.url()}`);

    let categoryIndex = 0;
    for (const label of listing.categoryPath) {
      if (label === "Yedek Parça, Aksesuar, Donanım & Tuning") {
        continue;
      }
      addLog(logs, `Kategori seciliyor: ${label}`);
      await sleep(400);
      await clickCategoryItem(page, label);
      await sleep(500);
      categoryIndex += 1;

      if (categoryIndex === 1) {
        await dismissDraftResumeModal(page, logs);
      }
    }

    addLog(logs, "Kategori secimi tamamlandi, 'Ilan Ver' butonu bekleniyor.");
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
    addLog(logs, "'Ilan Ver' butonuna tiklandi.");

    await page.waitForSelector('input[name="addClassifiedTitle"]', {
      timeout: SELECTOR_TIMEOUT_MS,
    });
    addLog(logs, "Ilan detay formu bulundu.");
    addLog(logs, "Baslik alani dolduruluyor.");
    await fillInputValue(
      page,
      'input[name="addClassifiedTitle"]',
      listing.name,
    );
    addLog(logs, `Baslik dolduruldu: ${listing.name}`);
    addLog(logs, "Aciklama alani dolduruluyor.");
    await typeIntoContentEditable(
      page,
      '[contenteditable="true"][name="Açıklama"]',
      listing.description,
    );
    addLog(logs, "Aciklama alani dolduruldu.");
    addLog(logs, "Fiyat alani dolduruluyor.");
    await fillInputValue(page, "#addClassifiedPrice", String(listing.price));
    addLog(logs, `Fiyat dolduruldu: ${listing.price}`);
    await logVisibleSelects(page, logs);

    const productType = inferProductTypeForForm(
      listing.productType || listing.product,
    );

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
      addLog(
        logs,
        `Urun tipi secildi (${matched.mode} selector): ${productType} <- ${matched.selector}`,
      );
    } catch {
      try {
        await selectByLabelText(
          page,
          ["urun tipi", "parça tipi", "parca tipi", "ürün türü", "urun turu"],
          productType,
        );
        addLog(logs, `Urun tipi secildi (label fallback): ${productType}`);
      } catch (error) {
        addLog(
          logs,
          `Urun tipi secilemedi, devam ediliyor: ${error instanceof Error ? error.message : "unknown"}`,
        );
      }
    }

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
      addLog(
        logs,
        `Urun markasi secildi (${matched.mode} selector): ${DEFAULT_PRODUCT_BRAND} <- ${matched.selector}`,
      );
    } catch (error) {
      addLog(
        logs,
        `Urun markasi secilemedi, devam ediliyor: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

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
      addLog(
        logs,
        `Cikma yedek parca secildi (${matched.mode} selector): ${DEFAULT_USED_PART} <- ${matched.selector}`,
      );
    } catch (error) {
      addLog(
        logs,
        `Cikma yedek parca secilemedi, devam ediliyor: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    try {
      const matched = await selectUsingSelectorsWithHeuristic(
        page,
        ['select[name="condition"]'],
        DEFAULT_CONDITION,
      );
      addLog(
        logs,
        `Durum secildi (${matched.mode} selector): ${DEFAULT_CONDITION} <- ${matched.selector}`,
      );
    } catch (error) {
      addLog(
        logs,
        `Durum secilemedi, devam ediliyor: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    try {
      const matched = await selectUsingSelectorsWithHeuristic(
        page,
        ['select[name="exchange"]'],
        DEFAULT_EXCHANGE,
      );
      addLog(
        logs,
        `Takas secildi (${matched.mode} selector): ${DEFAULT_EXCHANGE} <- ${matched.selector}`,
      );
    } catch (error) {
      addLog(
        logs,
        `Takas secilemedi, devam ediliyor: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

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
      addLog(
        logs,
        `Marka secildi (${matched.mode} selector): ${listing.brand} <- ${matched.selector}`,
      );
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
        addLog(
          logs,
          `Marka secildi (heuristic fallback): ${listing.brand} <- ${selector}`,
        );
      } catch {
        await selectByLabelText(page, ["marka"], listing.brand);
        addLog(logs, `Marka secildi (label fallback): ${listing.brand}`);
      }
    }
    await sleep(600);
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
      addLog(
        logs,
        `Model secildi (${matched.mode} selector): ${listing.model} <- ${matched.selector}`,
      );
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
        addLog(
          logs,
          `Model secildi (heuristic fallback): ${listing.model} <- ${selector}`,
        );
      } catch {
        await selectByLabelText(page, ["model"], listing.model);
        addLog(logs, `Model secildi (label fallback): ${listing.model}`);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileInput = (await page.$("#uploadImageField")) as any;
    if (fileInput) {
      await fileInput.uploadFile(
        path.join(process.cwd(), listing.imagePath.replace(/^\//, "")),
      );
      addLog(logs, `Fotograf yüklendi: ${listing.imagePath}`);
    } else {
      addLog(logs, "Fotograf inputu bulunamadi, yukleme atlandi.");
    }

    try {
      await ensureCheckboxChecked(page, "#autoPublishAuction");
      addLog(logs, "Otomatik yeniden yayin checkbox isaretlendi.");
    } catch (error) {
      addLog(
        logs,
        `Otomatik yeniden yayin checkbox bulunamadi veya isaretlenemedi: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }

    try {
      await ensureCheckboxChecked(page, "#showSendMessage");
      addLog(logs, "Mesaj almak istemiyorum checkbox isaretlendi.");
    } catch (error) {
      addLog(
        logs,
        `Mesaj tercihi checkbox bulunamadi veya isaretlenemedi: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }

    await ensureCheckboxChecked(page, "#postRulesCheck");
    addLog(logs, "Kurallar checkbox isaretlendi.");

    if (mode === "draft") {
      addLog(logs, "Draft modu secildi; son yayin adimindan once duruldu.");
      return { ok: true, mode, logs };
    }

    addLog(logs, "Devam butonundan once 3 saniye bekleniyor.");
    await sleep(3_000);
    const continueTrigger = await clickContinueButton(page);
    addLog(logs, `Devam butonuna tiklandi. Yontem: ${continueTrigger}`);
    addLog(logs, "Yayin akisi tetiklendi.");

    await page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => null);
    addLog(logs, `Devam sonrasi aktif URL: ${page.url()}`);

    const stepThreeTrigger = await clickStepThreeContinue(page);
    addLog(
      logs,
      `Adim 3 Devam Et butonuna tiklandi. Yontem: ${stepThreeTrigger}`,
    );
    await page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 })
      .catch(() => null);
    addLog(logs, `Adim 4 aktif URL: ${page.url()}`);
    await dismissDopingModal(page, logs);
    const dopingContinueTrigger = await clickDopingContinueButton(page);
    addLog(
      logs,
      `Doping sonrasi Devam Et butonuna tiklandi. Yontem: ${dopingContinueTrigger}`,
    );

    return { ok: true, mode, logs };
  } catch (error) {
    shouldKeepOpenForDebug = true;
    addLog(logs, `Puppeteer hata yakaladi. Son URL: ${page.url()}`);

    try {
      const title = await page.title();
      addLog(logs, `Sayfa basligi: ${title || "(bos)"}`);
    } catch {
      addLog(logs, "Sayfa basligi okunamadi.");
    }

    try {
      await persistDebugScreenshot(page, logs);
    } catch (screenshotError) {
      addLog(
        logs,
        `Screenshot alinamadi: ${screenshotError instanceof Error ? screenshotError.message : "unknown"}`,
      );
    }

    addLog(
      logs,
      error instanceof Error ? error.message : "Bilinmeyen Puppeteer hatasi",
    );
    return { ok: false, mode, logs };
  } finally {
    if (shouldCloseBrowser && !shouldKeepOpenForDebug && mode !== "draft") {
      await browser.close();
    } else if (shouldCloseBrowser && shouldKeepOpenForDebug) {
      addLog(logs, "Browser debug amaciyla acik birakildi.");
    }
  }
}
