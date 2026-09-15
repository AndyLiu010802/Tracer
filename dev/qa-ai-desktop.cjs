'use strict';
// Current desktop AI verification: simplified UI plus native credential storage.
// Real provider credentials are deliberately not used by this test suite.
const cp=require('node:child_process'),path=require('node:path');
for(const file of ['qa-ai-personal.cjs','qa-ai-personal-storage.cjs']) {
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit',env:process.env});
 if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);
}
