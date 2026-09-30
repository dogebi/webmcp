# Chrome에서 WebP와 Archify 도식, 섹션 이동을 검증하고 미리보기를 내보냅니다.
import argparse
import base64
import io
import json
import re
import subprocess
import tempfile
import threading
import time
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import websocket
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
args = argparse.ArgumentParser()
args.add_argument("--export-webp", action="store_true")
options = args.parse_args()


class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
profile = Path(tempfile.mkdtemp(prefix="webmcp-browser-"))
chrome = Path("C:/Program Files/Google/Chrome/Application/chrome.exe")
proc = subprocess.Popen([
    str(chrome), "--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=0", "--remote-allow-origins=*",
    f"--user-data-dir={profile}", "--window-size=1440,1000", "about:blank",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)

try:
    deadline = time.time() + 20
    while not (profile / "DevToolsActivePort").exists():
        assert time.time() < deadline, "Chrome did not start"
        time.sleep(.1)
    port = (profile / "DevToolsActivePort").read_text().splitlines()[0]
    pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
    target = next(page for page in pages if page["type"] == "page")
    ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=30)
    sequence = 0

    def call(method, params=None):
        global sequence
        sequence += 1
        ws.send(json.dumps({"id": sequence, "method": method, "params": params or {}}))
        while True:
            result = json.loads(ws.recv())
            if result.get("id") == sequence:
                assert "error" not in result, result
                return result.get("result", {})

    def evaluate(code):
        result = call("Runtime.evaluate", {"expression": code, "awaitPromise": True, "returnByValue": True})
        assert "exceptionDetails" not in result, result
        return result["result"].get("value")

    def navigate(path):
        call("Page.navigate", {"url": f"http://127.0.0.1:{server.server_port}/{path}"})
        time.sleep(.2)
        deadline = time.time() + 15
        while evaluate("document.readyState") != "complete":
            assert time.time() < deadline, "Page load timed out"
            time.sleep(.1)

    call("Page.enable")
    diagrams = sorted((ROOT / "diagrams").glob("*.html"))
    assert len(diagrams) == 20
    for path in diagrams:
        navigate(f"diagrams/{path.name}?theme=dark")
        assert evaluate("document.querySelector('svg').dataset.animation") == "trace"
        assert evaluate("document.getAnimations().length") > 0
        assert evaluate("document.documentElement.dataset.theme") == "dark"
        evaluate("document.querySelector('#btn-theme').click()")
        assert evaluate("document.documentElement.dataset.theme") == "light"
        evaluate("document.querySelector('#btn-theme').click(); document.querySelector('#btn-export').click()")
        assert evaluate("document.querySelector('#export-menu').classList.contains('open')")
        evaluate("Archify.exportMenu.close(false)")
        if options.export_webp:
            call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
            evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
            box = evaluate("JSON.parse(JSON.stringify(document.querySelector('svg').getBoundingClientRect()))")
            clip = {key: box[key] for key in ["x", "y", "width", "height"]}
            clip["scale"] = 2
            capture = call("Page.captureScreenshot", {"format": "png", "clip": clip, "captureBeyondViewport": True})
            with Image.open(io.BytesIO(base64.b64decode(capture["data"]))) as image:
                image.save(ROOT / "assets" / f"{path.stem}-v2.webp", "WEBP", quality=85, method=6)
            call("Emulation.setEmulatedMedia", {"features": []})
    print("PASS: 20 Archify diagrams, animation, theme toggle and export menus")

    if options.export_webp:
        page = ROOT / "index.html"
        text = page.read_text(encoding="utf-8")

        def dimensions(match):
            tag = match.group(0)
            source = re.search(r'src="([^"]+)"', tag)[1]
            with Image.open(ROOT / source) as image:
                width, height = image.size
            tag = re.sub(r' width="\d+" height="\d+"', "", tag)
            return tag[:-1] + f' width="{width}" height="{height}">'

        page.write_text(re.sub(r'<img[^>]+src="assets/[^>]+>', dimensions, text), encoding="utf-8")

    navigate("")
    evaluate("document.documentElement.style.scrollBehavior='auto'")
    print(evaluate("""(async()=>{
      const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
      const wait=()=>new Promise(r=>setTimeout(r,200));
      const rail=document.querySelector('.section-rail');
      assert(!rail.classList.contains('is-visible'),'initial visibility');
      for(const link of rail.querySelectorAll('a:not(.back-to-top)')){
        link.click();await wait();
        assert(rail.classList.contains('is-visible'),'scrolled visibility');
        assert(link.getAttribute('aria-current')==='location',link.hash);
      }
      for(const poster of document.querySelectorAll('.diagram-poster')){
        const image=new Image();image.src=poster.src;await image.decode();
        assert(image.naturalWidth===Number(poster.getAttribute('width')),'intrinsic dimensions');
      }
      document.querySelector('.back-to-top').click();await wait();
      assert(scrollY<250&&!rail.classList.contains('is-visible'),'TOP');
      const frame=document.querySelector('.archify-diagram');
      await new Promise(r=>setTimeout(r,500));
      assert(frame.parentElement.classList.contains('is-ready'),'poster replaced');
      assert(frame.contentDocument.querySelector('svg').dataset.animation==='trace','embedded animation');
      assert(frame.contentDocument.documentElement.scrollHeight<=frame.clientHeight+2,'diagram clipping');
      return 'PASS: 7 section anchors/current markers, TOP, WebP decoding and animated embed';
    })()"""))
    capture = call("Page.captureScreenshot", {"format": "png"})
    (profile / "desktop.png").write_bytes(base64.b64decode(capture["data"]))
    call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
    print(evaluate("""(async()=>{
      document.querySelector('.section-rail a[href="#how"]').click();
      await new Promise(r=>setTimeout(r,300));
      const r=document.querySelector('.section-rail').getBoundingClientRect();
      if(r.left<0||r.right>innerWidth||r.bottom>innerHeight)throw Error('mobile rail overflow');
      if(document.documentElement.scrollWidth>innerWidth)throw Error('horizontal overflow');
      return 'PASS: mobile 390px rail and page fit viewport';
    })()"""))
    capture = call("Page.captureScreenshot", {"format": "png"})
    (profile / "mobile.png").write_bytes(base64.b64decode(capture["data"]))
    print(f"Screenshots: {profile}")
    call("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]})
    evaluate("document.documentElement.style.removeProperty('scroll-behavior')")
    assert evaluate("getComputedStyle(document.documentElement).scrollBehavior") == "auto"
    assert evaluate("getComputedStyle(document.querySelector('.archify-diagram').contentDocument.querySelector('[data-animate]')).animationName") == "none"
    print("PASS: reduced-motion scrolling")
finally:
    proc.terminate()
    server.shutdown()
