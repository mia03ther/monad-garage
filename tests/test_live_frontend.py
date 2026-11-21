"""Static wiring checks only; these do not claim browser/WebGL verification."""
from html.parser import HTMLParser
from pathlib import Path
import re


def test_relaunch_dom_and_resource_wiring() -> None:
    root = Path(__file__).resolve().parents[1] / "frontend"

    class Resources(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.ids: set[str] = set()
            self.paths: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            for name, value in attrs:
                if not value:
                    continue
                if name == "id":
                    self.ids.add(value)
                if name in {"href", "src"} and not value.startswith(("#", "http:", "https:", "data:")):
                    self.paths.append(value.split("?")[0].split("#")[0])

    play = Resources()
    play.feed((root / "play.html").read_text())
    app = (root / "community/app.js").read_text()
    referenced = set(re.findall(r'''\$\(['"]([^'"]+)['"]\)''', app))
    assert len(referenced) > 30
    assert referenced <= play.ids
    assert {
        "briefing-dialog",
        "briefing-start",
        "briefing-live",
        "briefing-close",
        "help",
        "latency",
    } <= play.ids
    assert "至少 3 人协作" in (root / "play.html").read_text(
        encoding="utf-8"
    )
    assert "startedAt: Date.now()" in app
    assert "for (const k of [2, 3, 4, 7, 1])" in app
    landing = (root / "community/landing.css").read_text(encoding="utf-8")
    assert ".hero" in landing and "min-height: 100dvh" in landing
    assert "--monad: #836ef9" in landing and "--signal: #f0ff66" in landing
    design = (root.parent / "docs" / "DESIGN_SYSTEM.md").read_text(encoding="utf-8")
    assert "live broadcast control system" in design
    assert "object-fit: cover" in landing
    for name in ("index.html", "play.html", "legacy.html"):
        page = Resources()
        page.feed((root / name).read_text(encoding="utf-8-sig"))
        for path in page.paths:
            assert (root / path).is_file(), (name, path)
    for module in (root / "community").glob("*.js"):
        for path in re.findall(r"from ['\"]([^'\"]+)['\"]", module.read_text()):
            if path.startswith("."):
                assert (module.parent / path).is_file(), (module, path)
