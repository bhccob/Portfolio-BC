"""Site auditor: checks the built site (``dist/client/``) before it is deployed.

Every HTML page is parsed and run through a set of rules: titles, meta
descriptions, a single h1, alt text, canonical and hreflang links, Open Graph
tags, structured data and internal links (including ``#fragment`` targets),
plus the security basics a static host leaves to the page itself: a
Content-Security-Policy, safe ``target="_blank"`` links, no insecure
``http://`` resources and redirect stubs that stay out of search results.
Errors fail the build, so a broken page never reaches bhccob.me.

Standard library only. Usage::

    python tools/site_audit.py dist/client [--origin https://bhccob.me] [--strict] [--json]
"""

from __future__ import annotations

import argparse
import json
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, Iterator
from urllib.parse import unquote, urlparse

DEFAULT_ORIGIN = "https://bhccob.me"
EXPECTED_LOCALES = ("en", "nl", "x-default")
SKIPPED_SCHEMES = ("mailto:", "tel:", "javascript:", "data:")
# Directives every page's Content-Security-Policy must set (the rest are page-specific hashes).
REQUIRED_CSP_DIRECTIVES = ("default-src", "script-src", "object-src", "base-uri")
# Elements and attributes that make the browser fetch something.
RESOURCE_ATTRIBUTES = {"script": "src", "img": "src", "source": "src", "iframe": "src", "audio": "src", "video": "src", "link": "href"}


# --------------------------------------------------------------------------- #
# Results
# --------------------------------------------------------------------------- #


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True)
class Issue:
    severity: Severity
    page: str
    rule: str
    message: str


@dataclass
class AuditReport:
    issues: list[Issue] = field(default_factory=list)
    pages_checked: int = 0

    def extend(self, issues: Iterable[Issue]) -> None:
        self.issues.extend(issues)

    @property
    def errors(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.severity is Severity.ERROR]

    @property
    def warnings(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.severity is Severity.WARNING]

    def exit_code(self, strict: bool = False) -> int:
        failing = self.errors + (self.warnings if strict else [])
        return 1 if failing else 0

    def render(self) -> str:
        lines = [f"Audited {self.pages_checked} page(s)."]
        for issue in sorted(self.issues, key=lambda item: (item.severity.value, item.page, item.rule)):
            marker = "✖" if issue.severity is Severity.ERROR else "!"
            lines.append(f"  {marker} [{issue.rule}] {issue.page}: {issue.message}")
        lines.append(f"{len(self.errors)} error(s), {len(self.warnings)} warning(s).")
        return "\n".join(lines)

    def to_json(self) -> str:
        return json.dumps(
            {
                "pages": self.pages_checked,
                "errors": len(self.errors),
                "warnings": len(self.warnings),
                "issues": [
                    {"severity": i.severity.value, "page": i.page, "rule": i.rule, "message": i.message}
                    for i in self.issues
                ],
            },
            indent=2,
        )


# --------------------------------------------------------------------------- #
# Parsing
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Image:
    src: str
    has_alt: bool


