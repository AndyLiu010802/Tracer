'use strict';
module.exports=async context=>{
 const {prepare,manifest}=require('./commercial-release.cjs');
 prepare(context.packager.projectDir);manifest(context.packager.projectDir);
 await require('./before-desktop-pack.cjs')(context);
};
