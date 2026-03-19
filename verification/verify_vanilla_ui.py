from playwright.sync_api import sync_playwright

def verify_vanilla_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'])
        context = browser.new_context(
            ignore_https_errors=True,
            permissions=['camera', 'microphone']
        )
        page = context.new_page()
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))

        page.goto("http://localhost:3000/")

        try:
            page.wait_for_selector("#app-layout", state="visible", timeout=5000)
        except Exception as e:
            print("Failed to load layout. Taking screenshot of whatever is there...")
            page.screenshot(path="/app/verification/0_failed_load.png")
            raise e

        page.screenshot(path="/app/verification/1_now_screen.png")

        page.locator(".irc-nav-item[data-tab='discover']").click()
        page.wait_for_selector(".discover-screen", state="visible")
        page.screenshot(path="/app/verification/2_discover_screen.png")

        page.locator(".irc-nav-item[data-tab='chats']").click()
        page.wait_for_selector(".chats-screen", state="visible")
        page.screenshot(path="/app/verification/3_chats_screen.png")

        page.locator(".irc-nav-item[data-tab='video']").click()
        page.wait_for_selector(".video-call-screen", state="visible")
        page.screenshot(path="/app/verification/4_video_screen.png")

        page.locator(".irc-settings-btn").click()
        page.wait_for_selector(".settings-screen", state="visible")
        page.screenshot(path="/app/verification/5_settings_screen.png")

        browser.close()

if __name__ == "__main__":
    verify_vanilla_ui()
