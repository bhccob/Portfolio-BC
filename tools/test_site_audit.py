"""Unit tests for site_audit.py. Run: python -m unittest discover tools"""

from __future__ import annotations

import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from site_audit import Severity, SiteAuditor, main  # noqa: E402

ORIGIN = "https://bhccob.me"
CSP = "default-src 'self'; script-src 'self' 'sha256-abc'; object-src 'none'; base-uri 'self'"


def page(
    *,
    path: str = "/",
    title: str = "Bob Chung | Student Software Engineer",
    description: str = "Portfolio of Bob Chung, a student software engineer in Rotterdam working on web and games.",
    body: str = "<h1>Bob Chung</h1>",
    head_extra: str = "",
    alternates: bool = True,
    noindex: bool = False,
    csp: str | None = CSP,
) -> str:
    links = ""
    if alternates:
        nl_path = "/nl" + path
        links = (
            f'<link rel="alternate" hreflang="en" href="{ORIGIN}{path}">'
            f'<link rel="alternate" hreflang="nl" href="{ORIGIN}{nl_path}">'
            f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{path}">'
        )
    robots = '<meta name="robots" content="noindex">' if noindex else f'<link rel="canonical" href="{ORIGIN}{path}">'
    policy = f'<meta http-equiv="content-security-policy" content="{csp}">' if csp else ""
    return f"""<!doctype html><html lang="en"><head>
      {policy}
      <title>{title}</title>
      <meta name="description" content="{description}">
      {robots}{links}
      <meta property="og:title" content="t"><meta property="og:description" content="d">
      <meta property="og:image" content="{ORIGIN}/og.png"><meta property="og:url" content="{ORIGIN}{path}">
      <meta name="twitter:card" content="summary_large_image">
      <script type="application/ld+json">{{"@type": "Person"}}</script>
      {head_extra}
    </head><body>{body}</body></html>"""


class AuditTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        (self.root / "og.png").write_bytes(b"\x89PNG")
        self.write("index.html", page(body='<h1 id="top">Bob</h1><a href="/contact/">Contact</a><a href="#work">Work</a><section id="work"></section>'))
        self.write("nl/index.html", page(path="/nl/", body="<h1>Bob</h1>", alternates=False, head_extra=self.nl_alternates("/")))
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body="<h1>Contact</h1>"))
        self.write("nl/contact/index.html", page(path="/nl/contact/", title="Contact NL | Bob Chung", body="<h1>Contact</h1>", alternates=False, head_extra=self.nl_alternates("/contact/")))

    def tearDown(self) -> None:
        self._tmp.cleanup()

    @staticmethod
    def nl_alternates(path: str) -> str:
        return (
            f'<link rel="alternate" hreflang="en" href="{ORIGIN}{path}">'
            f'<link rel="alternate" hreflang="nl" href="{ORIGIN}/nl{path}">'
            f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{path}">'
        )

    def write(self, relative: str, html: str) -> None:
        file = self.root / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(html, encoding="utf-8")

    def audit(self):
        return SiteAuditor(self.root, ORIGIN).run()

    def rules_with_errors(self) -> set[str]:
        return {issue.rule for issue in self.audit().errors}


