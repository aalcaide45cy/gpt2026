import asyncio, json, subprocess, io
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright
sectors=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {verticals} from './src/verticals.mjs';console.log(JSON.stringify(verticals.map(({id})=>id)))"],text=True))
async def main():
 output=Path('assets/previews');output.mkdir(exist_ok=True)
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);sem=asyncio.Semaphore(4);completed=[]
  async def render(slug,v):
   async with sem:
    page=await b.new_page(viewport={'width':1280,'height':820},device_scale_factor=1)
    await page.goto(f'http://127.0.0.1:3002/demos/{slug}/{v}/',wait_until='networkidle')
    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'),(slug,v)
    await page.evaluate("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.querySelector('#explorar').getBoundingClientRect().top+window.scrollY-35)")
    await page.wait_for_timeout(80)
    data=await page.screenshot()
    im=Image.open(io.BytesIO(data)).convert('RGB');im.resize((640,410),Image.Resampling.LANCZOS).save(output/f'{slug}-{v}.webp','WEBP',quality=82,method=4)
    await page.close();completed.append(1)
    if len(completed)%15==0:print(len(completed),'previews',flush=True)
  await asyncio.gather(*(render(s,v) for s in sectors for v in [1,2,3]));await b.close()
 print('135 real previews generated; desktop layout checks passed.')
asyncio.run(main())
