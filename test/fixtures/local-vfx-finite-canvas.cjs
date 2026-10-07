'use strict';

const assert = require('node:assert/strict');

// This checks geometry/state safety and repeatability. It does not establish
// shape resemblance, smoke quality, actual pixels or operating-system input.
function finiteContext(width = 1280, height = 720) {
  const calls = [];
  const stack = [];
  const context = {
    canvas: { width, height },
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    transformValue: [1, 0, 0, 1, 0, 0]
  };
  const validate = method => {
    assert(Number.isFinite(context.globalAlpha) && context.globalAlpha >= 0 && context.globalAlpha <= 1, `${method}: globalAlpha`);
    for (const key of ['lineWidth', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY']) assert(Number.isFinite(context[key]), `${method}: ${key}`);
    assert(context.lineWidth >= 0 && context.shadowBlur >= 0, `${method}: negative draw metric`);
  };
  const record = (method, args) => {
    validate(method);
    calls.push({ method, args: args.slice(), alpha: context.globalAlpha, composite: context.globalCompositeOperation,
      fillStyle: typeof context.fillStyle === 'string' ? context.fillStyle : 'gradient',
      strokeStyle: typeof context.strokeStyle === 'string' ? context.strokeStyle : 'gradient' });
  };
  for (const method of ['clearRect', 'fillRect', 'strokeRect', 'rect', 'translate', 'rotate', 'scale', 'transform', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo', 'arc', 'arcTo', 'ellipse']) {
    context[method] = (...args) => {
      assert(args.filter(value => typeof value !== 'boolean').every(Number.isFinite), `${method}: nonfinite coordinate`);
      if (method === 'arc') assert(args[2] >= 0);
      if (method === 'ellipse') assert(args[2] >= 0 && args[3] >= 0);
      if (method === 'arcTo') assert(args[4] >= 0);
      record(method, args);
    };
  }
  for (const method of ['beginPath', 'closePath', 'fill', 'stroke', 'clip']) context[method] = (...args) => record(method, args);
  context.setTransform = (...args) => {
    assert(args.every(Number.isFinite)); context.transformValue = args.slice(); record('setTransform', args);
  };
  context.save = () => stack.push({ ...context, transformValue: context.transformValue.slice() });
  context.restore = () => {
    assert(stack.length > 0, 'unbalanced canvas restore');
    const saved = stack.pop();
    for (const key of ['globalAlpha', 'globalCompositeOperation', 'lineWidth', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'transformValue', 'fillStyle', 'strokeStyle', 'lineCap', 'lineJoin', 'filter', 'imageSmoothingEnabled']) context[key] = saved[key];
  };
  for (const method of ['createLinearGradient', 'createRadialGradient']) {
    context[method] = (...args) => {
      assert(args.every(Number.isFinite), `${method}: nonfinite coordinate`);
      if (method === 'createRadialGradient') assert(args[2] >= 0 && args[5] >= 0);
      const stops = [];
      calls.push({ method, args: args.slice(), stops });
      return { addColorStop(position, color) {
        assert(Number.isFinite(position) && position >= 0 && position <= 1);
        assert.equal(typeof color, 'string'); stops.push([position, color]);
      } };
    };
  }
  context.setLineDash = values => { assert(values.every(value => Number.isFinite(value) && value >= 0)); record('setLineDash', values); };
  context.drawImage = (...args) => {
    assert(args.slice(1).every(Number.isFinite), 'drawImage: nonfinite coordinate'); record('drawImage', args.slice(1));
  };
  return { ctx: context, calls, stack };
}

function assertFiniteTree(value, path = 'sample') {
  if (typeof value === 'number') { assert(Number.isFinite(value), `${path} is nonfinite`); return; }
  if (Array.isArray(value)) { value.forEach((entry, i) => assertFiniteTree(entry, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) assertFiniteTree(entry, `${path}.${key}`);
}

module.exports = { finiteContext, assertFiniteTree };
