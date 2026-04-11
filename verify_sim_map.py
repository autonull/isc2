from playwright.sync_api import Page, expect, sync_playwright

def test_map_animation(page: Page):
  # Use the shared main app server port or start one
  import subprocess
  import time
  # Start the dev server in the background for this script
  proc = subprocess.Popen(["npx", "vite", "--port", "5174"], cwd="apps/simulation")
  time.sleep(3) # Wait for startup

  try:
      page.goto("http://localhost:5174")

      # Give it some time to layout and animate
      page.wait_for_timeout(2000)

      # Take a screenshot to verify the animation lines and pulses
      page.screenshot(path="/home/jules/verification/sim_map_animated.png")
  finally:
      proc.terminate()

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_map_animation(page)
    finally:
      browser.close()
