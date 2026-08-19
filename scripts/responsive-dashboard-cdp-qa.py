import base64
import json
import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

from websocket import create_connection

origin = os.environ.get("QA_ORIGIN", "https://kiwi-router.vercel.app")
email = os.environ.get("QA_FOUNDER_EMAIL")
password = os.environ.get("FOUNDER_BOOTSTRAP_PASSWORD")
if not email or not password:
    raise RuntimeError("QA_FOUNDER_EMAIL and FOUNDER_BOOTSTRAP_PASSWORD are required.")

output_dir = Path("/home/ubuntu/screenshots/kiwi-router-dashboard-qa")
profile_dir = Path("/tmp/kiwi-router-cdp-qa-profile")
output_dir.mkdir(parents=True, exist_ok=True)
shutil.rmtree(profile_dir, ignore_errors=True)

chrome = subprocess.Popen([
    "chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
    "--remote-debugging-port=9222", "--remote-allow-origins=http://127.0.0.1:9222",
    f"--user-data-dir={profile_dir}", "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def get_json(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode())

for _ in range(50):
    try:
        tabs = get_json("http://127.0.0.1:9222/json")
        if tabs:
            break
    except Exception:
        time.sleep(0.2)
else:
    chrome.terminate()
    raise RuntimeError("Chromium DevTools endpoint did not start.")

ws = create_connection(tabs[0]["webSocketDebuggerUrl"], origin="http://127.0.0.1:9222")
counter = 0

def cdp(method, params=None):
    global counter
    counter += 1
    request_id = counter
    ws.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == request_id:
            if "error" in message:
                raise RuntimeError(f"{method}: {message['error']}")
            return message.get("result", {})

def evaluate(expression):
    result = cdp("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    return result.get("result", {}).get("value")

def navigate(url):
    cdp("Page.navigate", {"url": url})
    time.sleep(2.5)

def fill(placeholder, value):
    expression = """
      (() => {
        const el = [...document.querySelectorAll('input')].find(node => node.getAttribute('placeholder') === %s);
        if (!el) throw new Error('Input not found');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, %s);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    """ % (json.dumps(placeholder), json.dumps(value))
    evaluate(expression)

def click_button(name):
    expression = """
      (() => {
        const el = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === %s);
        if (!el) throw new Error('Button not found');
        el.click();
      })()
    """ % json.dumps(name)
    evaluate(expression)

def capture(label, route, width, height, expected_text):
    cdp("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 600})
    navigate(f"{origin}{route}")
    body = evaluate("document.body.innerText") or ""
    title_found = expected_text.lower() in body.lower()
    overflow = evaluate("document.documentElement.scrollWidth > window.innerWidth + 2")
    result = cdp("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
    screenshot = output_dir / f"{label}-{route.strip('/').replace('/', '-') or 'overview'}.png"
    screenshot.write_bytes(base64.b64decode(result["data"]))
    return {"viewport": label, "route": route, "screenshot": str(screenshot), "expectedText": expected_text, "titleFound": title_found, "horizontalOverflow": overflow, "bodyPreview": body[:220]}

try:
    cdp("Page.enable")
    cdp("Runtime.enable")
    navigate(f"{origin}/login")
    fill("Email", email)
    fill("Password", password)
    click_button("Sign in")
    time.sleep(3)
    if "/app" not in (evaluate("location.pathname") or ""):
        raise RuntimeError("Founder sign-in did not navigate to the dashboard.")

    routes = [
        ("/app", "Gateway overview"),
        ("/app/playground", "Playground"),
        ("/app/models", "Models"),
        ("/app/api-keys", "API Keys"),
        ("/app/analytics", "Usage analytics"),
        ("/app/admin", "Admin"),
    ]
    results = []
    for label, width, height in [("desktop", 1280, 900), ("mobile", 375, 812)]:
        for route, expected_text in routes:
            results.append(capture(label, route, width, height, expected_text))
    (output_dir / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
finally:
    ws.close()
    chrome.terminate()
    chrome.wait(timeout=10)
