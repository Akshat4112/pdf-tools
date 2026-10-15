"""Read-only public SEO snapshot. Run from the repository root; writes only stdout.
Usage: python docs/seo/audit_public_site.py > /tmp/pdf-tools-seo-audit.json
No documents, credentials, browser state, or search rankings are collected.
"""
import concurrent.futures
import datetime
import hashlib
from html.parser import HTMLParser
import json
import urllib.error
import urllib.request

BASE = 'https://akshat4112.github.io/pdf-tools/'
ROUTES = ['', 'merge/', 'split/', 'rotate/', 'delete-pages/', 'extract-pages/',
          'organize/', 'images-to-pdf/', 'pdf-to-jpg/', 'pdf-to-png/', 'reader/',
          'page-numbers/', 'watermark/', 'pdf-to-text/', 'doc-info/']
EXTRA = ['sitemap.xml', 'robots.txt', '404.html', 'seo-audit-missing-page/',
         'merge', 'merge/index.html']


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.titles = []
        self.h1 = []
        self.metas = {}
        self.canonicals = []
        self.links = []
        self.root_text = []
        self.root_depth = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'meta':
            key = attrs.get('name', attrs.get('property', ''))
            self.metas.setdefault(key, []).append(attrs.get('content'))
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'a':
            self.links.append(attrs.get('href'))
        if tag not in {'meta', 'link', 'img', 'input', 'br', 'hr', 'source', 'wbr'}:
            self.tags.append(tag)
            if attrs.get('id') == 'root':
                self.root_depth = len(self.tags)

    def handle_endtag(self, tag):
        if tag in self.tags:
            index = len(self.tags) - 1 - self.tags[::-1].index(tag)
            if self.root_depth is not None and index < self.root_depth:
                self.root_depth = None
            self.tags = self.tags[:index]

    def handle_data(self, data):
        if 'title' in self.tags:
            self.titles.append(data)
        if 'h1' in self.tags:
            self.h1.append(data)
        if self.root_depth is not None:
            self.root_text.append(data)


def inspect(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'PDF-Tools-public-SEO-audit/1.0'})
        try:
            response = urllib.request.urlopen(req, timeout=25)
        except urllib.error.HTTPError as exc:
            response = exc
        body = response.read()
        decoded = body.decode('utf-8', errors='replace')
        result = {'requested_url': url, 'final_url': response.url,
                  'status': response.code, 'content_type': response.headers.get('Content-Type'),
                  'x_robots_tag': response.headers.get('X-Robots-Tag'),
                  'last_modified': response.headers.get('Last-Modified'),
                  'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}
        if 'text/html' in (result['content_type'] or ''):
            page = Page()
            page.feed(decoded)
            result.update(title=''.join(page.titles), lang=getattr(page, 'lang', None),
                          meta=page.metas, canonical=page.canonicals, h1=page.h1,
                          links=page.links, root_text=''.join(page.root_text).strip())
        else:
            result['body'] = decoded
        return result
    except Exception as exc:
        return {'requested_url': url, 'error': str(exc)}


if __name__ == '__main__':
    urls = [BASE + path for path in ROUTES + EXTRA]
    urls.append('https://akshat4112.github.io/robots.txt')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(inspect, urls))
    for index, result in enumerate(results):
        if result.get('status', 0) >= 500 or 'error' in result:
            retry = inspect(result['requested_url'])
            retry['previous_attempt'] = result
            results[index] = retry
    print(json.dumps({'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                      'method': 'HTTP GET; redirects followed; static HTML only, no JavaScript',
                      'pages': results}, indent=2, ensure_ascii=False))
