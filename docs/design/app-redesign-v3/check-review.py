from playwright.sync_api import sync_playwright
from pathlib import Path
import json
r=Path(__file__).parent
checks=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 c=b.new_context(timezone_id='Europe/Warsaw',permissions=['clipboard-read','clipboard-write'])
 page=c.new_page();page.goto('http://127.0.0.1:8765/v3/')
 page.evaluate("render('history')")
 page.get_by_role('button',name='More actions for Photos.zip').click();page.locator('#moreOpen').click()
 page.wait_for_url('**/#/download');page.wait_for_function("document.querySelector('h1')?.textContent==='Photos.zip'")
 assert page.locator('#downloadFile').is_disabled()
 page.locator('[data-copy]').first.click();assert page.evaluate('navigator.clipboard.readText()')=='https://up.example.com/B8N3R'
 checks.append('History open preserves selected identity/URL; unavailable sample bytes never become a different download')
 page.evaluate("go('home')");page.locator('#fileInput').set_input_files({'name':'real.txt','mimeType':'text/plain','buffer':b'exact local bytes <script>inert</script>'})
 page.wait_for_url('**/#/success');page.get_by_role('link',name='Open file',exact=True).click();page.wait_for_url('**/#/download')
 assert page.locator('#safePreview').inner_text()=='exact local bytes <script>inert</script>'
 with page.expect_download() as d:page.locator('#downloadFile').click()
 assert Path(d.value.path()).read_bytes()==b'exact local bytes <script>inert</script>'
 checks.append('Selected local file downloads exact bytes; text preview stays inert')
 page.evaluate("go('home')");page.get_by_role('button',name='More actions for real.txt').click();page.locator('#moreRemove').click()
 assert len(page.evaluate('records'))==0
 checks.append('Remove from history is explicitly separate from simulated server deletion')
 page.evaluate("render('deleting')");assert 'no server file will be deleted' in page.locator('#deleteDialog').inner_text()
 page.keyboard.press('Escape')
 page.evaluate("go('request')")
 page.get_by_role('button',name='Custom',exact=True).click()
 past=page.evaluate("(()=>{let d=new Date(Date.now()-3600000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)})()")
 page.locator('#customExpiry').fill(past);page.get_by_role('button',name='Create request',exact=True).click()
 assert page.locator('#requestForm').is_visible()
 future=page.evaluate("(()=>{let d=new Date(Date.now()+7200000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)})()")
 page.locator('#customExpiry').fill(future);page.get_by_role('button',name='Create request',exact=True).click()
 page.wait_for_url('**/#/owner-waiting');stable=page.url
 wanted=page.evaluate('(v)=>new Date(v).toISOString()',future)
 assert page.locator('.intro time').get_attribute('datetime')==wanted
 page.wait_for_function("document.querySelector('.status-title')?.textContent.includes('being uploaded')")
 assert page.url==stable
 page.wait_for_function("document.querySelector('.status-title')?.textContent.includes('has arrived')")
 assert page.url==stable
 checks.append('Past custom time rejected in Europe/Warsaw; chosen absolute expiration retained; owner updates automatically at stable URL')
 page.locator('#theme').select_option('dark')
 page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{window.themeAtDOMReady=document.documentElement.dataset.theme})")
 page.reload();assert page.evaluate('themeAtDOMReady')=='dark'
 assert page.locator('head script').count()==1
 checks.append('Persisted theme initialization is in head before stylesheet/body; dark theme present at DOM ready')
 b.close()
(r/'review-verification.json').write_text(json.dumps({'passed':checks},indent=2))
print(json.dumps({'passed':checks},indent=2))
