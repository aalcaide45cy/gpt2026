import * as pdfjs from './vendor/pdf.min.mjs';
import {documentType} from './rules.mjs?v=0.3.0';
pdfjs.GlobalWorkerOptions.workerSrc='/assets/ocrtrabajo/vendor/pdf.worker.min.mjs';
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export function layoutText(items,width){
 const lines=[];
 for(const item of items.filter(i=>typeof i.str==='string'&&i.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  let line=lines.find(l=>Math.abs(l.y-item.transform[5])<=Math.max(2,(item.height||8)*.25));
  if(!line){line={y:item.transform[5],parts:[]};lines.push(line);}line.parts.push({x:item.transform[4],text:item.str,width:item.width});
 }
 for(const l of lines)l.parts.sort((a,b)=>a.x-b.x);
 return {text:lines.map(l=>l.parts.map(p=>p.text).join(' ')).join('\n'),left:lines.map(l=>l.parts.filter(p=>p.x<width*.49).map(p=>p.text).join(' ')).filter(Boolean).join('\n'),right:lines.map(l=>l.parts.filter(p=>p.x>=width*.49).map(p=>p.text).join(' ')).filter(Boolean).join('\n'),lines};
}
function rotate(source,deg){const swap=deg%180!==0,c=canvas(swap?source.height:source.width,swap?source.width:source.height),ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(deg*Math.PI/180);ctx.drawImage(source,-source.width/2,-source.height/2);return c;}
function threshold(source){const c=canvas(source.width,source.height),ctx=c.getContext('2d');ctx.drawImage(source,0,0);const image=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<image.data.length;i+=4){const n=(image.data[i]*.299+image.data[i+1]*.587+image.data[i+2]*.114)<120?0:255;image.data[i]=image.data[i+1]=image.data[i+2]=n;}ctx.putImageData(image,0,0);return c;}
function cards(source){
 const scale=Math.min(1,450/Math.max(source.width,source.height)),small=canvas(Math.round(source.width*scale),Math.round(source.height*scale));small.getContext('2d').drawImage(source,0,0,small.width,small.height);const {data}=small.getContext('2d').getImageData(0,0,small.width,small.height),w=small.width,h=small.height,mask=new Uint8Array(w*h),expanded=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];if(b>.93*r&&g>.91*r&&r<240&&Math.min(r,g,b)>70)mask[i]=1;}
 for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++)if(mask[y*w+x])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)expanded[(y+dy)*w+x+dx]=1;
 const boxes=[];
 for(let i=0;i<w*h;i++)if(expanded[i]){const queue=[i];expanded[i]=0;let minX=w,maxX=0,minY=h,maxY=0;for(let j=0;j<queue.length;j++){const pos=queue[j],x=pos%w,y=Math.floor(pos/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&ny>=0&&nx<w&&ny<h&&expanded[ny*w+nx]){expanded[ny*w+nx]=0;queue.push(ny*w+nx);}}
  const area=(maxX-minX)*(maxY-minY),ratio=(maxX-minX)/(maxY-minY);if(area>w*h*.025&&area<w*h*.8&&ratio>.3&&ratio<3)boxes.push({minX:Math.max(0,minX-4),minY:Math.max(0,minY-4),maxX:Math.min(w,maxX+5),maxY:Math.min(h,maxY+5),area});
 }
 return boxes.sort((a,b)=>b.area-a.area).slice(0,4).map(b=>{const c=canvas(Math.round((b.maxX-b.minX)/scale),Math.round((b.maxY-b.minY)/scale));c.getContext('2d').drawImage(source,b.minX/scale,b.minY/scale,c.width,c.height,0,0,c.width,c.height);return c;});
}
export function ocrScore(text){const t=text.toUpperCase().replace(/\s+/g,'');let score=0;for(const m of t.matchAll(/(?:\d{8}|[XYZ]\d{7})[A-Z]/g))if(documentType(m[0]))score+=100;if(/[A-Z]+<[A-Z<]+<<[A-Z]+/.test(t))score+=70;if(/\d{7}[MF<]\d{7}ESP/.test(t))score+=70;score+=Math.min(25,(text.match(/NOMBRE|APELLIDOS|DOMICILIO|NACIMIENTO|VALIDEZ/gi)||[]).length*5);return score;}
async function recognizeID(source,worker,status){
 const regions=cards(source);const targets=regions.length?regions:[source];const output=[];
 await worker.setParameters({tessedit_pageseg_mode:'11'});
 for(let i=0;i<targets.length;i++){
  const target=targets[i],angles=target.height>target.width?[270,90,0,180]:[0,180,270,90];let best={score:-1,text:'',image:target};
  for(const angle of angles){status('DNI · comprobando orientación y lectura '+(i+1)+'/'+targets.length);const image=rotate(target,angle);const r=await worker.recognize(image),text=r.data.text,score=ocrScore(text);if(score>best.score)best={score,text,image};if(score>=150)break;}
  output.push(best.text);
  await worker.setParameters({tessedit_pageseg_mode:'6'});const dense=await worker.recognize(best.image);output.push(dense.data.text);await worker.setParameters({tessedit_pageseg_mode:'11'});
  const alternate=canvas(Math.round(best.image.width*5/6),Math.round(best.image.height*5/6));alternate.getContext('2d').drawImage(best.image,0,0,alternate.width,alternate.height);
  output.push((await worker.recognize(alternate)).data.text);
  if(best.score<50){const extra=await worker.recognize(threshold(best.image));output.push(extra.data.text);}
 }
 await worker.setParameters({tessedit_pageseg_mode:'3'});return output.join('\n\n');
}
export async function readDocument(file,doc,worker,status=()=>{}){
 const pages=[];
 const ocr=async source=>doc==='dni'?recognizeID(source,worker,status):(await worker.recognize(source)).data.text;
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:'/assets/ocrtrabajo/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/assets/ocrtrabajo/vendor/standard_fonts/'}).promise;
  try{if(pdf.numPages>50)throw Error('El PDF supera 50 páginas.');for(let n=1;n<=pdf.numPages;n++){
   status('Leyendo '+(doc==='dni'?'DNI':'pedido')+' · página '+n+' de '+pdf.numPages);const page=await pdf.getPage(n),content=await page.getTextContent(),view=page.getViewport({scale:1}),layout=layoutText(content.items,view.width);
   if(layout.text.trim().length>30)pages.push({...layout,page:n,method:'Texto PDF'});
   else {const v=page.getViewport({scale:Math.min(3,3200/Math.max(view.width,view.height))}),c=canvas(Math.ceil(v.width),Math.ceil(v.height));await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;pages.push({page:n,method:'OCR local',text:await ocr(c),left:'',right:'',lines:[]});}
   page.cleanup();
  }}finally{await pdf.destroy();}
 } else {const img=await createImageBitmap(file);try{const scale=Math.min(1,3200/Math.max(img.width,img.height)),c=canvas(Math.round(img.width*scale),Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);pages.push({page:1,method:'OCR local',text:await ocr(c),left:'',right:'',lines:[]});}finally{img.close();}}
 return {pages,text:pages.map(p=>p.text).join('\n\f\n')};
}
