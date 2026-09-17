'use strict';
// Run with the desktop application closed. This is local migration tooling;
// neither this script nor its backups are shipped in the installer.
// TRACER_MIGRATION_SNAPSHOT selects a saved {origin,dirty,workspace,prefs} JSON.
// Optional: TRACER_MIGRATION_DIR (backups), TRACER_MIGRATION_ORIGIN (source
// origin), TRACER_MIGRATION_BOOKMARKS (bookmarks JSON). Defaults stay in .cache.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const folder = path.resolve(process.env.TRACER_MIGRATION_DIR || path.join(root, '.cache', 'desktop-migration'));
const snapshot = path.resolve(process.env.TRACER_MIGRATION_SNAPSHOT || path.join(folder, 'browser-workspace.json'));
const source = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
const expectedOrigin = process.env.TRACER_MIGRATION_ORIGIN || 'http://127.0.0.1:8097';
if (source.origin !== expectedOrigin || source.dirty || !Array.isArray(source.workspace?.tasks) || !source.prefs || typeof source.prefs !== 'object' || Array.isArray(source.prefs)) throw new Error('Expected a saved workspace snapshot from ' + expectedOrigin);
if (!process.env.APPDATA) throw new Error('APPDATA unavailable');
const profile = path.resolve(process.env.APPDATA, 'tracer-desktop');
if (path.dirname(profile).toLowerCase() !== path.resolve(process.env.APPDATA).toLowerCase()) throw new Error('Unexpected desktop profile path');
if (folder.toLowerCase() === profile.toLowerCase() || folder.toLowerCase().startsWith(profile.toLowerCase() + path.sep)) throw new Error('Backup folder must be outside the desktop profile');
fs.mkdirSync(folder, { recursive: true });
const backup = path.join(folder, 'desktop-profile-before-' + Date.now());
if (fs.existsSync(profile)) fs.cpSync(profile, backup, {recursive:true,force:false,errorOnExist:true});
if (fs.existsSync(path.join(profile,'data','.sync','connection.json'))) throw new Error('An existing desktop profile has legacy pairing data; preserve it for a separate migration');
fs.mkdirSync(path.join(profile,'data'),{recursive:true});
function atomic(file, text) {
  const tmp=file+'.migration-'+process.pid;
  fs.writeFileSync(tmp,text,{flag:'wx'}); fs.renameSync(tmp,file);
}
const workspaceText=JSON.stringify(source.workspace,null,2);
atomic(path.join(profile,'data','workspace.json'),workspaceText);
atomic(path.join(profile,'data','workspace.json.bak'),workspaceText);
atomic(path.join(profile,'browser-preferences.pending.json'),JSON.stringify(source.prefs,null,2));
const bookmarks=path.resolve(process.env.TRACER_MIGRATION_BOOKMARKS || path.join(path.dirname(snapshot),'bookmarks.json'));
if(fs.existsSync(bookmarks))atomic(path.join(profile,'bookmarks.json'),fs.readFileSync(bookmarks,'utf8'));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
if(digest(workspaceText)!==digest(fs.readFileSync(path.join(profile,'data','workspace.json'))))throw new Error('Workspace verification failed');
console.log(JSON.stringify({profile,backup,tasks:source.workspace.tasks.length,completionHistory:source.workspace.completionHistory?.length||0,preferences:Object.keys(source.prefs).length,verified:true},null,2));
