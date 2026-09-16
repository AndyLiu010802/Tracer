'use strict';
const { Arch } = require('electron-builder');
const { prepare } = require('./prepare-codex-runtime.cjs');
module.exports = async context => {
  await prepare(context.electronPlatformName, Arch[context.arch]);
};
