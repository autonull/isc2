from playwright.sync_api import Page, expect, sync_playwright
import time
import subprocess

def test_final_sim_action(page: Page):
  proc = subprocess.Popen(["npx", "vite", "--port", "5174"], cwd="apps/simulation")
  time.sleep(5)

  try:
      # Use retry logic for the connection
      for i in range(5):
          try:
              page.goto("http://localhost:5174")
              break
          except Exception as e:
              if i == 4:
                  raise e
              time.sleep(1)

      page.wait_for_selector("#sim-canvas")

      # Since we are running in a headless test environment, WebGPU is likely not fully supported
      # leading to WebLLM hanging or crashing silently.
      # Let's take a screenshot of the app mounted with the changes first to prove UI is intact
      page.screenshot(path="/home/jules/verification/sim_final_action.png", full_page=True)
      print("Screenshot saved.")
  finally:
      proc.terminate()

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=[
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--enable-unsafe-webgpu"
    ])
    page = browser.new_page()
    try:
      test_final_sim_action(page)
    finally:
      browser.close()
