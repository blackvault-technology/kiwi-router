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
email = os.environ["QA_FOUNDER_EMAIL"]
password = os.environ["FOUNDER_BOOTSTRAP_PASSWORD"]
output_dir = Path("/home/ubuntu/screenshots/kiwi-router-founder-console-qa")
profile_dir = Path("/tmp/kiwi-router-founder-console-qa")
output_dir.mkdir(parents=True, exist_ok=True)
shutil.rmtree(profile_dir, ignore_errors=True)

chrome = subprocess.Popen(["chromium", "--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9224", "--remote-allow-origins=*", f"--user-data-dir={profile_dir}", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def get_json(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode())

for _ in range(50):
    try:
        tabs = get_json("http://127.0.0.1:9224/json")
        if tabs:
            break
    except Exception:
        time.sleep(.2)
else:
    chrome.terminate()
    raise RuntimeError("Chromium DevTools endpoint did not start.")

ws = create_connection(tabs[0]["webSocketDebuggerUrl"], suppress_origin=True)
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
    value = cdp("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    return value.get("result", {}).get("value")

def navigate(url):
    cdp("Page.navigate", {"url": url})
    time.sleep(2)

def fill(placeholder, value):
    evaluate("""(() => { const node = [...document.querySelectorAll('input')].find(el => el.getAttribute('placeholder') === %s); if (!node) throw new Error('Input not found'); node.focus(); node.select(); })()""" % json.dumps(placeholder))
    cdp("Input.insertText", {"text": value})

def click(text):
    evaluate("""(() => { const node = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === %s); if (!node) throw new Error('Button not found: ' + %s); node.click(); })()""" % (json.dumps(text), json.dumps(text)))

def wait_for(text):
    body = ""
    for _ in range(15):
        body = evaluate("document.body.innerText") or ""
        if text.lower() in body.lower():
            return body
        time.sleep(1)
    raise RuntimeError(f"Expected text not rendered: {text}. Body: {body[:300]}")

def capture(viewport, width, height, tab, expected):
    cdp("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 600})
    navigate(f"{origin}/app/admin")
    wait_for("Founder command center")
    click(tab)
    body = wait_for(expected)
    overflow = evaluate("document.documentElement.scrollWidth > window.innerWidth + 2")
    image = cdp("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
    filename = output_dir / f"{viewport}-{tab.lower().replace(' ', '-')}.png"
    filename.write_bytes(base64.b64decode(image["data"]))
    return {"viewport": viewport, "tab": tab, "expected": expected, "titleFound": expected.lower() in body.lower(), "horizontalOverflow": overflow, "screenshot": str(filename)}

try:
    cdp("Page.enable")
    cdp("Runtime.enable")
    navigate(f"{origin}/login")
    fill("Email", email)
    fill("Password", password)
    click("Sign in")
    wait_for("Gateway overview")
    results = []
    for label, width, height in [("desktop", 1280, 900), ("mobile", 375, 812)]:
        for tab, expected in [("Operations", "Founder safety checklist"), ("Providers", "Provider inventory"), ("Model registry", "Route inventory"), ("Access & safety", "User security"), ("Growth", "Coupon program")]:
            results.append(capture(label, width, height, tab, expected))
    (output_dir / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
finally:
    ws.close()
    chrome.terminate()
    chrome.wait(timeout=10)
