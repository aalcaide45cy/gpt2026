import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sectors} from '../src/sectors.mjs';
import {posts} from '../src/posts.mjs';
assert.equal(sectors.length,45);assert.equal(new Set(sectors.map(s=>s.id)).size,45);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)])}
const html=files('dist').filter(p=>p.endsWith('.html'));assert.equal(html.length,189);
let links=0;
for(const file of html){const text=fs.readFileSync(file,'utf8');assert(text.includes('lang="es"'));assert(text.includes('name="viewport"'));assert(text.includes('<title>'));assert.equal((text.match(/<h1[ >]/g)||[]).length,1,file);const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,`duplicate ids ${file}`);for(const m of text.matchAll(/(?:href|src)="([^"]+)"/g)){const url=m[1];if(!url.startsWith('/')&&!url.startsWith('#'))continue;let [u,anchor]=url.split('#');if(!u){assert(ids.includes(anchor),`anchor ${url} missing in ${file}`);continue}const p=path.join('dist',u);const target=fs.existsSync(p)&&fs.statSync(p).isFile()?p:path.join(p,'index.html');assert(fs.existsSync(target),`broken ${url} in ${file}`);if(anchor){const dest=fs.readFileSync(target,'utf8');assert(dest.includes(`id="${anchor}"`),`broken anchor ${url}`)}links++}for(const m of text.matchAll(/sector-(\d+)\.webp/g))assert(fs.existsSync(`dist/assets/sector-${m[1]}.webp`))}
for(const s of sectors)for(let v=1;v<=3;v++)assert(fs.existsSync(`dist/demos/${s.id}/${v}/index.html`));
for(const p of posts)assert(fs.existsSync(`dist/motoyayos/blog/${p.id}/index.html`));
const images=files('dist/assets').filter(f=>/\.(png|jpg|jpeg|gif)$/i.test(f));assert.equal(images.length,0);
console.log(`Validated ${html.length} pages and ${links} internal links. 135 demos, 45 sector comparisons, 6 blog articles; all raster assets WebP.`);