class PageParser(HTMLParser):
    """Collects the handful of facts the rules need from one HTML document."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.title_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.http_equiv: dict[str, str] = {}
        self.canonical: str | None = None
        self.new_tab_links: list[tuple[str, str]] = []
        self.resources: list[str] = []
        self.alternates: dict[str, str] = {}
        self.anchors: list[str] = []
        self.images: list[Image] = []
        self.h1_count = 0
        self.ids: set[str] = set()
        self.json_ld: list[str] = []
        self._in_title = False
        self._in_json_ld = False
        self._json_buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = {name: (value or "") for name, value in attrs}
        if "id" in attributes:
            self.ids.add(attributes["id"])

        if tag == "html":
            self.lang = attributes.get("lang") or None
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = attributes.get("name") or attributes.get("property")
            if key:
                self.meta[key.lower()] = attributes.get("content", "")
            if "http-equiv" in attributes:
                self.http_equiv[attributes["http-equiv"].lower()] = attributes.get("content", "")
        elif tag == "link":
            rel = attributes.get("rel", "").lower().split()
            if "canonical" in rel:
                self.canonical = attributes.get("href")
            if "alternate" in rel and "hreflang" in attributes:
                self.alternates[attributes["hreflang"].lower()] = attributes.get("href", "")
        elif tag == "a" and "href" in attributes:
            self.anchors.append(attributes["href"])
            if attributes.get("target") == "_blank":
                self.new_tab_links.append((attributes["href"], attributes.get("rel", "").lower()))
        elif tag == "img":
            self.images.append(Image(src=attributes.get("src", ""), has_alt="alt" in attributes))

        if tag in RESOURCE_ATTRIBUTES and attributes.get(RESOURCE_ATTRIBUTES[tag]):
            # Hyperlink-like <link>s (canonical, alternate) are addresses, not downloads.
            rel = attributes.get("rel", "").lower().split()
            if tag != "link" or not {"canonical", "alternate"} & set(rel):
                self.resources.append(attributes[RESOURCE_ATTRIBUTES[tag]])
        if tag in ("img", "source") and attributes.get("srcset"):
            self.resources.extend(candidate.strip().split(" ")[0] for candidate in attributes["srcset"].split(","))
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "script" and attributes.get("type") == "application/ld+json":
            self._in_json_ld = True
            self._json_buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            self.json_ld.append("".join(self._json_buffer))

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._in_json_ld:
            self._json_buffer.append(data)


@dataclass
class Page:
    """One built HTML file, addressed by its URL path (``/contact/``)."""

    file: Path
    url_path: str
    lang: str | None
    title: str
    meta: dict[str, str]
    http_equiv: dict[str, str]
    canonical: str | None
    alternates: dict[str, str]
    anchors: list[str]
    images: list[Image]
    h1_count: int
    ids: set[str]
    json_ld: list[str]
    new_tab_links: list[tuple[str, str]] = field(default_factory=list)
    resources: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, file: Path, root: Path) -> "Page":
        parser = PageParser()
        parser.feed(file.read_text(encoding="utf-8"))
        return cls(
            file=file,
            url_path=Page.url_for(file, root),
            lang=parser.lang,
            title=" ".join("".join(parser.title_parts).split()),
            meta=parser.meta,
            http_equiv=parser.http_equiv,
            canonical=parser.canonical,
            alternates=parser.alternates,
            anchors=parser.anchors,
            images=parser.images,
            h1_count=parser.h1_count,
            ids=parser.ids,
            json_ld=parser.json_ld,
            new_tab_links=parser.new_tab_links,
            resources=parser.resources,
        )

    @staticmethod
    def url_for(file: Path, root: Path) -> str:
        relative = file.relative_to(root).as_posix()
        if relative == "index.html":
            return "/"
        if relative.endswith("/index.html"):
            return "/" + relative[: -len("index.html")]
        return "/" + relative

    @property
    def indexable(self) -> bool:
        return "noindex" not in self.meta.get("robots", "").lower()

    @property
    def redirects(self) -> bool:
        """A stub that only forwards visitors to another address."""
        return "refresh" in self.http_equiv


class Site:
    """All pages of the build plus helpers to resolve links between them."""

    def __init__(self, root: Path, origin: str) -> None:
        self.root = root
        self.origin = origin.rstrip("/")
        self.pages: dict[str, Page] = {
            page.url_path: page for page in (Page.load(file, root) for file in sorted(root.rglob("*.html")))
        }

    def page_for(self, path: str) -> Page | None:
        """Finds the page for a URL path, accepting `/a`, `/a/` and `/a/index.html`."""
        candidates = [path, path.rstrip("/") + "/", path.removesuffix("index.html")]
        for candidate in candidates:
            if candidate in self.pages:
                return self.pages[candidate]
        return None

    def has_file(self, path: str) -> bool:
        target = (self.root / unquote(path).lstrip("/")).resolve()
        return target.is_file() and self.root.resolve() in target.parents

    def is_internal(self, href: str) -> bool:
        parsed = urlparse(href)
        if not parsed.scheme and not parsed.netloc:
            return True
        return f"{parsed.scheme}://{parsed.netloc}" == self.origin


# --------------------------------------------------------------------------- #
# Rules
# --------------------------------------------------------------------------- #


class Rule(ABC):
    """A single check. Rules only run on indexable pages unless they say otherwise."""

    name: str = "rule"

    def applies_to(self, page: Page) -> bool:
        return page.indexable

    @abstractmethod
    def check(self, page: Page, site: Site) -> list[Issue]: ...

    def error(self, page: Page, message: str) -> Issue:
        return Issue(Severity.ERROR, page.url_path, self.name, message)

    def warning(self, page: Page, message: str) -> Issue:
        return Issue(Severity.WARNING, page.url_path, self.name, message)


class LangRule(Rule):
    name = "lang"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        return [] if page.lang else [self.error(page, "<html> has no lang attribute")]


class TitleRule(Rule):
    name = "title"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        if not page.title:
            return [self.error(page, "missing <title>")]
        issues: list[Issue] = []
        if page.indexable and not 10 <= len(page.title) <= 70:
            issues.append(self.warning(page, f"title is {len(page.title)} characters (aim for 10-70)"))
        duplicates = [
            other.url_path
            for other in site.pages.values()
            if other is not page and other.indexable and other.title == page.title
        ]
        if page.indexable and duplicates:
            issues.append(self.warning(page, f"title is shared with {', '.join(sorted(duplicates))}"))
        return issues


class MetaDescriptionRule(Rule):
    name = "description"

    def check(self, page: Page, site: Site) -> list[Issue]:
        description = page.meta.get("description", "").strip()
        if not description:
            return [self.error(page, "missing meta description")]
        if not 50 <= len(description) <= 170:
            return [self.warning(page, f"description is {len(description)} characters (aim for 50-170)")]
        return []


class SingleH1Rule(Rule):
    name = "h1"

    def check(self, page: Page, site: Site) -> list[Issue]:
        if page.h1_count == 1:
            return []
        return [self.error(page, f"expected exactly one <h1>, found {page.h1_count}")]


class ImageAltRule(Rule):
    name = "alt"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        return [self.error(page, f"<img src=\"{image.src}\"> has no alt attribute") for image in page.images if not image.has_alt]


class CanonicalRule(Rule):
    name = "canonical"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        if not page.canonical:
            return [self.error(page, "missing canonical link")] if page.indexable else []
        if not page.canonical.startswith(site.origin + "/"):
            return [self.error(page, f"canonical {page.canonical} is not on {site.origin}")]
        target = urlparse(page.canonical).path
        if site.page_for(target) is None:
            return [self.error(page, f"canonical points to a page that does not exist: {target}")]
        return []


class HreflangRule(Rule):
    name = "hreflang"

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues = [self.error(page, f"missing hreflang alternate for {locale}") for locale in EXPECTED_LOCALES if locale not in page.alternates]
        for locale, href in page.alternates.items():
            if site.page_for(urlparse(href).path) is None:
                issues.append(self.error(page, f"hreflang {locale} points to a missing page: {href}"))
        return issues


class OpenGraphRule(Rule):
    name = "open-graph"
    REQUIRED = ("og:title", "og:description", "og:image", "og:url", "twitter:card")

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues = [self.error(page, f"missing <meta> {key}") for key in self.REQUIRED if not page.meta.get(key)]
        image = page.meta.get("og:image", "")
        if image and site.is_internal(image) and not site.has_file(urlparse(image).path):
            issues.append(self.error(page, f"og:image file not found: {image}"))
        return issues


class StructuredDataRule(Rule):
    name = "json-ld"

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues: list[Issue] = []
        for block in page.json_ld:
            try:
                json.loads(block)
            except json.JSONDecodeError as error:
                issues.append(self.error(page, f"invalid JSON-LD: {error.msg} (line {error.lineno})"))
        return issues


class InternalLinkRule(Rule):
    """Every internal link must resolve to a built page or file, including `#fragment` targets."""

    name = "links"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues: list[Issue] = []
        for href in dict.fromkeys(page.anchors):  # de-duplicate, keep order
            if not href or href.startswith(SKIPPED_SCHEMES) or not site.is_internal(href):
                continue
            parsed = urlparse(href)
            path = parsed.path or page.url_path
            fragment = unquote(parsed.fragment)
            target = site.page_for(path)
            if target is None:
                if not site.has_file(path):
                    issues.append(self.error(page, f"broken link: {href}"))
                continue
            if fragment and fragment != "top" and fragment not in target.ids:
                issues.append(self.error(page, f"link {href} points to a missing #{fragment}"))
        return issues


class ContentSecurityPolicyRule(Rule):
    """Every real page carries a CSP; GitHub Pages cannot send one as a header."""

    name = "csp"

    def check(self, page: Page, site: Site) -> list[Issue]:
        policy = page.http_equiv.get("content-security-policy", "")
        if not policy:
            return [self.error(page, "missing Content-Security-Policy <meta>")]
        directives = {part.strip().split(" ")[0] for part in policy.split(";") if part.strip()}
        missing = [directive for directive in REQUIRED_CSP_DIRECTIVES if directive not in directives]
        issues = [self.error(page, f"Content-Security-Policy has no {directive}") for directive in missing]
        if "'unsafe-eval'" in policy:
            issues.append(self.error(page, "Content-Security-Policy allows 'unsafe-eval'"))
        return issues


class NewTabLinkRule(Rule):
    """Links that open a new tab must not hand the opener to the other site."""

    name = "noopener"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        return [
            self.error(page, f'target="_blank" link to {href} has no rel="noopener"')
            for href, rel in page.new_tab_links
            if "noopener" not in rel.split() and "noreferrer" not in rel.split()
        ]


class SecureResourceRule(Rule):
    """Everything the page loads comes over HTTPS; plain-http links are only flagged."""

    name = "https"

    def applies_to(self, page: Page) -> bool:
        return True

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues = [self.error(page, f"insecure resource: {src}") for src in page.resources if src.startswith("http://")]
        issues += [self.warning(page, f"insecure link: {href}") for href in page.anchors if href.startswith("http://")]
        return issues


class RedirectStubRule(Rule):
    """A redirect stub must stay out of search results and name where it points."""

    name = "redirect"

    def applies_to(self, page: Page) -> bool:
        return page.redirects

    def check(self, page: Page, site: Site) -> list[Issue]:
        issues: list[Issue] = []
        if page.indexable:
            issues.append(self.error(page, "redirect page is missing robots noindex"))
        if not page.canonical:
            issues.append(self.error(page, "redirect page has no canonical link to its target"))
        return issues


DEFAULT_RULES: tuple[Rule, ...] = (
    LangRule(),
    TitleRule(),
    MetaDescriptionRule(),
    SingleH1Rule(),
    ImageAltRule(),
    CanonicalRule(),
    HreflangRule(),
    OpenGraphRule(),
    StructuredDataRule(),
    InternalLinkRule(),
    ContentSecurityPolicyRule(),
    NewTabLinkRule(),
    SecureResourceRule(),
    RedirectStubRule(),
)


# --------------------------------------------------------------------------- #
# Auditor
# --------------------------------------------------------------------------- #


class SiteAuditor:
    def __init__(self, root: Path, origin: str = DEFAULT_ORIGIN, rules: Iterable[Rule] = DEFAULT_RULES) -> None:
        if not root.is_dir():
            raise FileNotFoundError(f"build directory not found: {root}")
        self.site = Site(root, origin)
        self.rules = tuple(rules)

    def pages(self) -> Iterator[Page]:
        return iter(self.site.pages.values())

    def run(self) -> AuditReport:
        report = AuditReport(pages_checked=len(self.site.pages))
        for page in self.pages():
            for rule in self.rules:
                if rule.applies_to(page):
                    report.extend(rule.check(page, self.site))
        return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit the built portfolio before deploying it.")
    parser.add_argument("root", nargs="?", default="dist/client", type=Path, help="build directory (default: dist/client)")
    parser.add_argument("--origin", default=DEFAULT_ORIGIN, help=f"site origin (default: {DEFAULT_ORIGIN})")
    parser.add_argument("--strict", action="store_true", help="treat warnings as errors")
    parser.add_argument("--json", action="store_true", help="print the report as JSON")
    args = parser.parse_args(argv)

    try:
        report = SiteAuditor(args.root, args.origin).run()
    except FileNotFoundError as error:
        print(f"site_audit: {error}", file=sys.stderr)
        return 2

    print(report.to_json() if args.json else report.render())
    return report.exit_code(strict=args.strict)


if __name__ == "__main__":
    sys.exit(main())
