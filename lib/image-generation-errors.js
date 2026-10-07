'use strict';

// Provider text can contain submitted material or secrets. Only these application
// codes may leave the image adapter; never return the upstream message itself.
function label(value) {
  return typeof value === 'string' && value.length <= 120
    ? value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-.\s]/g, '_').toLowerCase() : '';
}
const content = new Set(['content_policy_violation', 'content_policy_violated', 'moderation_blocked', 'content_filter', 'content_filtered', 'safety_violation', 'safety_system_rejection']);
const quota = new Set(['insufficient_quota', 'billing_hard_limit_reached', 'billing_not_active', 'quota_exceeded', 'usage_limit_exceeded', 'credits_exhausted']);
const rate = new Set(['rate_limit_exceeded', 'rate_limit_error', 'requests_limit_exceeded', 'too_many_requests']);
const image = new Set(['invalid_image', 'image_parse_error', 'image_too_large', 'invalid_image_format', 'invalid_image_url', 'image_size_exceeded', 'unsupported_image', 'invalid_base64']);
const options = new Set(['model_not_found', 'unsupported_model', 'unsupported_parameter', 'unsupported_value', 'unknown_parameter']);
function structured(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const error = value.error && typeof value.error === 'object' && !Array.isArray(value.error) ? value.error : value;
  const tags = [label(error.code), label(error.type)];
  if (tags.some(tag => content.has(tag))) return 'image-content-rejected';
  if (tags.some(tag => quota.has(tag))) return 'image-quota-exhausted';
  if (tags.some(tag => rate.has(tag))) return 'provider-busy';
  if (tags.some(tag => image.has(tag))) return 'image-input-invalid';
  if (tags.some(tag => options.has(tag))) return 'image-parameters-unsupported';
  return null;
}
function provider(status, value) {
  // Authentication remains authoritative; an unknown 403 still uses the
  // existing credential/access advice, while an explicit safety code can differ.
  if (status === 401) return 'invalid-api-key';
  const known = structured(value);
  if (known) return known;
  if (status === 403) return 'invalid-api-key';
  if (status === 429) return 'provider-busy';
  if (status === 413) return 'image-input-invalid';
  if ([400, 415, 422].includes(status)) {
    const error = value?.error && typeof value.error === 'object' ? value.error : value;
    const param = typeof error?.param === 'string' && error.param.length <= 120 ? error.param : '';
    if (/^image(?:\[\d*\]|(?:\[\d+\])?\.(?:url|image_url))?$/.test(param) || param === 'image_url') return 'image-input-invalid';
    if (['model', 'size', 'quality', 'background', 'output_format', 'input_fidelity', 'n'].includes(param)) return 'image-parameters-unsupported';
  }
  if (status === 408 || status === 504) return 'provider-timeout';
  return [400, 404, 405, 415, 422].includes(status) ? 'image-generation-unsupported' : 'provider-unavailable';
}
function native(value) {
  const known = structured(value);
  return known === 'image-quota-exhausted' ? 'codex-quota-exhausted' : known;
}
function transport(error, signal) {
  return error?.name === 'TimeoutError' || (signal?.aborted && signal.reason?.name === 'TimeoutError') ? 'provider-timeout' : 'provider-unreachable';
}
module.exports = { provider, native, transport };
