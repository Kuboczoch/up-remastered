from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
import json
r=Path(__file__).parent
out=r/'screenshots';out.mkdir(exist_ok=True)
results=[]
with sync_playwright() as p:
 b=p.chromium.launch()
 page=b.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1,color_scheme='dark')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/v6-approved/')
 page.wait_for_function('getComputedStyle(document.querySelector(".scene")).backgroundImage.startsWith("url(")')
 assert page.locator('#theme').count()==0
 assert page.evaluate('getComputedStyle(document.body).backgroundColor')=='rgb(255, 255, 255)'
 results.append('White background with OS dark preference; no theme selector')
 states=page.evaluate('Object.keys(states)')
 for width in [320,360,390,430,768,1440]:
  page.set_viewport_size({'width':width,'height':1050 if width>600 else 900})
  for state in states:
   page.evaluate('(s)=>render(s)',state)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,state)
  results.append(f'{width}px: {len(states)} states without horizontal overflow')
 for label,width,height in [('desktop',1440,1050),('mobile',390,1000)]:
  page.set_viewport_size({'width':width,'height':height})
  for state in ['home','history','uploading','success','request','owner-waiting','network','qr']:
   page.evaluate('(s)=>render(s)',state)
   page.wait_for_timeout(180)
   page.screenshot(path=str(out/f'{label}-{state}.png'),full_page=True)
 assert not errors,errors
 results.append('No browser JavaScript errors')
 b.close()
(r/'verification.json').write_text(json.dumps({'passed':results},indent=2))
# Side-by-side mobile overview, retaining readable labels and whole layouts.
names=['home','uploading','success','request']
images=[Image.open(out/f'mobile-{name}.png').convert('RGB') for name in names]
w=max(i.width for i in images);h=max(i.height for i in images)
sheet=Image.new('RGB',(w*4+80,h+70),'#eef2ef');draw=ImageDraw.Draw(sheet)
for n,(image,name) in enumerate(zip(images,names)):
 x=16+n*(w+16);draw.text((x,18),name.replace('-',' ').title(),fill='#203c32');sheet.paste(image,(x,48))
sheet.save(out/'mobile-overview.png')
print(json.dumps({'passed':results,'screenshots':str(out)},indent=2))