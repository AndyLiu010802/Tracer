'use strict';
const { Arch } = require('electron-builder');
const { prepare } = require('./prepare-codex-runtime.cjs');
const { verifyAssets } = require('./desktop-pack-assets.cjs');
module.exports = async context => {
  require('./release-mode.cjs').assertBuildMode(context.packager.config,context.packager.projectDir);
  verifyAssets(context.packager.projectDir);
  await prepare(context.electronPlatformName, Arch[context.arch]);
};
