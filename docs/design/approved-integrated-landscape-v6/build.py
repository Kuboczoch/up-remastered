from pathlib import Path
import base64
r=Path(__file__).parent
uri='data:image/webp;base64,'+base64.b64encode((r/'landscape.webp').read_bytes()).decode()
s=(r/'template.html').read_text().replace('/* STYLES */',(r/'styles.css').read_text().replace('ART_DATA',uri)).replace('/* QR LIBRARY */',(r/'qrcode.js').read_text()).replace('/* APP */',(r/'app.js').read_text())
assert 'ART_DATA' not in s
(r/'index.html').write_text(s)
print('Built standalone approved design:',len(s.encode()),'bytes')
