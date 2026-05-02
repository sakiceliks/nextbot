
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function debug() {
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const json = await response.json();
    const wsUrl = json.webSocketDebuggerUrl;

    const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
    const pages = await browser.pages();
    const page = pages.find(p => p.url().includes('sahibinden.com')) || pages[0];

    console.log('Connected to page:', page.url());

    const status = await page.evaluate(() => {
      const input = document.querySelector('#uploadImageField');
      if (!input) return 'Input not found';
      
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      
      return {
        id: input.id,
        tagName: input.tagName,
        type: (input as any).type,
        disabled: (input as any).disabled,
        visible: rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden',
        rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        parentClass: input.parentElement?.className,
        hasNgClick: input.hasAttribute('ng-click'),
        hasNgfSelect: input.hasAttribute('ngf-select'),
        angularDefined: typeof (window as any).angular !== 'undefined'
      };
    });

    console.log('Input Status:', JSON.stringify(status, null, 2));

    const screenshotPath = path.join(process.cwd(), '.nextbot', 'debug_inspect.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Screenshot saved to:', screenshotPath);

    await browser.disconnect();
  } catch (err) {
    console.error('Debug error:', err);
  }
}

debug();
