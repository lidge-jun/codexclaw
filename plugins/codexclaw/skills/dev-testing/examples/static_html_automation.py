from playwright.sync_api import expect, sync_playwright
import os

# Example: Automating interaction with static HTML files using file:// URLs

html_file_path = os.path.abspath('path/to/your/file.html')
file_url = f'file://{html_file_path}'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1920, 'height': 1080})

    # Navigate to local HTML file
    page.goto(file_url)
    form = page.get_by_role("form", name="Contact")
    expect(form).to_be_visible()

    # Take screenshot
    page.screenshot(path='/mnt/user-data/outputs/static_page.png', full_page=True)

    # Interact with elements
    page.get_by_role("button", name="Click Me").click()
    page.get_by_role("textbox", name="Name").fill('John Doe')
    page.get_by_role("textbox", name="Email").fill('john@example.com')

    # Submit form
    page.get_by_role("button", name="Submit").click()
    expect(page.get_by_role("status")).to_contain_text("submitted")

    # Take final screenshot
    page.screenshot(path='/mnt/user-data/outputs/after_submit.png', full_page=True)

    browser.close()

print("Static HTML automation completed!")
