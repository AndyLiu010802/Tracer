'use strict';
// Metadata bridge for the built-in imagegen orchestration. It never calls an API.
const fs=require('fs'),path=require('path'),{jobs}=require('./fishing-species-art-specs.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/fishing-species-v1'),records=()=>jobs.filter(j=>fs.existsSync(path.join(out,'art-'+j.id+'.json')));
const [command,id,arg]=process.argv.slice(2);
if(command==='pending')console.log(JSON.stringify(jobs.filter(j=>!records().some(r=>r.id===j.id)).map(j=>j.id)));
else if(command==='job'){const j=jobs.find(j=>j.id===id);if(!j)throw Error('Unknown species '+id);console.log(JSON.stringify(j));}
else if(command==='status')console.log(JSON.stringify({total:jobs.length,completed:records().length,pending:jobs.length-records().length}));
else if(command==='save'){
 const job=jobs.find(j=>j.id===id);if(!job)throw Error('Unknown species '+id);
 const source='art-source/fishing-species-v1/'+id+'.png',record=path.join(out,'art-'+id+'.json');
 if(fs.existsSync(record))throw Error('Already saved '+id);
 fs.copyFileSync(arg,path.join(root,source));
 fs.writeFileSync(record,JSON.stringify({...job,source,generator:'built-in imagegen',reference:'art-source/fishing-species-v1/sandgoby.png',generatedSource:arg},null,2)+'\n');
 console.log('Saved '+id);
}
else throw Error('Use pending, job ID, or status');
