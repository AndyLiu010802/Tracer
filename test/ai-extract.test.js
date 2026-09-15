'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{extract}=require('../lib/ai-extract');
const input=(name,data)=>({name,data:Buffer.from(data).toString('base64')});
function pdfFixture(){const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const content='BT /F1 12 Tf 72 720 Td (Task brief for planning) Tj ET';objs.push('<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');let out='%PDF-1.4\n',offsets=[0];objs.forEach((s,i)=>{offsets.push(out.length);out+=(i+1)+' 0 obj\n'+s+'\nendobj\n';});const offset=out.length;out+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF';return out;}
test('extracts text locally from UTF-8, PDF and DOCX',async()=>{
 assert.equal((await extract(input('brief.txt','中文任务 brief'))).text,'中文任务 brief');
 const pdf=await extract(input('brief.pdf',pdfFixture()));assert.match(pdf.text,/Task brief for planning/);
 const JSZip=require('jszip'),zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word task brief</w:t></w:r></w:p></w:body></w:document>');
 assert.match((await extract(input('brief.docx',await zip.generateAsync({type:'nodebuffer'})))).text,/Word task brief/);
});
test('rejects unsupported, empty, corrupted and excessive documents',async()=>{
 assert.throws(()=>extract(input('file.exe','data')),/unsupported/);await assert.rejects(extract(input('blank.txt',' ')),/no-document-text/);await assert.rejects(extract(input('bad.pdf','not pdf')),/document-unreadable/);await assert.rejects(extract(input('large.txt','x'.repeat(120001))),/documents-too-large/);
});
module.exports={pdfFixture};
