'use strict';

function webURL(value) {
  if (typeof value !== 'string' || value.length > 16384) return '';
  let input = value.trim();
  if (!input) return '';
  if (!/^[a-z][a-z\d+.-]*:/i.test(input)) input = 'https://' + input;
  try {
    const url = new URL(input);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function bounds(rect, zoom, size) {
  if (!rect || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k]))) return null;
  const left = Math.max(0, Math.min(size[0], Math.round(rect.x * zoom)));
  const top = Math.max(0, Math.min(size[1], Math.round(rect.y * zoom)));
  const right = Math.max(left, Math.min(size[0], Math.round((rect.x + rect.width) * zoom)));
  const bottom = Math.max(top, Math.min(size[1], Math.round((rect.y + rect.height) * zoom)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
module.exports = { webURL, bounds };
