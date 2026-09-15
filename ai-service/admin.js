'use strict';
// Run only while the service is stopped: single-process durable account store.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(process.env.DATA_DIR||path.join(__dirname,'data'),'accounts.json');
const [action,username]=process.argv.slice(2);
if(!['list','reset-password','delete-user'].includes(action))throw new Error('Usage: node ai-service/admin.js list | reset-password USER | delete-user USER');
const db=JSON.parse(fs.readFileSync(file,'utf8'));
if(action==='list'){console.log(db.users.map(u=>({username:u.username,day:u.day,used:u.used})));process.exit(0);}
const user=db.users.find(u=>u.username===username);if(!user)throw new Error('User not found');
if(action==='reset-password'){
 // Password is read from stdin; do not pass secrets as command-line arguments.
 const password=fs.readFileSync(0,'utf8').trimEnd();if(password.length<12||password.length>128)throw new Error('Password must have 12-128 characters');
 user.salt=crypto.randomBytes(16).toString('hex');user.digest=crypto.scryptSync(password,user.salt,64).toString('hex');
}else db.users=db.users.filter(u=>u!==user);
db.sessions=db.sessions.filter(s=>s.userId!==user.id);fs.writeFileSync(file+'.tmp',JSON.stringify(db),{mode:0o600});fs.renameSync(file+'.tmp',file);console.log('Account updated; all sessions revoked.');
