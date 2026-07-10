from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})

    # Go to login page
    page.goto('http://localhost:3000/login')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='/tmp/login-before.png', full_page=True)
    print("Screenshot 1: login page saved")

    # Enter phone number
    phone_input = page.locator('input[type="tel"]')
    phone_input.fill('01047242316')

    # Enter password
    pw_input = page.locator('input[type="password"]')
    pw_input.fill('1004')

    # Click login button
    login_btn = page.locator('button[type="submit"]')
    login_btn.click()

    # Wait for navigation
    page.wait_for_timeout(5000)
    page.screenshot(path='/tmp/login-after.png', full_page=True)
    print(f"Screenshot 2: after login, URL = {page.url}")

    browser.close()
