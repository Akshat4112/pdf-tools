"""Validate documented FolioLocal reference contrast and HTML asset/ID wiring.
Run from any directory: python scripts/check_design_reference.py
Uses only Python's standard library; prints measured pairs as JSON. No network.
"""
import json
from pathlib import Path
import re
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'app/public/design-system'
PAIRS = [('text','surface'),('text','bg'),('muted','surface'),('muted','bg'),('muted','subtle'),
         ('accent','surface'),('accent','bg'),('on-accent','accent'),('on-accent','accent-hover'),
         ('danger','danger-bg'),('warning','warning-bg'),('success','success-bg'),
         ('focus','surface'),('control','surface'),('control','bg'),('control','subtle')]


def luminance(color):
    channels = [int(color[i:i+2], 16)/255 for i in (1,3,5)]
    channels = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in channels]
    return sum(v*w for v,w in zip(channels, [.2126,.7152,.0722]))


class Reference(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.references = set(), []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate ID: {attrs["id"]}'
            self.ids.add(attrs['id'])
        for name in ('for','aria-describedby','aria-labelledby'):
            self.references.extend(attrs.get(name,'').split())
        if tag == 'img':
            assert 'alt' in attrs, 'Missing alt attribute'
        for name in ('src','href'):
            target = attrs.get(name,'')
            if target.startswith('#'):
                self.references.append(target[1:])
            elif target and not target.startswith(('http:','https:')):
                assert ((REFERENCE / target).exists() or (ROOT / 'app/dist/design-system' / target).exists()), f'Missing local resource: {target}'


def main():
    source = (REFERENCE/'tokens.css').read_text()
    blocks = source.split('.fl-system[data-fl-theme=')
    assert len(blocks) == 2, 'Expected explicit light/dark token blocks'
    themes = [dict(re.findall(r'--fl-([\w-]+):\s*(#[0-9A-Fa-f]{6})', block)) for block in blocks]
    measurements = []
    for name, theme in zip(['light','dark'], themes):
        for foreground, background in PAIRS:
            low, high = sorted([luminance(theme[foreground]), luminance(theme[background])])
            ratio = (high+.05)/(low+.05)
            minimum = 3 if foreground in ('focus','control') else 4.5
            assert ratio >= minimum, f'{name} {foreground}/{background}: {ratio}'
            measurements.append({'theme':name,'foreground':foreground,'background':background,
                                 'ratio':round(ratio,2),'required':minimum})
    page = Reference()
    page.feed((REFERENCE/'index.html').read_text())
    assert set(page.references) <= page.ids, f'Broken ID references: {set(page.references)-page.ids}'
    assert 'noindex,nofollow' in (REFERENCE/'index.html').read_text()
    print(json.dumps({'contrast_pairs':measurements,'html_ids_and_resources':'pass'},indent=2))


if __name__ == '__main__':
    main()
