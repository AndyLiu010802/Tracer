(function () {
  'use strict';

  // 文档内容。皮肤自带，与引擎无关。
  // 换皮肤 = 换掉整个 skins/<name>/ 目录，引擎侧不用动。

  var PAGES = {
    overview: {
      crumbs: ['Docs', 'Getting started', 'Pipeline overview'],
      html: [
        '<h1>Pipeline overview</h1>',
        '<p class="lede">How raw vendor feeds become normalized, queryable market data — and where each stage can fail.</p>',
        '<p>The ingestion pipeline runs as four decoupled stages. Each stage reads from a durable queue and writes to the next, so a slow or failing stage applies backpressure rather than dropping data. Stages are independently deployable and independently scalable.</p>',
        '<h2 id="stages">Stages</h2>',
        '<table><thead><tr><th>Stage</th><th>Service</th><th>Input</th><th>Typical p95</th></tr></thead><tbody>',
        '<tr><td>Collect</td><td><code>md-collector</code></td><td>Vendor socket / REST</td><td>40 ms</td></tr>',
        '<tr><td>Decode</td><td><code>md-decoder</code></td><td><code>raw.ticks</code></td><td>12 ms</td></tr>',
        '<tr><td>Normalize</td><td><code>md-normalizer</code></td><td><code>decoded.ticks</code></td><td>85 ms</td></tr>',
        '<tr><td>Publish</td><td><code>md-publisher</code></td><td><code>normal.ticks</code></td><td>30 ms</td></tr>',
        '</tbody></table>',
        '<p>Only <code>md-collector</code> holds vendor credentials. Downstream stages operate on internal representations and never reach the public internet, which keeps the credential blast radius to a single service.</p>',
        '<h2 id="delivery">Delivery guarantees</h2>',
        '<p>The pipeline is at-least-once end to end. Consumers must be idempotent. Every tick carries a stable <code>dedupe_key</code> derived from the vendor sequence number and the instrument identifier:</p>',
        '<pre><code>dedupe_key = sha1(f"{vendor}:{instrument_id}:{vendor_seq}")[:16]</code></pre>',
        '<p>Replays after an incident routinely produce duplicates. A consumer that assumes exactly-once will double-count volume, and that failure is silent — it shows up days later as a reconciliation break, not as an error.</p>',
        '<div class="warn"><strong>Common mistake</strong>Do not derive <code>dedupe_key</code> from the ingest timestamp. Timestamps differ between the original delivery and the replay, so every replayed tick reads as new.</div>',
        '<h2 id="ordering">Ordering</h2>',
        '<p>Ordering is guaranteed per instrument, not globally. Partitioning is by <code>instrument_id</code>, so two ticks for the same instrument always arrive in vendor sequence order, while ticks for different instruments may interleave arbitrarily.</p>',
        '<p>If you need a cross-instrument ordered view — for example to reconstruct a basket at a point in time — buffer on <code>event_time</code> and release on a watermark. Do not rely on arrival order.</p>',
        '<h2 id="backfill">Backfill</h2>',
        '<p>Backfills run through the same stages as live traffic but on a separate queue prefix (<code>backfill.*</code>) and with a reduced concurrency ceiling. This keeps a large historical job from starving live ingestion.</p>',
        '<pre><code>$ md-admin backfill create \\\n    --vendor acme \\\n    --from 2019-01-01 --to 2019-12-31 \\\n    --concurrency 4\n\nbackfill job bf_7f21ac created (est. 18h)</code></pre>',
        '<p>Jobs are resumable. If a backfill is interrupted, re-running the same command resumes from the last committed checkpoint rather than restarting.</p>',
      ].join('\n'),
    },

    auth: {
      crumbs: ['Docs', 'Getting started', 'Authentication'],
      html: [
        '<h1>Authentication</h1>',
        '<p class="lede">Service-to-service auth uses short-lived tokens issued per workload identity.</p>',
        '<h2 id="tokens">Obtaining a token</h2>',
        '<p>Tokens are issued by the internal identity service and expire after 15 minutes. Clients should request a token on startup and refresh at the 80% mark of the lifetime rather than waiting for a 401.</p>',
        '<pre><code>POST /v1/token\nContent-Type: application/json\n\n{\n  "workload": "research-notebook",\n  "scope": ["ticks:read", "reference:read"]\n}</code></pre>',
        '<p>The response carries the token and its absolute expiry. Store it in memory only — writing tokens to disk or logs is the single most common source of credential leakage in this platform.</p>',
        '<h2 id="scopes">Scopes</h2>',
        '<table><thead><tr><th>Scope</th><th>Grants</th></tr></thead><tbody>',
        '<tr><td><code>ticks:read</code></td><td>Read normalized tick data</td></tr>',
        '<tr><td><code>ticks:write</code></td><td>Publish to ingestion queues (collectors only)</td></tr>',
        '<tr><td><code>reference:read</code></td><td>Read instrument reference data</td></tr>',
        '<tr><td><code>admin:backfill</code></td><td>Create and cancel backfill jobs</td></tr>',
        '</tbody></table>',
        '<div class="note"><strong>Note</strong>Scopes are additive and cannot be narrowed after issuance. Request the minimum set your workload needs; a token with <code>ticks:write</code> that only reads is an unnecessary liability.</div>',
        '<h2 id="rotation">Rotation</h2>',
        '<p>Workload signing keys rotate every 90 days. Rotation is transparent to clients that refresh normally, but a client holding a token across a rotation boundary will see a 401 with <code>code=key_rotated</code>. Treat that as a signal to re-authenticate immediately rather than to retry the same token.</p>',
      ].join('\n'),
    },

    'rate-limits': {
      crumbs: ['Docs', 'Ingestion', 'Rate limits & backoff'],
      html: [
        '<h1>Rate limits &amp; backoff</h1>',
        '<p class="lede">Vendor quotas are the binding constraint on ingestion throughput. Getting backoff wrong is the fastest way to lose a feed.</p>',
        '<h2 id="buckets">Bucketing</h2>',
        '<p>Each vendor credential maps to its own token bucket. Buckets refill continuously rather than on a fixed window boundary, which avoids the thundering herd you get when every client resets at the top of the minute.</p>',
        '<table><thead><tr><th>Vendor</th><th>Sustained</th><th>Burst</th><th>Window</th></tr></thead><tbody>',
        '<tr><td><code>acme</code></td><td>120 req/s</td><td>300</td><td>rolling 1s</td></tr>',
        '<tr><td><code>northwind</code></td><td>40 req/s</td><td>80</td><td>rolling 1s</td></tr>',
        '<tr><td><code>bluepeak</code></td><td>2000 req/min</td><td>2000</td><td>rolling 60s</td></tr>',
        '</tbody></table>',
        '<p>Note that <code>bluepeak</code> has no meaningful burst headroom — its burst equals its sustained rate. A client that batches requests will exhaust the minute in seconds and then stall for the remainder.</p>',
        '<h2 id="backoff">Backoff policy</h2>',
        '<p>On <code>429</code>, honour <code>Retry-After</code> when present. When absent, use exponential backoff with full jitter:</p>',
        '<pre><code>def next_delay(attempt, base=0.2, cap=30.0):\n    ceiling = min(cap, base * (2 ** attempt))\n    return random.uniform(0, ceiling)</code></pre>',
        '<p>Full jitter matters more than the exponent. Without it, every collector that hit the limit at the same moment retries at the same moment, and the limit is hit again immediately. We have taken outages this way.</p>',
        '<div class="warn"><strong>Do not</strong>Retry a <code>429</code> on a different credential to work around the limit. Vendors detect this and the penalty is a suspension of the whole account, not the single credential.</div>',
        '<h2 id="budget">Retry budget</h2>',
        '<p>Retries are capped at 10% of successful request volume over a rolling five-minute window. Once the budget is exhausted, further failures propagate immediately instead of retrying. This bounds the damage when a vendor is genuinely down, rather than letting retry traffic amplify the outage.</p>',
        '<pre><code>md_retry_budget_remaining{vendor="acme"}  0.34\nmd_retry_budget_exhausted_total{vendor="acme"}  0</code></pre>',
        '<p>Alert on <code>md_retry_budget_remaining &lt; 0.1</code> sustained for more than two minutes. Exhaustion itself is a symptom; the cause is almost always upstream.</p>',
      ].join('\n'),
    },

    normalization: {
      crumbs: ['Docs', 'Ingestion', 'Tick normalization'],
      html: [
        '<h1>Tick normalization</h1>',
        '<p class="lede">Turning six vendor dialects into one internal representation, without losing the information that matters.</p>',
        '<h2 id="schema">Internal schema</h2>',
        '<pre><code>{\n  "instrument_id": "EQ.US.9021",\n  "event_time":    "2026-08-14T13:22:41.118934Z",\n  "ingest_time":   "2026-08-14T13:22:41.204118Z",\n  "price":         "184.2200",\n  "size":          1200,\n  "side":          "buy",\n  "conditions":    ["regular", "odd_lot"],\n  "vendor":        "acme",\n  "vendor_seq":    88213441,\n  "dedupe_key":    "3f9a1c0e7b2d4482"\n}</code></pre>',
        '<h2 id="decimals">Prices are strings</h2>',
        '<p>Prices are transported as decimal strings, never as floats. A float cannot represent most decimal prices exactly, and the error compounds across aggregation. If your consumer parses <code>price</code> into a binary float, you have reintroduced the problem the string was there to prevent.</p>',
        '<pre><code>from decimal import Decimal\n\nprice = Decimal(tick["price"])      # correct\nprice = float(tick["price"])        # silently lossy</code></pre>',
        '<h2 id="time">Two timestamps</h2>',
        '<p>Every tick carries both <code>event_time</code> (when the venue says it happened) and <code>ingest_time</code> (when we received it). They serve different purposes and are not interchangeable:</p>',
        '<ul>',
        '<li>Use <code>event_time</code> for anything analytical — bar construction, joins against other event streams, backtests.</li>',
        '<li>Use <code>ingest_time</code> for operational questions — pipeline lag, delivery gaps, replay boundaries.</li>',
        '</ul>',
        '<p>Vendor clocks drift, and a handful of venues emit <code>event_time</code> values slightly in the future. Normalization does not clamp these; it records them as received and raises <code>W2201</code> so the drift stays visible rather than being quietly masked.</p>',
        '<h2 id="conditions">Condition codes</h2>',
        '<p>Vendor condition codes are mapped to a shared vocabulary. The mapping is deliberately lossy in one direction only: unmapped vendor codes are preserved verbatim under a <code>vendor:</code> prefix rather than dropped.</p>',
        '<pre><code>"conditions": ["regular", "vendor:acme:XT"]</code></pre>',
        '<div class="note"><strong>Note</strong>Filtering logic should match on the normalized vocabulary and treat <code>vendor:*</code> entries as unknown-but-present. Treating them as absent will silently include trades that should have been excluded.</div>',
      ].join('\n'),
    },

    errors: {
      crumbs: ['Docs', 'Ingestion', 'Error codes'],
      html: [
        '<h1>Error codes</h1>',
        '<p class="lede">Stable codes for programmatic handling. Messages may change; codes do not.</p>',
        '<h2 id="fatal">Fatal (E-series)</h2>',
        '<table><thead><tr><th>Code</th><th>Meaning</th><th>Action</th></tr></thead><tbody>',
        '<tr><td><code>E1001</code></td><td>Vendor credential rejected</td><td>Re-authenticate; do not retry with the same credential</td></tr>',
        '<tr><td><code>E1004</code></td><td>Unknown instrument identifier</td><td>Refresh reference data, then retry once</td></tr>',
        '<tr><td><code>E1102</code></td><td>Decode failure — malformed frame</td><td>Route to dead letter; frame is unrecoverable</td></tr>',
        '<tr><td><code>E1140</code></td><td>Schema version unsupported</td><td>Upgrade the consumer; no runtime remedy</td></tr>',
        '<tr><td><code>E2003</code></td><td>Retry budget exhausted</td><td>Fail fast and alert; upstream is degraded</td></tr>',
        '</tbody></table>',
        '<h2 id="warn">Warnings (W-series)</h2>',
        '<table><thead><tr><th>Code</th><th>Meaning</th></tr></thead><tbody>',
        '<tr><td><code>W2201</code></td><td>Event time ahead of ingest time (vendor clock drift)</td></tr>',
        '<tr><td><code>W2210</code></td><td>Sequence gap detected; replay may be required</td></tr>',
        '<tr><td><code>W2233</code></td><td>Unmapped vendor condition code preserved verbatim</td></tr>',
        '<tr><td><code>W2240</code></td><td>Duplicate <code>dedupe_key</code> suppressed</td></tr>',
        '</tbody></table>',
        '<p>Warnings do not stop processing. A rising <code>W2210</code> rate is the earliest reliable signal of an upstream feed problem — usually several minutes before the vendor acknowledges it.</p>',
      ].join('\n'),
    },

    i18n: {
      crumbs: ['Docs', 'Platform', 'Localization & fixtures'],
      html: [
        '<h1>Localization &amp; fixtures</h1>',
        '<p class="lede">How locale bundles are structured, and how the zh-CN fixture set is used in review.</p>',
        '<p>Client-facing surfaces ship in four locales: <code>en-US</code>, <code>zh-CN</code>, <code>ja-JP</code>, and <code>de-DE</code>. Strings live in per-locale bundles keyed by a stable identifier; the identifier never contains English text, so a copy change in the source locale does not invalidate every translation.</p>',
        '<h2 id="bundles">Bundle layout</h2>',
        '<pre><code>locales/\n  en-US/\n    ingestion.json\n    errors.json\n  zh-CN/\n    ingestion.json\n    errors.json</code></pre>',
        '<h2 id="fixtures">Review fixtures</h2>',
        '<p>Every locale carries a fixture set — a flat, line-numbered list of rendered strings used for visual review. Fixtures exist because the failure mode we care about is not a missing translation (the build catches that) but a translation that renders badly: wrapping oddly, overflowing a fixed-width control, or breaking at the wrong character.</p>',
        '<p>The panel on the right of this page renders the current <code>zh-CN</code> fixture set inline. Reviewers scan it alongside the documentation rather than switching to a separate tool.</p>',
        '<div class="note"><strong>Note</strong>CJK locales need the most attention here. Line-breaking rules differ from Latin scripts, and a string that fits comfortably in <code>en-US</code> frequently does not in <code>zh-CN</code> at the same control width.</div>',
        '<h2 id="widths">Width budgets</h2>',
        '<table><thead><tr><th>Surface</th><th>Budget (en-US)</th><th>Budget (zh-CN)</th></tr></thead><tbody>',
        '<tr><td>Primary button</td><td>18 chars</td><td>8 chars</td></tr>',
        '<tr><td>Table column header</td><td>24 chars</td><td>10 chars</td></tr>',
        '<tr><td>Inline error</td><td>90 chars</td><td>42 chars</td></tr>',
        '</tbody></table>',
        '<p>Budgets are advisory, not enforced at build time. Enforcement produced more false positives than it caught real problems, because character count is a poor proxy for rendered width once mixed scripts are involved.</p>',
      ].join('\n'),
    },

    changelog: {
      crumbs: ['Docs', 'Platform', 'Changelog'],
      html: [
        '<h1>Changelog</h1>',
        '<p class="lede">Notable platform changes. Breaking changes are announced at least one minor version ahead.</p>',
        '<h2 id="v421">4.2.1 — 2026-08-14</h2>',
        '<ul>',
        '<li>Fixed a case where <code>W2210</code> sequence gaps were under-reported during collector failover.</li>',
        '<li><code>md-admin backfill</code> now resumes from the last committed checkpoint instead of restarting.</li>',
        '<li>Retry budget metrics are now exported per vendor rather than aggregated.</li>',
        '</ul>',
        '<h2 id="v420">4.2.0 — 2026-07-29</h2>',
        '<ul>',
        '<li>Unmapped vendor condition codes are preserved under a <code>vendor:</code> prefix rather than dropped.</li>',
        '<li>Token lifetime reduced from 60 to 15 minutes. Clients that refresh on 401 rather than proactively will see increased latency.</li>',
        '<li>Added <code>ja-JP</code> locale bundle and fixture set.</li>',
        '</ul>',
        '<h2 id="v414">4.1.4 — 2026-07-02</h2>',
        '<ul>',
        '<li>Prices are transported as decimal strings on all endpoints. The float representation is removed.</li>',
        '<li>Backfill jobs run on a separate queue prefix with an independent concurrency ceiling.</li>',
        '</ul>',
      ].join('\n'),
    },
  };

  var docEl = document.getElementById('doc');
  var crumbsEl = document.getElementById('crumbs');
  var tocEl = document.getElementById('toc');

  function buildToc() {
    var heads = docEl.querySelectorAll('h2[id], h3[id]');
    var html = '';
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      var cls = h.tagName === 'H3' ? ' class="lvl3"' : '';
      html += '<a href="#' + h.id + '"' + cls + '>' + h.textContent + '</a>';
    }
    tocEl.innerHTML = html;
  }

  function render(name) {
    var page = PAGES[name] || PAGES.overview;
    docEl.innerHTML = page.html;
    crumbsEl.innerHTML = page.crumbs.map(function (c) {
      return '<span>' + c + '</span>';
    }).join('');
    buildToc();

    var links = document.querySelectorAll('.side-link');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-active', links[i].getAttribute('data-page') === name);
    }
    document.documentElement.scrollTop = 0;
  }

  function current() {
    var h = location.hash.replace(/^#/, '');
    return PAGES[h] ? h : 'overview';
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('.side-link');
    if (!link) return;
    e.preventDefault();
    var name = link.getAttribute('data-page');
    if (location.hash !== '#' + name) location.hash = name;
    else render(name);
  });

  window.addEventListener('hashchange', function () {
    var h = location.hash.replace(/^#/, '');
    if (PAGES[h]) render(h);
  });

  render(current());
})();
