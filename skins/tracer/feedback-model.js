(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerFeedbackModel = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_TEXT = 4000;
  // Only release versions and known prerelease labels belong in a diagnostic.
  // Arbitrary build metadata can contain local paths or other identifying text.
  var VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(?:-(?:alpha|beta|rc)(?:\.(?:0|[1-9]\d{0,5}))?)?$/;

  function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function own(value, key) {
    if (!record(value)) return undefined;
    var descriptor = Object.getOwnPropertyDescriptor(value, key);
    // Do not execute input getters or inherit fields from a prototype.
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  }
  function choice(value, allowed, fallback) { return allowed.indexOf(value) >= 0 ? value : fallback; }
  function integer(value, max) { return Number.isInteger(value) && value >= 0 && value <= max ? value : null; }
  function flag(value, key) { return own(value, key) === true; }

  function diagnostics(input) {
    var app = own(input, 'app');
    var viewport = own(app, 'viewport');
    var workspace = own(input, 'workspace');
    var account = own(input, 'account');
    var focus = own(input, 'focus');
    var version = own(app, 'version');
    return {
      app: {
        version: typeof version === 'string' && VERSION.test(version) ? version : 'unknown',
        runtime: choice(own(app, 'runtime'), ['desktop', 'browser'], 'browser'),
        language: choice(own(app, 'language'), ['en', 'zh'], 'en'),
        platform: choice(own(app, 'platform'), ['windows', 'macos', 'linux', 'android', 'ios'], 'unknown'),
        browser: choice(own(app, 'browser'), ['edge', 'chrome', 'firefox', 'safari', 'other'], 'other'),
        viewport: { width: integer(own(viewport, 'width'), 32768), height: integer(own(viewport, 'height'), 32768) }
      },
      workspace: {
        loaded: flag(workspace, 'loaded'),
        pendingSave: flag(workspace, 'pendingSave'),
        saving: flag(workspace, 'saving'),
        conflict: flag(workspace, 'conflict'),
        loadFailed: flag(workspace, 'loadFailed'),
        taskCount: integer(own(workspace, 'taskCount'), 1000000),
        projectCount: integer(own(workspace, 'projectCount'), 1000000),
        noteCount: integer(own(workspace, 'noteCount'), 1000000),
        inboxCount: integer(own(workspace, 'inboxCount'), 1000000)
      },
      account: {
        mode: choice(own(account, 'mode'), ['guest', 'account', 'locked'], 'guest'),
        switching: flag(account, 'switching')
      },
      focus: {
        available: flag(focus, 'available'),
        mode: choice(own(focus, 'mode'), ['focus', 'short', 'long'], 'focus'),
        running: flag(focus, 'running'),
        completed: flag(focus, 'completed'),
        historyCount: integer(own(focus, 'historyCount'), 1000000)
      }
    };
  }

  function fail(code) { var error = new Error(code); error.code = code; throw error; }
  function freeform(value, field, required) {
    var code = field.toUpperCase();
    if (value === undefined || value === null) value = '';
    if (typeof value !== 'string') fail('INVALID_' + code);
    // Validate before trimming: do not silently drop an over-limit input.
    if (value.length > MAX_TEXT) fail(code + '_TOO_LONG');
    if (required) {
      value = value.trim();
      if (!value) fail('DESCRIPTION_REQUIRED');
    }
    return value;
  }
  function build(input) {
    if (!record(input)) fail('INVALID_INPUT');
    var id = own(input, 'id');
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) fail('INVALID_ID');
    var createdAt = own(input, 'createdAt');
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || Math.abs(createdAt) > 8640000000000000) fail('INVALID_CREATED_AT');
    var type = own(input, 'type');
    if (type === undefined || type === null || type === '') type = 'bug';
    if (['bug', 'idea', 'question'].indexOf(type) < 0) fail('INVALID_TYPE');
    var result = {
      format: 'tracer-feedback',
      version: 1,
      id: id,
      createdAt: new Date(createdAt).toISOString(),
      type: type,
      description: freeform(own(input, 'description'), 'description', true),
      steps: freeform(own(input, 'steps'), 'steps', false),
      expected: freeform(own(input, 'expected'), 'expected', false)
    };
    var details = own(input, 'diagnostics');
    if (details !== null && details !== undefined) result.diagnostics = diagnostics(details);
    return result;
  }

  return { build: build, diagnostics: diagnostics };
});
