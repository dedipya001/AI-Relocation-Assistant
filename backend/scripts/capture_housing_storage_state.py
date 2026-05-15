import argparse
import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Capture Housing.com Playwright storage state from a human-verified browser session.")
    parser.add_argument(
        "--output",
        default="backend/scripts/housing_storage_state.json",
        help="Where to save Playwright storage state JSON.",
    )
    parser.add_argument(
        "--url",
        default="https://housing.com/rent/flats-for-rent-in-kolkata-west-bengal-P40qcmycif4m431jo",
        help="Housing URL to open before saving state.",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(locale="en-IN", timezone_id="Asia/Kolkata")
        await context.add_init_script(
            """
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            """
        )
        page = await context.new_page()
        await page.goto(args.url, wait_until="domcontentloaded", timeout=90000)

        print("Browser opened.")
        print("Complete any challenge/login manually in the browser window.")
        print("When done, return to this terminal and press Enter to save storage state.")
        input()

        await context.storage_state(path=str(output_path))
        await context.close()
        await browser.close()

    print(f"Saved storage state to: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
