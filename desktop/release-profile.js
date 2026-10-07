'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Only embedded application metadata selects the commercial profile. Environment
// flags, renderer preferences and imported backups cannot select this channel.
const COMMERCIAL_MARKER = Object.freeze({ version: 1, channel: 'commercial' });
function assertCommercialMarker(marker) {
  if (!marker || Array.isArray(marker) || typeof marker !== 'object' ||
      Object.keys(marker).length !== 2 || marker.version !== 1 || marker.channel !== 'commercial') {
    throw new Error('Commercial build requires the reviewed tracerRelease metadata marker');
  }
}

function releaseChannel({ isPackaged, appPath, readPackage = file => JSON.parse(fs.readFileSync(file, 'utf8')) }) {
  if (!isPackaged) return 'local';
  // A corrupt packaged manifest must not silently fall back to personal data.
  const metadata = readPackage(path.join(appPath, 'package.json'));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Invalid packaged application metadata');
  }
  if (!Object.hasOwn(metadata, 'tracerRelease')) return 'local';
  assertCommercialMarker(metadata.tracerRelease);
  return 'commercial';
}

function normalized(value, paths, platform) {
  let result = paths.resolve(value);
  if (platform === 'win32') {
    // Windows extended-path spelling and trailing dots/spaces alias normal paths.
    result = result.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/, '');
    result = result.split('\\').map(part => part.replace(/[. ]+$/, '')).join('\\').toLowerCase();
  }
  return result;
}

function canonical(value, paths, platform, realpath) {
  let current = paths.resolve(value), suffix = [];
  // Resolve existing ancestors too: a new QA child underneath a junction must
  // not secretly land in the personal profile. This reads directory metadata
  // only; it never enumerates, reads, creates, or migrates profile contents.
  for (;;) {
    try { return normalized(paths.join(realpath(current), ...suffix), paths, platform); }
    catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      const parent = paths.dirname(current);
      if (parent === current) return normalized(value, paths, platform);
      suffix.unshift(paths.basename(current)); current = parent;
    }
  }
}

function overlaps(a, b, paths) {
  const relative = paths.relative(a, b);
  return relative === '' || (!paths.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + paths.sep));
}

function resolveDesktopProfile(options) {
  const { appData, env = {}, platform = process.platform, realpath = fs.realpathSync.native } = options;
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const channel = releaseChannel(options);
  const userData = env.TRACER_USER_DATA_DIR ? paths.resolve(env.TRACER_USER_DATA_DIR) :
    paths.join(appData, channel === 'commercial' ? 'tracer-desktop-commercial' : 'tracer-desktop');
  const dataDir = env.DOCS_PORTAL_DATA_DIR || paths.join(userData, 'data');
  const stateFile = env.DOCS_PORTAL_STATE_FILE || paths.join(userData, 'bookmarks.json');
  if (channel === 'commercial') {
    const protectedPaths = ['tracer-desktop', 'podmatrix-desktop'].map(name =>
      canonical(paths.join(appData, name), paths, platform, realpath));
    for (const [name, value] of [['TRACER_USER_DATA_DIR', userData], ['DOCS_PORTAL_DATA_DIR', dataDir], ['DOCS_PORTAL_STATE_FILE', stateFile]]) {
      const target = canonical(value, paths, platform, realpath);
      if (protectedPaths.some(personal => overlaps(personal, target, paths) || overlaps(target, personal, paths))) {
        const error = new Error('Commercial profile must not overlap local personal data: ' + name);
        error.code = 'TRACER_PROFILE_ISOLATION'; throw error;
      }
    }
  }
  return { channel, userData, dataDir, stateFile,
    migrateLegacy: channel === 'local' && !env.TRACER_USER_DATA_DIR,
    migrationStatus: channel === 'commercial' ? 'commercial-profile' : 'custom-profile' };
}

module.exports = { COMMERCIAL_MARKER, assertCommercialMarker, releaseChannel, resolveDesktopProfile };
