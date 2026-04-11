from playwright.sync_api import sync_playwright
import subprocess
import time

def run():
    proc = subprocess.Popen(["npx", "vite", "--port", "5174"], cwd="apps/simulation")
    time.sleep(3)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            page.goto("http://localhost:5174")
            page.wait_for_selector("#sim-canvas")
            time.sleep(2)

            # Use a slightly wider viewport to be safe
            page.set_viewport_size({"width": 1280, "height": 800})

            # Check context
            has_context = page.evaluate("() => { const c = document.getElementById('sim-canvas'); return !!c.getContext('2d'); }")
            print(f"Has 2D Context: {has_context}")

            # Let's take a screenshot after resizing the viewport
            time.sleep(2)
            page.screenshot(path="/home/jules/verification/canvas_debug.png", full_page=True)
            print("Screenshot saved to /home/jules/verification/canvas_debug.png")

        finally:
            browser.close()
            proc.terminate()

if __name__ == "__main__":
    run()
