"""Build FolioLocal SVG sources and PNG/ICO exports (PT-BRAND-003).
Requires Python fontTools, Inkscape and ImageMagick convert on PATH; no network or runtime changes.
Run: python scripts/build_brand_assets.py
Typography outlines come from the existing OFL overlay font, not a new font download.
"""
from pathlib import Path
import base64
import io
import json
import re
import subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app/public/brand'
INK, TEAL, MINT, WHITE = '#142D3A', '#08796D', '#EAF7F3', '#FFFFFF'
font_source = (ROOT / 'app/src/assets/overlayFont.ts').read_text()
font = TTFont(io.BytesIO(base64.b64decode(re.search(r"BASE64 = '([^']+)'", font_source)[1])))
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
UPM = font['head'].unitsPerEm


def text_paths(text, x, y, size, color=INK, tracking=0):
    paths = []
    for letter in text:
        name = cmap[ord(letter)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            paths.append(f'<path transform="translate({x:.4f} {y}) scale({size/UPM:.6f} {-size/UPM:.6f})" d="{pen.getCommands()}"/>')
        x += font['hmtx'][name][0] * size / UPM + tracking
    return f'<g fill="{color}">' + ''.join(paths) + '</g>'


def mark(background=TEAL, foreground=WHITE):
    # Two offset sheets and a folded front corner. Geometry drawn for this project.
    return (f'<rect width="64" height="64" rx="15" fill="{background}"/>'
            f'<path d="M17 20H14V49H37V46H17Z" fill="{foreground}"/>'
            f'<path fill-rule="evenodd" d="M23 12H37L49 24V43H23V12ZM27 16V39H45V26H35V16H27ZM39 19V22H42L39 19Z" fill="{foreground}"/>'
            f'<path d="M31 29H40V32H31Z" fill="{foreground}"/>')


def mono_mark(color):
    # A genuine single-ink mark: document strokes are transparent knockouts.
    cutouts = mark(WHITE, '#000000').split('/>', 1)[1]
    return ('<defs><mask id="knockout" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">'
            '<rect width="64" height="64" fill="white"/>' + cutouts + '</mask></defs>'
            f'<rect width="64" height="64" rx="15" fill="{color}" mask="url(#knockout)"/>')


def svg(width, height, title, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title">'
            f'<title id="title">{title}</title>{body}</svg>\n')


def write(name, width, height, title, body):
    (OUT / name).write_text(svg(width, height, title, body))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    write('mark.svg',64,64,'FolioLocal document mark',mark())
    write('mark-mono.svg',64,64,'FolioLocal monochrome mark',mono_mark(INK))
    write('mark-reversed.svg',64,64,'FolioLocal reversed mark',mono_mark(WHITE))
    write('favicon.svg',64,64,'FolioLocal',mark())
    for name, word_color, bg, fg in [('logo-light',INK,TEAL,WHITE),('logo-dark',WHITE,TEAL,WHITE),('logo-mono',INK,INK,WHITE),('logo-reversed',WHITE,WHITE,INK)]:
        write(name+'.svg',330,64,'FolioLocal',(mono_mark(word_color) if name in ('logo-mono','logo-reversed') else mark(bg,fg))+text_paths('FolioLocal',82,46,43,word_color,-.3))
    for name,color in [('wordmark',INK),('wordmark-reversed',WHITE)]:
        write(name+'.svg',250,64,'FolioLocal',text_paths('FolioLocal',0,46,43,color,-.3))
    write('apple-touch-icon.svg',180,180,'FolioLocal touch icon',
          f'<rect width="180" height="180" fill="{TEAL}"/><g transform="translate(26 26) scale(2)">{mark()}</g>')
    social=(f'<rect width="1200" height="630" fill="{MINT}"/>'
            f'<g transform="translate(64 54)">{mark()}{text_paths("FolioLocal",82,46,43,INK,-.3)}</g>'
            +text_paths('Free PDF tools.',64,274,66)+text_paths('On your device.',64,354,66)
            +text_paths('Free forever  /  Open source',66,440,25,TEAL)
            +text_paths('akshat4112.github.io/pdf-tools/',66,558,20,INK)
            +f'<g transform="translate(886 196) scale(3.5)">{mark()}</g>')
    write('social-card.svg',1200,630,'FolioLocal — Free PDF tools. On your device.',social)
    # Render SVG paths without depending on system fonts or external image resources.
    for source, target, size in [('favicon.svg','favicon-16.png',16),('favicon.svg','favicon-32.png',32),
                                 ('mark.svg','icon-192.png',192),('mark.svg','icon-512.png',512),
                                 ('apple-touch-icon.svg','apple-touch-icon.png',180)]:
        subprocess.run(['inkscape',str(OUT/source),'--export-type=png',f'--export-filename={OUT/target}',f'--export-width={size}',f'--export-height={size}'],check=True,capture_output=True)
    subprocess.run(['inkscape',str(OUT/'social-card.svg'),'--export-type=png',f'--export-filename={OUT/"social-card.png"}','--export-width=1200','--export-height=630'],check=True,capture_output=True)
    # ICO is a container around the actual 16/32 PNG exports (ImageMagick 6).
    subprocess.run(['convert',str(OUT/'favicon-16.png'),str(OUT/'favicon-32.png'),str(OUT/'favicon.ico')],check=True,capture_output=True)
    (OUT/'FONT-LICENSE.txt').write_text((ROOT/'app/public/licenses/overlay-font.txt').read_text())
    (OUT/'brand.json').write_text(json.dumps({'name':'FolioLocal','tagline':'Free PDF tools. On your device.',
        'colors':{'ink':INK,'teal':TEAL,'mint':MINT,'white':WHITE},'asset_license':'MIT',
        'outlined_typeface':'Existing PDF Tools Sans derivative of Noto Sans; OFL-1.1 notice in FONT-LICENSE.txt',
        'source':'scripts/build_brand_assets.py'},indent=2)+'\n')
    print('Built original SVG identity, outlined wordmarks, raster icons, ICO and 1200×630 social artwork.')


if __name__=='__main__':
    main()
