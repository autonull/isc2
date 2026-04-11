from playwright.sync_api import sync_playwright
import subprocess
import time

def run():
    proc = subprocess.Popen(["npx", "vite", "--port", "5174"], cwd="apps/simulation")
    time.sleep(5)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            for i in range(5):
              try:
                  page.goto("http://localhost:5174")
                  break
              except Exception:
                  time.sleep(1)

            page.wait_for_selector("#sim-canvas")
            time.sleep(2)

            page.set_viewport_size({"width": 1400, "height": 900})

            # Start simulation immediately
            page.locator('#btn-toggle-sim').click()
            time.sleep(15)

            # Check context status
            render_check = page.evaluate("""() => {
              const canvas = document.getElementById('sim-canvas');
              if (!canvas) return 'No canvas';

              const ctx = canvas.getContext('2d');
              if (!ctx) return 'No ctx';

              return `w=${canvas.width}, h=${canvas.height}, cw=${canvas.clientWidth}, ch=${canvas.clientHeight}`;
            }""")
            print("Canvas Check:", render_check)

            page.screenshot(path="/home/jules/verification/sim_fullscreen.png", full_page=True)
            print("Screenshot saved.")

        finally:
            browser.close()
            proc.terminate()

if __name__ == "__main__":
    run()