class SiteAuditorTests(AuditTestCase):
    def test_valid_site_has_no_errors(self) -> None:
        report = self.audit()
        self.assertEqual(report.errors, [], report.render())
        self.assertEqual(report.pages_checked, 4)

    def test_missing_title_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", title="", body="<h1>Contact</h1>"))
        self.assertIn("title", self.rules_with_errors())

    def test_missing_description_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", description="", body="<h1>Contact</h1>"))
        self.assertIn("description", self.rules_with_errors())

    def test_image_without_alt_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", body='<h1>Contact</h1><img src="/me.jpg">'))
        self.assertIn("alt", self.rules_with_errors())

    def test_empty_alt_is_allowed_for_decorative_images(self) -> None:
        self.write("contact/index.html", page(path="/contact/", body='<h1>Contact</h1><img src="/og.png" alt="">'))
        self.assertNotIn("alt", self.rules_with_errors())

    def test_two_h1_headings_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", body="<h1>One</h1><h1>Two</h1>"))
        self.assertIn("h1", self.rules_with_errors())

    def test_broken_internal_link_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", body='<h1>Contact</h1><a href="/missing/">x</a>'))
        self.assertIn("links", self.rules_with_errors())

    def test_link_to_missing_fragment_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", body='<h1>Contact</h1><a href="/#nowhere">x</a>'))
        errors = self.audit().errors
        self.assertTrue(any("#nowhere" in issue.message for issue in errors))

    def test_external_and_mailto_links_are_ignored(self) -> None:
        self.write(
            "contact/index.html",
            page(path="/contact/", body='<h1>Contact</h1><a href="https://github.com/bhccob">gh</a><a href="mailto:a@b.c">m</a>'),
        )
        self.assertNotIn("links", self.rules_with_errors())

    def test_hreflang_pointing_to_missing_page_is_an_error(self) -> None:
        (self.root / "nl" / "contact" / "index.html").unlink()
        self.assertIn("hreflang", self.rules_with_errors())

    def test_invalid_json_ld_is_an_error(self) -> None:
        broken = '<script type="application/ld+json">{"@type": </script>'
        self.write("contact/index.html", page(path="/contact/", body="<h1>Contact</h1>", head_extra=broken))
        self.assertIn("json-ld", self.rules_with_errors())

    def test_noindex_redirect_stub_only_needs_basic_checks(self) -> None:
        stub = '<!doctype html><html lang="en"><head><title>Moved</title><meta name="robots" content="noindex">' \
               f'<link rel="canonical" href="{ORIGIN}/contact/"></head><body><a href="/contact/">moved</a></body></html>'
        self.write("old-page.html", stub)
        report = self.audit()
        self.assertEqual([i for i in report.errors if i.page == "/old-page.html"], [], report.render())

    def test_long_title_is_only_a_warning(self) -> None:
        self.write("contact/index.html", page(path="/contact/", title="x" * 90, body="<h1>Contact</h1>"))
        report = self.audit()
        self.assertNotIn("title", {issue.rule for issue in report.errors})
        self.assertIn(Severity.WARNING, {issue.severity for issue in report.issues if issue.rule == "title"})

    def test_missing_csp_is_an_error(self) -> None:
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body="<h1>Contact</h1>", csp=None))
        self.assertIn("csp", self.rules_with_errors())

    def test_weak_csp_is_an_error(self) -> None:
        weak = "default-src 'self'; script-src 'self' 'unsafe-eval'; base-uri 'self'"
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body="<h1>Contact</h1>", csp=weak))
        messages = [issue.message for issue in self.audit().errors if issue.rule == "csp"]
        self.assertTrue(any("object-src" in message for message in messages))
        self.assertTrue(any("unsafe-eval" in message for message in messages))

    def test_new_tab_link_needs_noopener(self) -> None:
        body = '<h1>Contact</h1><a href="https://github.com/bhccob" target="_blank">GitHub</a>'
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body=body))
        self.assertIn("noopener", self.rules_with_errors())
        safe = body.replace('target="_blank"', 'target="_blank" rel="noopener noreferrer"')
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body=safe))
        self.assertNotIn("noopener", self.rules_with_errors())

    def test_insecure_resource_is_an_error_and_insecure_link_a_warning(self) -> None:
        body = '<h1>Contact</h1><img src="http://example.com/a.png" alt=""><a href="http://example.com/">x</a>'
        self.write("contact/index.html", page(path="/contact/", title="Contact | Bob Chung", body=body))
        report = self.audit()
        self.assertIn("https", {issue.rule for issue in report.errors})
        self.assertIn("https", {issue.rule for issue in report.warnings})

    def test_redirect_stub_must_be_noindex(self) -> None:
        stub = (
            '<!doctype html><html lang="nl"><head><title>Verplaatst | Bob Chung</title>'
            f'<meta http-equiv="refresh" content="0; url=/"><link rel="canonical" href="{ORIGIN}/">'
            '</head><body><a href="/">Home</a></body></html>'
        )
        self.write("old/index.html", stub)
        self.assertIn("redirect", self.rules_with_errors())
        self.write("old/index.html", stub.replace("<head>", '<head><meta name="robots" content="noindex, follow">'))
        self.assertNotIn("redirect", self.rules_with_errors())

    def test_cli_exit_codes(self) -> None:
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main([str(self.root)]), 0)
            self.write("contact/index.html", page(path="/contact/", body="<h1>Contact</h1><a href='/gone/'>x</a>"))
            self.assertEqual(main([str(self.root)]), 1)
            self.assertEqual(main([str(self.root / "does-not-exist")]), 2)


if __name__ == "__main__":
    unittest.main()
