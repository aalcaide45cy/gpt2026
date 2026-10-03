import fs from 'node:fs';
import {zipSync} from 'fflate';
import path from 'node:path';
export function buildOCR(root){
 const base=root+'/assets/ocrtrabajo';fs.mkdirSync(base+'/vendor/core',{recursive:true});fs.mkdirSync(root+'/ocrtrabajo',{recursive:true});
 fs.copyFileSync('src/ocrtrabajo/index.html',root+'/ocrtrabajo/index.html');
 for(const file of ['app.js','style.css','rules.mjs','reader.mjs','autocarpe.mjs'])fs.copyFileSync('src/ocrtrabajo/'+file,base+'/'+file);
 for(const file of ['tesseract.min.js','worker.min.js'])fs.copyFileSync('node_modules/tesseract.js/dist/'+file,base+'/vendor/'+file);
 for(const file of fs.readdirSync('node_modules/tesseract.js-core').filter(f=>/^tesseract-core.*\.(js|wasm)$/.test(f)))fs.copyFileSync('node_modules/tesseract.js-core/'+file,base+'/vendor/core/'+file);
 for(const file of ['pdf.min.mjs','pdf.worker.min.mjs'])fs.copyFileSync('node_modules/pdfjs-dist/build/'+file,base+'/vendor/'+file);
 fs.cpSync('node_modules/pdfjs-dist/cmaps',base+'/vendor/cmaps',{recursive:true});fs.cpSync('node_modules/pdfjs-dist/standard_fonts',base+'/vendor/standard_fonts',{recursive:true});
 const entries={};
 function collect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())collect(file);else entries[path.relative('extension/ocrtrabajo',file)]=new Uint8Array(fs.readFileSync(file));}}
 collect('extension/ocrtrabajo');fs.writeFileSync(base+'/extension.zip',zipSync(entries));
}
