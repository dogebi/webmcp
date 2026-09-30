# WebMCP 가이드의 내부 링크와 이미지 경로를 확인합니다.
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SiteCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.references = []
        self.images = []
        self.resources = []
        self.missing_alt = []

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
        if tag == "link" and attrs.get("href", "").startswith("http") is False:
            self.resources.append(attrs.get("href", ""))


page = ROOT / "index.html"
parser = SiteCheck()
parser.feed(page.read_text(encoding="utf-8-sig"))
assert parser.images, "no images found"
assert not parser.missing_alt, f"images missing alt text: {parser.missing_alt}"
assert not (set(parser.references) - parser.ids), f"broken anchors: {set(parser.references) - parser.ids}"
missing = [src for src in parser.images if not (ROOT / src).is_file()]
assert not missing, f"missing images: {missing}"
missing = [src for src in parser.resources if not (ROOT / src).is_file()]
assert not missing, f"missing page resources: {missing}"
assert (ROOT / "styles.css").is_file() and (ROOT / "app.js").is_file()
print(f"OK: {len(parser.ids)} unique IDs, {len(parser.images)} image references, all local assets and anchors resolve")
