import { Command } from "commander";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import readline from "readline";

async function main() {
  const program = new Command();
  program
    .description("Capture Housing.com Playwright storage state from a human session.")
    .option("--output <path>", "Where to save Playwright storage state JSON", "scripts/housing_storage_state.json")
    .option(
      "--url <url>",
      "Housing URL to open",
      "https://housing.com/rent/flats-for-rent-in-kolkata-west-bengal-P40qcmycif4m431jo"
    );

  program.parse();
  const options = program.opts();

  const outputPath = path.resolve(options.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  `);

  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: "domcontentloaded", timeout: 90000 });

  console.log("Browser opened.");
  console.log("Complete any challenge/login manually in the browser window.");
  console.log("When done, return to this terminal and press Enter to save storage state.");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("", resolve));
  rl.close();

  await context.storageState({ path: outputPath });
  await context.close();
  await browser.close();

  console.log(`Saved storage state to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Failed to capture storage state:", err);
  process.exit(1);
});
