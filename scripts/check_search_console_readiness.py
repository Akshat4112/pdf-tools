"""PT-SEO-008: public crawl prerequisites only, never Google index/ownership status.

Run from the repository root after building app. --live issues GETs only to
allowlisted public canonicals and the shared origin's robots.txt; no credentials.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

SITE = 'https://akshat4112.github.io/pdf-tools/'
ROBOTS = 'https://akshat4112.github.io/robots.txt'


def public_url(url):
    """Reject cross-site, query, fragment, encoded, dot and non-directory URLs."""
    parsed = urlsplit(url)
    if not url.startswith(SITE) or parsed.query or parsed.fragment:
        raise ValueError('Expected an exact public PDF Tools canonical')
    suffix = url[len(SITE):]
    if suffix and not re.fullmatch(r'(?:[a-z0-9]+(?:-[a-z0-9]+)*/)+', suffix):
        raise ValueError('Expected a canonical public route with a trailing slash')
    return url


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        # HTML permits an omitted <head>; metadata before <body> is still head data.
        self.in_head = True
        self.canonicals = []
        self.robots = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'head':
            self.in_head = True
        if tag == 'body':
            self.in_head = False
        if not self.in_head:
            return
        if tag == 'link' and 'canonical' in attrs.get('rel', '').lower().split():
            self.canonicals.append(attrs.get('href', ''))
        if tag == 'meta' and attrs.get('name', '').lower() in ('robots', 'googlebot'):
            self.robots.append(attrs.get('content', ''))

    def handle_endtag(self, tag):
        if tag == 'head':
            self.in_head = False


def page_result(url, html, status=200, final_url=None, x_robots=''):
    head = Head()
    head.feed(html)
    directives = head.robots + [x_robots]
    blocked = any(re.search(r'\b(?:noindex|none)\b', value, re.I) for value in directives)
    issues = []
    if status != 200:
        issues.append(f'HTTP {status}')
    if final_url and final_url != url:
        issues.append('Canonical request redirected')
    if head.canonicals != [url]:
        issues.append('Expected exactly one self-referencing HTML canonical')
    if blocked:
        issues.append('HTML/header prevents indexing')
    return {'url': url, 'httpStatus': status, 'finalUrl': final_url or url,
            'declaredCanonicals': head.canonicals, 'robotsDirectives': directives,
            'issues': issues}


class PublicRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        # Refuse destinations outside the intended property before following them.
        public_url(newurl)
        return super().redirect_request(request, fp, code, message, headers, newurl)


def fetch(url):
    if url != ROBOTS:
        if url != SITE + 'sitemap.xml':
            public_url(url)
    request = Request(url, headers={'User-Agent': 'PDF-Tools-public-readiness/1.0'})
    try:
        response = build_opener(PublicRedirects).open(request, timeout=20)
    except HTTPError as error:
        response = error
    with response:
        # All expected pages are small. Bound body reads; do not retain arbitrary payloads.
        data = response.read(2_000_001)
        if len(data) > 2_000_000:
            raise ValueError('Public response exceeded audit limit')
        return response.status, response.url, response.headers, data.decode('utf-8')


def sitemap_urls(xml):
    root = ET.fromstring(xml)
    if root.tag != '{http://www.sitemaps.org/schemas/sitemap/0.9}urlset':
        raise ValueError('Expected sitemap urlset')
    urls = [public_url(node.text or '') for node in root.findall('{*}url/{*}loc')]
    if not urls or len(urls) != len(set(urls)):
        raise ValueError('Empty or duplicate sitemap URLs')
    return urls


def audit(dist, live=False):
    urls = sitemap_urls((dist / 'sitemap.xml').read_text())
    local = []
    expected = set()
    for file in dist.rglob('index.html'):
        relative = file.relative_to(dist).as_posix()
        url = SITE + relative.removesuffix('index.html')
        result = page_result(url, file.read_text())
        if not any('prevents indexing' in issue for issue in result['issues']):
            expected.add(public_url(url))
    if set(urls) != expected:
        raise ValueError('Sitemap does not match the built indexable entry pages')
    for url in urls:
        path = dist / url[len(SITE):] / 'index.html'
        local.append(page_result(url, path.read_text()))
    report = {'observedAtUtc': datetime.now(timezone.utc).isoformat(), 'property': SITE,
              'sitemap': SITE + 'sitemap.xml', 'localPages': local,
              'searchConsole': {'ownership': 'pending owner-account readback',
                                'sitemapSubmission': 'pending owner-account readback',
                                'urlInspection': 'pending owner-account readback'},
              'note': 'HTTP, declared canonicals and crawl permissions are prerequisites, not proof of Google indexing or Google-selected canonicals.'}
    if live:
        status, final_url, _, xml = fetch(SITE + 'sitemap.xml')
        if status != 200 or final_url != SITE + 'sitemap.xml' or set(sitemap_urls(xml)) != set(urls):
            raise ValueError('Deployed sitemap differs from the built public inventory')
        robot_status, _, _, text = fetch(ROBOTS)
        if robot_status not in (200, 404):
            raise ValueError(f'Origin robots HTTP {robot_status}: requires manual review')
        parser = RobotFileParser()
        parser.parse(text.splitlines() if robot_status == 200 else [])
        def inspect(url):
            status, final, headers, html = fetch(url)
            result = page_result(url, html, status, final, headers.get('X-Robots-Tag', ''))
            if robot_status == 200 and not parser.can_fetch('Googlebot', url):
                result['issues'].append('Shared-origin robots disallows Googlebot')
            return result
        with ThreadPoolExecutor(max_workers=4) as pool:
            report['livePages'] = list(pool.map(inspect, urls))
        report['originRobots'] = {'url': ROBOTS, 'httpStatus': robot_status,
                                 'note': 'The /pdf-tools/robots.txt file does not govern this shared origin.'}
    report['passed'] = not any(page['issues'] for key in ('localPages', 'livePages') for page in report.get(key, []))
    return report


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--dist', type=Path, default=Path('app/dist'))
    args.add_argument('--live', action='store_true')
    args.add_argument('--output', type=Path)
    options = args.parse_args()
    report = audit(options.dist, options.live)
    if options.output:
        options.output.parent.mkdir(parents=True, exist_ok=True)
        options.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'passed': report['passed'], 'localPages': len(report['localPages']),
                      'livePages': len(report.get('livePages', [])),
                      'searchConsole': report['searchConsole']}, indent=2))
    raise SystemExit(0 if report['passed'] else 1)
