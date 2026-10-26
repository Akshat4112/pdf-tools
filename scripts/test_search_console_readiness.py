import unittest
from check_search_console_readiness import SITE, page_result, public_url, sitemap_urls, PublicRedirects


class ReadinessTests(unittest.TestCase):
    def test_public_directory_canonicals(self):
        for url in (SITE, SITE + 'merge/', SITE + 'tools/convert/'):
            self.assertEqual(public_url(url), url)

    def test_rejects_private_state_and_outside_property(self):
        for url in ('https://example.com/', SITE + '?file=private', SITE + '#document',
                    SITE + '../', SITE + '%2e%2e/', SITE + 'merge', SITE + '404.html'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                public_url(url)

    def test_redirect_guard_rejects_external_before_network(self):
        with self.assertRaises(ValueError):
            PublicRedirects().redirect_request(None, None, 302, '', {}, 'https://example.com/')

    def test_200_is_not_enough_without_one_correct_canonical(self):
        for html in ('<head></head>', f'<head><link rel="canonical" href="{SITE}merge/"></head>',
                     f'<head><link rel="canonical" href="{SITE}"><link rel="canonical" href="{SITE}"></head>'):
            self.assertTrue(page_result(SITE, html)['issues'])

    def test_noindex_meta_and_headers_fail(self):
        head = f'<head><link rel="canonical" href="{SITE}">'
        self.assertTrue(page_result(SITE, head + '<meta name="googlebot" content="noindex"></head>')['issues'])
        self.assertTrue(page_result(SITE, head + '</head>', x_robots='googlebot: noindex')['issues'])
        self.assertTrue(page_result(SITE, head + '<meta name="robots" content="none"></head>')['issues'])
        self.assertFalse(page_result(SITE, head + '<meta name="robots" content="index,follow"></head>')['issues'])

    def test_implicit_head_metadata_and_body_exclusion(self):
        html = f'<html><link rel="canonical" href="{SITE}"><meta name="robots" content="noindex"><body></body></html>'
        self.assertIn('HTML/header prevents indexing', page_result(SITE, html)['issues'])
        html = f'<head><link rel="canonical" href="{SITE}"></head><body><link rel="canonical" href="https://example.com/"></body>'
        self.assertFalse(page_result(SITE, html)['issues'])

    def test_sitemap_rejects_duplicates_and_private_urls(self):
        def xml(urls):
            return '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{u}</loc></url>' for u in urls) + '</urlset>'
        self.assertEqual(sitemap_urls(xml([SITE])), [SITE])
        for urls in ([], [SITE, SITE], ['https://example.com/'], [SITE + '?document=private']):
            with self.assertRaises(ValueError):
                sitemap_urls(xml(urls))


if __name__ == '__main__':
    unittest.main()
