from playwright.sync_api import sync_playwright
import subprocess
import time

def run():
    proc = subprocess.Popen(["npx", "vite", "--port", "5174"], cwd="apps/simulation")
    time.sleep(3)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(f"{msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: console_msgs.append(f"PAGE ERROR: {exc}"))

        try:
            page.goto("http://localhost:5174")
            page.wait_for_selector("#sim-canvas")

            # Print Canvas Dimensions
            dims = page.evaluate("() => { const c = document.getElementById('sim-canvas'); return {w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight}; }")
            print(f"Canvas Dimensions: {dims}")

            # Start simulation
            page.locator('#btn-toggle-sim').click()
            time.sleep(2)
        finally:
            browser.close()
            proc.terminate()

        print("\n--- CONSOLE OUTPUT ---")
        for m in console_msgs:
            print(m)

if __name__ == "__main__":
    run()
