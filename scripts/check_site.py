# WebMCP 가이드의 내부 링크와 이미지 경로를 확인합니다.
from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


class SiteCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.references = []
        self.images = []
        self.resources = []
        self.missing_alt = []
        self.diagrams = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                raise AssertionError(f"duplicate id: {attrs['id']}")
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.references.append(attrs["href"][1:])
        if tag == "img":
            if attrs.get("src"):
                self.images.append(attrs["src"])
            if "alt" not in attrs:
                self.missing_alt.append(attrs.get("src", "(unknown image)"))
        if tag == "script" and attrs.get("src"):
            self.resources.append(attrs["src"])
        if tag == "iframe":
            assert attrs.get("title"), "diagram iframe missing title"
            assert attrs.get("loading") == "lazy", "diagram must lazy load"
            assert attrs.get("scrolling") == "no", "diagram iframe scrollbar must be hidden"
            self.diagrams.append(attrs["src"].split("?")[0])
        if tag == "link" and attrs.get("href", "").startswith("http") is False:
            self.resources.append(attrs.get("href", ""))


page = ROOT / "index.html"
parser = SiteCheck()
page_text = page.read_text(encoding="utf-8-sig")
parser.feed(page_text)
assert "영상에서 확인하기." not in page_text and "영상 열기" not in page_text
assert parser.images, "no images found"
assert not parser.missing_alt, f"images missing alt text: {parser.missing_alt}"
assert not (set(parser.references) - parser.ids), f"broken anchors: {set(parser.references) - parser.ids}"
missing = [src for src in parser.images if not src.startswith(("http://", "https://")) and not (ROOT / src).is_file()]
assert not missing, f"missing images: {missing}"
missing = [src for src in parser.resources if not (ROOT / src).is_file()]
assert not missing, f"missing page resources: {missing}"
assert (ROOT / "styles.css").is_file() and (ROOT / "app.js").is_file()
local_images = [src for src in parser.images if not src.startswith(("http://", "https://"))]
assert len(local_images) == len(parser.diagrams) == 21
for src in local_images:
    assert src.endswith(".webp"), f"non-WebP image: {src}"
    data = (ROOT / src).read_bytes()
    assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", f"invalid WebP: {src}"
for src in parser.diagrams:
    path = ROOT / src
    html = path.read_text(encoding="utf-8")
    assert "??" not in html, f"corrupted text: {src}"
    assert "Built with Archify" not in html and "Press <kbd>T</kbd>" not in html, f"Archify footer message remains: {src}"
    source = json.loads(path.with_suffix(".architecture.json").read_text(encoding="utf-8"))
    assert source["meta"]["animation"] == "trace"
    for marker in ['data-animation="trace"', 'data-animate="node"', 'pulse-dot', 'prefers-reduced-motion', 'btn-theme', 'export-menu']:
        assert marker in html, f"missing animation/control marker {marker}: {src}"
    if source["connections"]:
        assert 'data-animate="edge"' in html, f"missing animated arrows: {src}"
print(f"OK: {len(parser.ids)} unique IDs, {len(parser.images)} image references, all local assets and anchors resolve")
print("OK: 21 WebP images and embedded Archify diagrams; 21 diagram sources retain trace animation, theme/export and reduced motion")
