from playwright.sync_api import sync_playwright
from pathlib import Path
import json
from PIL import Image, ImageOps, ImageDraw
import zxingcpp
r=Path(__file__).parent
out=r/'screenshots';out.mkdir(exist_ok=True)
checks=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1440,'height':1050},permissions=['clipboard-read','clipboard-write'])
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/v3/')
    assert page.locator('h1').inner_text()=='Share a file. Send a link.'
    states=page.evaluate('Object.keys(states)')
    screenshots=['home','history','uploading','success','qr','error','request','owner-waiting','owner-receiving','owner-complete','recipient','recipient-complete','unavailable','download','deleting','delete-error']
    for width in [320,360,390,430,768,1440]:
        page.set_viewport_size({'width':width,'height':844 if width<768 else 1050})
        for state in states:
            page.evaluate('(s)=>render(s)',state)
            page.wait_for_timeout(10)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,state,'overflow')
            assert page.locator('h1').count()==1,(width,state,'h1')
            if width in [390,1440] and state in screenshots:
                page.screenshot(path=str(out/f'{"mobile" if width==390 else "desktop"}-{state}.png'),full_page=True,animations='disabled')
        checks.append(f'{width}px: {len(states)} states, no horizontal overflow, single H1')
    page.evaluate("render('success')")
    page.locator('[data-copy]').first.click()
    assert page.evaluate('navigator.clipboard.readText()')=='https://up.example.com/A7K2Q'
    checks.append('Copy link writes exact public URL to clipboard')
    page.locator('[data-qr]').first.click()
    page.locator('#qrImage').screenshot(path=str(out/'qr-scan.png'))
    result=zxingcpp.read_barcode(Image.open(out/'qr-scan.png'))
    assert result and result.text=='https://up.example.com/A7K2Q'
    checks.append('QR decoded independently to exact share URL')
    with page.expect_download() as d:
        page.locator('#qrDownload').click()
    assert d.value.suggested_filename=='share-qr.svg'
    page.keyboard.press('Escape');assert not page.locator('#qrDialog').is_visible()
    checks.append('QR download and Escape dismissal')
    page.evaluate("go('home')")
    page.locator('#fileInput').set_input_files({'name':'<unsafe>.txt','mimeType':'text/plain','buffer':b'Hello from lifecycle prototype'})
    page.wait_for_url('**/#/success')
    assert page.locator('.filename').first.inner_text()=='<unsafe>.txt'
    stored=page.evaluate("JSON.parse(localStorage.getItem(KEY))")
    assert len(stored)==1 and 'blob:' not in json.dumps(stored)
    page.reload();assert page.locator('.file-row').count()==1
    checks.append('Simulated transfer completes; safe filename; metadata persistence after reload')
    page.evaluate("go('home')")
    page.locator('#fileInput').set_input_files({'name':'cancel.txt','mimeType':'text/plain','buffer':b'cancel'})
    page.locator('#cancelUpload').click();page.wait_for_url('**/#/cancelled')
    assert len(page.evaluate('records'))==1
    checks.append('Cancellation creates no history record')
    page.evaluate("go('text')")
    page.locator('#textContent').fill('UTF-16 test 🌿')
    page.locator('.advanced summary').click()
    page.locator('#encoding').select_option('be')
    page.locator('#shareText').click();page.wait_for_url('**/#/success')
    raw=page.evaluate('async()=>Array.from(new Uint8Array(await selectedFile.arrayBuffer()))')
    assert bytes(raw).decode('utf-16')=='UTF-16 test 🌿'
    checks.append('Text upload advanced UTF-16 encoding')
    page.evaluate("go('request')")
    page.locator('#requestSize').fill('2');page.locator('#requestUnit').select_option('GiB')
    page.get_by_role('button',name='Create request',exact=True).click()
    assert page.evaluate('document.getElementById("requestSize").validity.valid') is False
    page.locator('#requestSize').fill('100');page.locator('#requestUnit').select_option('MiB')
    page.get_by_role('button',name='Create request',exact=True).click()
    page.wait_for_url('**/#/owner-waiting')
    assert page.locator('input[aria-label="Download link"]').input_value()=='https://up.example.com/A7K2Q'
    page.locator('#ownerAction').click();page.locator('#revokeConfirm').click();page.wait_for_url('**/#/owner-revoked')
    checks.append('Request size validation; preallocated URL; revoke confirmation')
    page.evaluate("render('recipient-complete')")
    assert 'owner link' not in page.locator('main').inner_text().lower()
    assert not page.locator('main [data-copy*="token="]').count()
    checks.append('Sender completion has no owner controls or management link')
    page.locator('#theme').select_option('dark');page.reload()
    assert page.locator('html').get_attribute('data-theme')=='dark'
    page.evaluate("render('success')");page.screenshot(path=str(out/'desktop-success-dark.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.evaluate("render('owner-waiting')");page.screenshot(path=str(out/'mobile-owner-dark.png'),full_page=True)
    checks.append('Theme persistence; dark-mode screenshots')
    page.emulate_media(reduced_motion='reduce')
    assert page.evaluate("getComputedStyle(document.querySelector('main')).animationName")=='none'
    checks.append('Reduced-motion path')
    assert not errors,errors
    checks.append('No browser JavaScript errors')
    b.close()
(r/'verification.json').write_text(json.dumps({'passed':checks,'state_count':len(states)},indent=2))
print(json.dumps({'passed':checks,'state_count':len(states)},indent=2))
# Deliverable contact sheets, with explicit screen names.
for name,group in [('mobile-lifecycle',['home','uploading','success','qr','error','unavailable']),('mobile-requests',['request','owner-waiting','owner-receiving','owner-complete','recipient','recipient-complete'])]:
    tilew=390;tileh=1180;gap=24;titleh=50
    canvas=Image.new('RGB',(3*tilew+4*gap,2*tileh+3*gap),'#e7ebe5');draw=ImageDraw.Draw(canvas)
    for i,state in enumerate(group):
        im=Image.open(out/f'mobile-{state}.png').convert('RGB');im.thumbnail((tilew,tileh-titleh))
        x=gap+(i%3)*(tilew+gap);y=gap+(i//3)*(tileh+gap)
        draw.text((x,y+10),state.replace('-',' ').upper(),fill='#244c38')
        canvas.paste(im,(x,y+titleh))
    canvas.save(out/f'{name}.png')
