"""Build the self-hosted OFL overlay font from Noto Sans (Fontsource 5.3.0) (fontTools)."""
from pathlib import Path
import base64
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

source = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/pdf-tools-font/node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff')
font = TTFont(source, recalcTimestamp=False)
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=list(range(32, 127)) + list(range(160, 256)) + [0x20ac, 0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d])
subsetter.subset(font)
# Modified fonts must not use the upstream family name.
for record in font['name'].names:
    names = {1: 'PDF Tools Sans', 2: 'Regular', 3: 'PDFToolsSans-Regular-1', 4: 'PDF Tools Sans Regular', 6: 'PDFToolsSans-Regular', 16: 'PDF Tools Sans', 17: 'Regular'}
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
from io import BytesIO
buffer = BytesIO()
font.flavor = None
font.save(buffer)
target = Path(__file__).resolve().parents[1] / 'app/src/assets/overlayFont.ts'
target.parent.mkdir(exist_ok=True)
target.write_text('// OFL-1.1 derivative of Noto Sans; see licenses/overlay-font.txt.\nexport const OVERLAY_FONT_BASE64 = ' + repr(base64.b64encode(buffer.getvalue()).decode()) + '\n')
target.with_name('overlayCoverage.ts').write_text('export const OVERLAY_SUPPORTED_CODEPOINTS = ' + repr(sorted(font.getBestCmap().keys())) + '\n')
print(f'{len(buffer.getvalue())} font bytes; {target.name}')
