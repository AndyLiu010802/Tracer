'use strict';
const {parentPort,workerData}=require('node:worker_threads');
(async()=>{
 const buffer=Buffer.from(workerData.data),ext=workerData.ext;let text='';
 if(ext==='pdf'){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const asset=name=>require('node:path').join(require('node:path').dirname(require.resolve('pdfjs-dist/package.json')),name)+'/';
  const job=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,verbosity:0,standardFontDataUrl:asset('standard_fonts'),cMapUrl:asset('cmaps'),cMapPacked:true});
  const pdf=await job.promise;try{if(pdf.numPages>150)throw new Error('too-many-pages');for(let n=1;n<=pdf.numPages;n++){const content=await(await pdf.getPage(n)).getTextContent();text+=content.items.map(i=>i.str||'').join(' ')+'\n';if(text.length>120000)throw new Error('documents-too-large');}}finally{await job.destroy();}
 }else if(ext==='docx'){text=(await require('mammoth').extractRawText({buffer})).value;}else{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
 if(!text.trim())throw new Error('no-document-text');if(text.length>120000)throw new Error('documents-too-large');parentPort.postMessage({text});
})().catch(e=>{parentPort.postMessage({error:['too-many-pages','no-document-text','documents-too-large'].includes(e.message)?e.message:'document-unreadable'});});
