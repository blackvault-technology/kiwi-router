import base64
import json
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

from websocket import create_connection

origin = "https://kiwi-router.vercel.app"
output_dir = Path("/home/ubuntu/screenshots/kiwi-router-public-qa")
profile_dir = Path("/tmp/kiwi-router-public-cdp-profile")
output_dir.mkdir(parents=True, exist_ok=True)
shutil.rmtree(profile_dir, ignore_errors=True)

chrome = subprocess.Popen([
    "chromium", "--headless=new", "--no-sandbox", "--disable-gpu",
    "--remote-debugging-port=9223", "--remote-allow-origins=*",
    f"--user-data-dir={profile_dir}", "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def read_json(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode())

for _ in range(50):
    try:
        tabs = read_json("http://127.0.0.1:9223/json")
        if tabs:
            break
    except Exception:
        time.sleep(0.2)
else:
    chrome.terminate()
    raise RuntimeError("Chromium DevTools endpoint did not start.")

ws = create_connection(tabs[0]["webSocketDebuggerUrl"], suppress_origin=True)
request_id = 0

def cdp(method, params=None):
    global request_id
    request_id += 1
    current = request_id
    ws.send(json.dumps({"id": current, "method": method, "params": params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get("id") == current:
            if "error" in message:
                raise RuntimeError(f"{method}: {message['error']}")
            return message.get("result", {})

def evaluate(expression):
    result = cdp("Runtime.evaluate", {"expression": expression, "returnByValue": True, "awaitPromise": True})
    return result.get("result", {}).get("value")

def capture(viewport, width, height, route):
    cdp("Emulation.setDeviceMetricsOverride", {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 600})
    cdp("Page.navigate", {"url": f"{origin}{route}"})
    time.sleep(3.5 if route == "/status" else 1.5)
    body = evaluate("document.body.innerText") or ""
    overflow = evaluate("document.documentElement.scrollWidth > window.innerWidth + 2")
    image = cdp("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
    name = "home" if route == "/" else route.strip("/").replace("/", "-")
    screenshot = output_dir / f"{viewport}-{name}.png"
    screenshot.write_bytes(base64.b64decode(image["data"]))
    return {"viewport": viewport, "route": route, "screenshot": str(screenshot), "renderedCharacters": len(body.strip()), "horizontalOverflow": overflow, "preview": body[:160].replace("\n", " ")}

try:
    cdp("Page.enable")
    cdp("Runtime.enable")
    routes = ["/", "/about", "/docs", "/status", "/terms", "/privacy", "/acceptable-use", "/cookies"]
    results = []
    for viewport, width, height in [("desktop", 1280, 900), ("mobile", 375, 812)]:
        for route in routes:
            results.append(capture(viewport, width, height, route))
    (output_dir / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))
finally:
    ws.close()
    chrome.terminate()
    chrome.wait(timeout=10)
