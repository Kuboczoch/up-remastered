from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
import zxingcpp,json
r=Path(__file__).parent
result=[]
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(permissions=['clipboard-read','clipboard-write'],viewport={'width':390,'height':844});page=c.new_page()
 page.goto('http://127.0.0.1:8765/v6-approved/');page.evaluate('localStorage.clear()');page.reload()
 before=page.locator('#chooseFile').bounding_box()
 page.evaluate("document.querySelector('.scene').style.display='none'")
 assert before==page.locator('#chooseFile').bounding_box()
 result.append('Artwork adds zero layout displacement to upload action')
 positions={}
 for ver in ['v4','v6-approved']:
  page.goto('http://127.0.0.1:8765/'+ver+'/');positions[ver]=round(page.locator('#chooseFile').bounding_box()['y'])
 result.append({'mobile_upload_button_top_px':positions,'improvement_px':positions['v4']-positions['v6-approved']})
 page.locator('#fileInput').set_input_files({'name':'hello.txt','mimeType':'text/plain','buffer':b'Hello from v5'})
 page.wait_for_url('**/#/success',timeout=12000)
 page.locator('[data-copy]').first.click();assert page.evaluate('navigator.clipboard.readText()')==page.evaluate('current.url')
 page.locator('[data-qr]').first.click();page.locator('#qrImage').screenshot(path=str(r/'qr-test.png'))
 assert zxingcpp.read_barcode(Image.open(r/'qr-test.png')).text==page.evaluate('current.url')
 page.keyboard.press('Escape');result.append('Upload simulation, clipboard, independently decoded QR')
 with page.expect_popup() as popup:page.get_by_role('button',name='Open file',exact=True).click()
 raw=popup.value;raw.wait_for_load_state();assert 'Hello from v5' in raw.locator('body').inner_text();assert raw.url.startswith('blob:');raw.close()
 result.append('Safe local text opens raw in browser, without application preview wrapper')
 page.evaluate("selectedFile=new File(['binary'],'archive.bin',{type:'application/octet-stream'});fileBytes.set(current.id,selectedFile)")
 with page.expect_download() as d:page.get_by_role('button',name='Open file',exact=True).click()
 assert d.value.suggested_filename=='hello.txt';result.append('Unsupported local file downloads')
 page.goto('http://127.0.0.1:8765/v6-approved/#/text');page.locator('#textContent').fill('Testing v5');page.get_by_role('button',name='Create link').click();page.wait_for_url('**/#/success',timeout=12000)
 result.append('Text upload path works')
 b.close()
(r/'interaction-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
