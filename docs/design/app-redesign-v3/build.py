from pathlib import Path
r=Path(__file__).parent
html=(r/'template.html').read_text().replace('/* STYLES */',(r/'styles.css').read_text()).replace('/* QR LIBRARY */',(r/'qrcode.js').read_text()).replace('/* APP */',(r/'app.js').read_text())
html=html.replace('</body>','<!-- '+(r/'QR-LICENSE.txt').read_text().replace('--','—')+' -->\n</body>')
(r/'index.html').write_text(html)
print('Built self-contained HTML:',len(html.encode()),'bytes')
