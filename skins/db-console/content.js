(function () {
  'use strict';

  // Supabase Studio 风格的控制台。皮肤自带，与引擎无关。
  //
  // 图标竖栏的每个入口切换一个分区：Table Editor 是主视图（表结构照搬
  // 用户真实项目 podmatrix 的 schema），其余分区是可信的静态假界面，
  // Queues 分区挂的是 farm.js 里的挂机小游戏。
  // 行数据由固定种子生成——固定种子保证每次打开数据一致，
  // 反复被瞥见时不会露出「每次都在变」的破绽。

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function hex(r, n) {
    var out = '';
    for (var i = 0; i < n; i++) out += '0123456789abcdef'[int(r, 0, 15)];
    return out;
  }
  function uuid(r) {
    return hex(r, 8) + '-' + hex(r, 4) + '-4' + hex(r, 3) + '-' + pick(r, ['8', '9', 'a', 'b']) + hex(r, 3) + '-' + hex(r, 12);
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function day(r) { return '2026-' + pad2(int(r, 3, 8)) + '-' + pad2(int(r, 1, 28)); }
  function ts(r) {
    return day(r) + ' ' + pad2(int(r, 0, 23)) + ':' + pad2(int(r, 0, 59)) + ':' + pad2(int(r, 0, 59)) + '+00';
  }
  // Supabase 存储桶地址的形状
  function st(r, path) {
    return 'https://' + hex(r, 12) + '.supabase.co/storage/v1/object/public/media/' + path;
  }

  var FIRST = ['Sarah', 'James', 'Emily', 'Liam', 'Olivia', 'Noah', 'Chloe', 'Jack', 'Mia', 'Ethan'];
  var LAST = ['Nguyen', 'Smith', 'Chen', 'Taylor', 'Brown', 'Wilson', 'Lee', 'Harris', 'Walker', 'King'];
  var SUBURBS = ['Kingston', 'Brighton', 'Sorell', 'Legana', 'Margate', 'New Norfolk', 'Penguin', 'Howrah'];
  var PROJECTS = ['Riverton Green', 'Osprey Rise', 'Clarence Quay', 'Huon Vista', 'Saltwater Mews', 'Stonebrook'];
  var HOUSE_NAMES = ['The Hartley', 'The Bowen', 'The Clyde', 'The Meehan', 'The Derwent', 'The Tamar', 'The Franklin'];
  var TRADE_CATS = ['Electrical', 'Plumbing', 'Carpentry', 'Landscaping', 'Concreting', 'Roofing', 'Tiling'];
  var TRADE_NAMES = ['Southern Sparks', 'Derwent Plumbing Co', 'Hardwood & Sons', 'Greenline Landscapes',
    'Solid Form Concreting', 'Apex Roofing TAS', 'Precision Tiling'];

  function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function email(r) {
    return (pick(r, FIRST) + '.' + pick(r, LAST) + int(r, 1, 99)).toLowerCase()
      + '@' + pick(r, ['gmail.com', 'outlook.com', 'bigpond.com', 'iinet.net.au']);
  }
  function phone(r) {
    return '04' + int(r, 10, 99) + ' ' + int(r, 100, 999) + ' ' + int(r, 100, 999);
  }

  // ---------- Table Editor 的表数据 ----------
  // 每张表：cols [{n,t}] 与 row(r,i)。row 返回的值按类型自动着色：
  // null → NULL、boolean → true/false、number → 右对齐、'[' '{' 开头 → jsonb。

  var TABLES = {
    projects: {
      seed: 11, rows: 6,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'slug', t: 'text' }, { n: 'name', t: 'text' },
        { n: 'location', t: 'text' }, { n: 'status', t: 'text' }, { n: 'project_type', t: 'text' },
        { n: 'published', t: 'bool' }, { n: 'unlisted', t: 'bool' },
        { n: 'lat', t: 'numeric' }, { n: 'lng', t: 'numeric' },
        { n: 'proximity', t: 'jsonb' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r, i) {
        var name = PROJECTS[i % PROJECTS.length];
        return [uuid(r), slugify(name), name, pick(r, SUBURBS) + ', TAS',
          pick(r, ['now-selling', 'now-selling', 'registering', 'completed', 'sold']),
          pick(r, ['residential', 'residential', 'townhouse', 'apartment']),
          r() < 0.8, r() < 0.15,
          -(42 + r() * 1.5).toFixed(6) * 1, (147 + r() * 1.4).toFixed(6) * 1,
          '[{"label":"' + pick(r, ['Schools', 'Beach', 'CBD']) + '","mins":' + int(r, 3, 25) + '}, …]',
          ts(r)];
      },
    },
    properties: {
      seed: 23, rows: 34,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'project_id', t: 'uuid' }, { n: 'lot', t: 'text' },
        { n: 'name', t: 'text' }, { n: 'status', t: 'text' }, { n: 'type', t: 'text' },
        { n: 'price', t: 'int4' }, { n: 'bedrooms', t: 'int4' }, { n: 'bathrooms', t: 'float4' },
        { n: 'car_spaces', t: 'int4' }, { n: 'land_size', t: 'int4' },
        { n: 'floorplan_size', t: 'float4' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r, i) {
        return [uuid(r), uuid(r), 'Lot ' + (100 + i * int(r, 1, 3)),
          pick(r, HOUSE_NAMES),
          pick(r, ['available', 'available', 'available', 'under-contract', 'sold', 'display-home']),
          pick(r, ['single-storey', 'single-storey', 'double-storey', 'townhouse', 'apartment']),
          r() < 0.12 ? null : int(r, 480, 1150) * 1000,
          int(r, 2, 5), pick(r, [1, 2, 2, 2.5, 3]), int(r, 1, 2),
          int(r, 320, 780), int(r, 140, 265) + 0.0, ts(r)];
      },
    },
    enquiries: {
      seed: 37, rows: 28,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'project_id', t: 'uuid' },
        { n: 'first_name', t: 'text' }, { n: 'last_name', t: 'text' },
        { n: 'email', t: 'text' }, { n: 'phone', t: 'text' },
        { n: 'interest', t: 'text' }, { n: 'source', t: 'text' },
        { n: 'read', t: 'bool' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r) {
        return [uuid(r), uuid(r), pick(r, FIRST), pick(r, LAST), email(r),
          r() < 0.25 ? null : phone(r),
          pick(r, ['House & Land', 'Townhouse', 'Investment', 'First home', 'Downsizing']),
          pick(r, ['homepage', 'property-detail', 'property-detail']),
          r() < 0.6, ts(r)];
      },
    },
    lifestyle: {
      seed: 41, rows: 22,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'project_id', t: 'uuid' }, { n: 'section', t: 'text' },
        { n: 'card', t: 'text' }, { n: 'rating', t: 'int4' }, { n: 'sort_order', t: 'int4' },
        { n: 'image_url', t: 'text' },
      ],
      row: function (r, i) {
        var section = pick(r, ['Education', 'Recreation', 'Shopping', 'Transport']);
        return [uuid(r), uuid(r), section,
          pick(r, ['Primary school', 'Foreshore trail', 'Village green', 'Bus interchange',
            'District sports hub', 'Weekend markets']),
          r() < 0.3 ? null : int(r, 3, 5), i % 6,
          r() < 0.2 ? null : st(r, 'lifestyle/' + slugify(section) + '-' + int(r, 1, 9) + '.jpg')];
      },
    },
    homepage_hero: {
      seed: 43, rows: 1,
      cols: [
        { n: 'id', t: 'text' }, { n: 'eyebrow_text', t: 'text' },
        { n: 'headline_1', t: 'text' }, { n: 'headline_2', t: 'text' },
        { n: 'subheadline', t: 'text' }, { n: 'cta_1_text', t: 'text' },
        { n: 'cta_1_href', t: 'text' }, { n: 'cta_2_text', t: 'text' },
      ],
      row: function () {
        return ['default', 'PODMATRIX DEVELOPMENTS', 'Building better', 'places to live',
          'Master-planned communities across southern Tasmania.',
          'Explore projects', '/projects', 'Get in touch'];
      },
    },
    homepage_intro: {
      seed: 47, rows: 1,
      cols: [
        { n: 'id', t: 'text' }, { n: 'heading_1', t: 'text' }, { n: 'heading_2', t: 'text' },
        { n: 'heading_3', t: 'text' }, { n: 'para_1', t: 'text' }, { n: 'bg_image_urls', t: '_text' },
      ],
      row: function (r) {
        return ['default', 'Considered.', 'Crafted.', 'Delivered.',
          'Every Podmatrix community starts with the land — its aspect, its fall, its outlook…',
          '{' + st(r, 'intro/bg-01.jpg') + ',…}'];
      },
    },
    homepage_partners: {
      seed: 53, rows: 8,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'name', t: 'text' }, { n: 'logo_url', t: 'text' },
        { n: 'href', t: 'text' }, { n: 'sort_order', t: 'int4' }, { n: 'display_on_homepage', t: 'bool' },
      ],
      row: function (r, i) {
        var name = pick(r, ['Meridian Homes', 'Tas Oak Builders', 'Coastline Constructions',
          'Ashford Building Group', 'Summit Residential']);
        return [uuid(r), name, st(r, 'partners/' + slugify(name) + '.svg'),
          r() < 0.4 ? null : 'https://' + slugify(name) + '.com.au', i, r() < 0.85];
      },
    },
    homepage_services: {
      seed: 59, rows: 4,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'number', t: 'text' }, { n: 'title', t: 'text' },
        { n: 'body', t: 'text' }, { n: 'sort_order', t: 'int4' },
      ],
      row: function (r, i) {
        var svc = [
          ['01', 'Land acquisition', 'Sourcing and securing development-ready land…'],
          ['02', 'Design & planning', 'Architecture, engineering and approvals managed in-house…'],
          ['03', 'Construction', 'Delivery through our vetted builder network…'],
          ['04', 'Sales & settlement', 'From first enquiry to keys in hand…'],
        ][i];
        return [uuid(r), svc[0], svc[1], svc[2], i];
      },
    },
    homepage_team: {
      seed: 61, rows: 6,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'name', t: 'text' }, { n: 'role', t: 'text' },
        { n: 'photo_url', t: 'text' }, { n: 'sort_order', t: 'int4' },
      ],
      row: function (r, i) {
        var name = pick(r, FIRST) + ' ' + pick(r, LAST);
        return [uuid(r), name,
          pick(r, ['Managing Director', 'Sales Manager', 'Project Manager', 'Development Manager', 'Marketing Lead']),
          st(r, 'team/' + slugify(name) + '.jpg'), i];
      },
    },
    trades: {
      seed: 67, rows: 14,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'slug', t: 'text' }, { n: 'name', t: 'text' },
        { n: 'category', t: 'text' }, { n: 'lead_email', t: 'text' }, { n: 'phone', t: 'text' },
        { n: 'insurance_verified', t: 'bool' }, { n: 'partner_since', t: 'int4' },
        { n: 'published', t: 'bool' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r, i) {
        var name = TRADE_NAMES[i % TRADE_NAMES.length];
        return [uuid(r), slugify(name) + (i >= TRADE_NAMES.length ? '-' + int(r, 2, 9) : ''), name,
          TRADE_CATS[i % TRADE_CATS.length], 'leads@' + slugify(name) + '.com.au',
          r() < 0.2 ? null : phone(r), r() < 0.75, r() < 0.3 ? null : int(r, 2015, 2025),
          r() < 0.7, ts(r)];
      },
    },
    trade_projects: {
      seed: 71, rows: 18,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'trade_id', t: 'uuid' }, { n: 'project_id', t: 'uuid' },
        { n: 'role', t: 'text' }, { n: 'sort_order', t: 'int4' },
      ],
      row: function (r, i) {
        return [uuid(r), uuid(r), uuid(r),
          pick(r, ['Stage 1 electrical', 'Civil works', 'Frame & truss', 'Streetscape planting', 'Driveways']),
          i % 5];
      },
    },
    trade_enquiries: {
      seed: 73, rows: 16,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'trade_id', t: 'uuid' }, { n: 'trade_name', t: 'text' },
        { n: 'first_name', t: 'text' }, { n: 'last_name', t: 'text' },
        { n: 'email', t: 'text' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r, i) {
        return [uuid(r), r() < 0.15 ? null : uuid(r), TRADE_NAMES[i % TRADE_NAMES.length],
          pick(r, FIRST), pick(r, LAST), email(r), ts(r)];
      },
    },
    commercial_spaces: {
      seed: 79, rows: 9,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'project_id', t: 'uuid' }, { n: 'name', t: 'text' },
        { n: 'size_m2', t: 'numeric' }, { n: 'price', t: 'numeric' }, { n: 'status', t: 'text' },
        { n: 'sort_order', t: 'int4' }, { n: 'created_at', t: 'timestamptz' },
      ],
      row: function (r, i) {
        return [uuid(r), uuid(r), 'Tenancy ' + String.fromCharCode(65 + (i % 6)) + int(r, 1, 3),
          int(r, 65, 420), r() < 0.3 ? null : int(r, 390, 1800) * 1000,
          pick(r, ['available', 'available', 'leased', 'under-offer']), i, ts(r)];
      },
    },
    rate_limits: {
      seed: 83, rows: 7,
      cols: [
        { n: 'key', t: 'text' }, { n: 'count', t: 'int4' }, { n: 'window_start', t: 'timestamptz' },
      ],
      row: function (r) {
        return ['enquiry:' + int(r, 100, 220) + '.' + int(r, 10, 250) + '.' + int(r, 10, 250) + '.' + int(r, 2, 250),
          int(r, 1, 5), ts(r)];
      },
    },
    trade_showcase_projects: {
      seed: 89, rows: 12,
      cols: [
        { n: 'id', t: 'uuid' }, { n: 'trade_id', t: 'uuid' }, { n: 'title', t: 'text' },
        { n: 'completed_year', t: 'int4' }, { n: 'completed_month', t: 'int4' },
        { n: 'images', t: 'jsonb' }, { n: 'sort_order', t: 'int4' },
      ],
      row: function (r, i) {
        return [uuid(r), uuid(r),
          pick(r, PROJECTS) + ' — ' + pick(r, ['stage 2', 'display village', 'clubhouse', 'stage 1 civils']),
          int(r, 2021, 2026), r() < 0.25 ? null : int(r, 1, 12),
          '["' + st(r, 'showcase/' + hex(r, 6) + '.jpg') + '", …]', i % 4];
      },
    },
  };

  var ORDER = ['projects', 'properties', 'enquiries', 'lifestyle', 'homepage_hero', 'homepage_intro',
    'homepage_partners', 'homepage_services', 'homepage_team', 'trades', 'trade_projects',
    'trade_enquiries', 'commercial_spaces', 'rate_limits', 'trade_showcase_projects'];

  // ---------- 通用渲染 ----------

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cellHtml(v) {
    if (v === null || v === undefined) return '<td class="null">NULL</td>';
    if (typeof v === 'boolean') return '<td class="' + (v ? 'bool-t' : 'bool-f') + '">' + v + '</td>';
    if (typeof v === 'number') return '<td class="num">' + v + '</td>';
    var s = String(v);
    var cls = (s.charAt(0) === '[' || s.charAt(0) === '{') ? ' class="jsonb"' : '';
    return '<td' + cls + '>' + esc(s) + '</td>';
  }

  function renderGrid(tbl) {
    var r = rng(tbl.seed);
    var head = '<tr>' + tbl.cols.map(function (c) {
      return '<th>' + esc(c.n) + '<span class="typ">' + esc(c.t) + '</span></th>';
    }).join('') + '</tr>';
    var rows = [];
    for (var i = 0; i < tbl.rows; i++) {
      rows.push('<tr>' + tbl.row(r, i).map(cellHtml).join('') + '</tr>');
    }
    return head + rows.join('');
  }

  // 简单的静态网格（其余分区用）：rows 是二维数组，第一行当表头。
  function staticGrid(cols, rows) {
    return '<tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>'
      + rows.map(function (row) {
        return '<tr>' + row.map(cellHtml).join('') + '</tr>';
      }).join('');
  }

  function menuHtml(title, items, active) {
    return '<div class="side-head">' + esc(title) + '</div><div class="side-list">'
      + items.map(function (it) {
        return '<a class="sm-item' + (it === active ? ' is-active' : '') + '">' + esc(it) + '</a>';
      }).join('') + '</div>';
  }

  function shellMain(toolbar, body, status) {
    return '<div class="toolbar">' + toolbar + '</div>'
      + '<div class="grid-wrap">' + body + '</div>'
      + '<footer class="statusline">' + status + '<span class="role">role: postgres</span></footer>';
  }

  function projectFacts() {
    return '<div class="col"><span>region</span><span class="typ">ap-southeast-2</span></div>'
      + '<div class="col"><span>postgres</span><span class="typ">15.8</span></div>'
      + '<div class="col"><span>plan</span><span class="typ">free</span></div>'
      + '<div class="col"><span>ref</span><span class="typ">kfjqwzlxvbnm</span></div>';
  }

  // ---------- 各分区 ----------

  var currentTable = 'projects';

  function tableSide() {
    return '<div class="side-head">Table Editor</div>'
      + '<label class="search"><input type="text" placeholder="Search tables..." spellcheck="false" aria-label="Search tables"></label>'
      + '<div class="side-schema">schema <span>public</span></div>'
      + '<div class="side-list">' + ORDER.map(function (n) {
        return '<a class="tbl' + (n === currentTable ? ' is-active' : '') + '" data-obj="' + n + '">' + n + '</a>';
      }).join('') + '</div>';
  }

  function showTable(name, opts) {
    var tbl = TABLES[name];
    if (!tbl) return;
    currentTable = name;
    var ms = (opts && opts.rerun) ? int(rng(Date.now() >>> 0), 40, 420) : 60 + tbl.seed * 2;
    $('main').innerHTML = shellMain(
      '<span class="tname">' + esc(name) + '</span>'
      + '<button class="btn btn-primary">Insert</button><button class="btn">Filter</button>'
      + '<button class="btn">Sort</button><span class="toolbar-gap"></span>'
      + '<button class="btn" id="refresh">&#8635; Refresh</button>'
      + '<span class="rt">Realtime <span class="rt-off">off</span></span>',
      '<table class="grid">' + renderGrid(tbl) + '</table>',
      '<span>' + tbl.rows + ' rows</span><span>fetched in ' + ms + ' ms</span>'
    );
    $('rail-label').textContent = 'Definition';
    $('definition').innerHTML = tbl.cols.map(function (c) {
      return '<div class="col"><span>' + esc(c.n) + '</span><span class="typ">' + esc(c.t) + '</span></div>';
    }).join('');
    var links = document.querySelectorAll('.tbl');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-active', links[i].getAttribute('data-obj') === name);
    }
    persist();
  }

  var SECTIONS = {
    home: {
      side: function () {
        return menuHtml('Project', ['Overview', 'Logs', 'Reports', 'Advisors'], 'Overview');
      },
      main: function () {
        var r = rng(7);
        var cards = [
          ['Database', '418 MB', 'of 500 MB'],
          ['API requests', '12,408', 'last 24h'],
          ['Storage', '1.9 GB', 'of 5 GB'],
          ['Auth users', '2,341', '+' + int(r, 3, 30) + ' this week'],
        ].map(function (c) {
          return '<div class="ov-card"><span class="ov-label">' + c[0] + '</span>'
            + '<span class="ov-value">' + c[1] + '</span><span class="ov-sub">' + c[2] + '</span></div>';
        }).join('');
        var migs = [
          ['20260828113042', 'add_media_collection', ts(r)],
          ['20260814090211', 'add_plan_kind', ts(r)],
          ['20260802141530', 'add_house_types_selector', ts(r)],
          ['20260719063355', 'trade_showcase_projects', ts(r)],
          ['20260703110248', 'add_selector_bg_dim', ts(r)],
        ];
        return '<div class="toolbar"><span class="tname">overview</span></div>'
          + '<div class="grid-wrap"><div class="ov-cards">' + cards + '</div>'
          + '<div class="ov-block"><div class="rail-label">Recent migrations</div>'
          + '<table class="grid">' + staticGrid(['version', 'name', 'applied_at'], migs) + '</table></div></div>'
          + '<footer class="statusline"><span>all systems operational</span><span class="role">role: postgres</span></footer>';
      },
    },
    tables: {
      side: tableSide,
      main: function () { return ''; },   // showTable 负责填充
      after: function () { showTable(currentTable); },
    },
    sql: {
      side: function () {
        return menuHtml('SQL Editor',
          ['unread_enquiries.sql', 'sold_by_project.sql', 'trade_leads.sql', 'scratch.sql'],
          'unread_enquiries.sql');
      },
      main: function () {
        var sql = '<span class="kw">select</span> e.first_name, e.last_name, e.email, e.interest, p.name <span class="kw">as</span> project\n'
          + '<span class="kw">from</span> enquiries e <span class="kw">join</span> projects p <span class="kw">on</span> p.id = e.project_id\n'
          + '<span class="kw">where</span> e.read = <span class="kw">false</span>\n'
          + '<span class="kw">order by</span> e.created_at <span class="kw">desc</span>;';
        return '<div class="toolbar"><span class="tname">unread_enquiries.sql</span>'
          + '<span class="toolbar-gap"></span>'
          + '<button class="btn btn-primary" id="run">&#9655; Run</button><span class="qlimit">LIMIT 500</span></div>'
          + '<pre class="sql" contenteditable="true" spellcheck="false">' + sql + '</pre>'
          + '<div class="grid-wrap"><table class="grid" id="sql-grid">' + renderGrid(TABLES.enquiries) + '</table></div>'
          + '<footer class="statusline" id="sql-status"><span>' + TABLES.enquiries.rows + ' rows</span>'
          + '<span>fetched in 134 ms</span><span class="role">role: postgres</span></footer>';
      },
    },
    database: {
      side: function () {
        return menuHtml('Database', ['Tables', 'Functions', 'Triggers', 'Extensions', 'Roles', 'Backups'], 'Tables');
      },
      main: function () {
        var r = rng(13);
        var rows = ORDER.map(function (n) {
          var est = TABLES[n].rows * int(r, 20, 60);
          return [n, est, (est * int(r, 2, 9) / 1000).toFixed(1) + ' MB', 'public'];
        });
        return shellMain('<span class="tname">tables</span>',
          '<table class="grid">' + staticGrid(['name', 'rows (est)', 'size', 'schema'], rows) + '</table>',
          '<span>' + ORDER.length + ' tables</span>');
      },
    },
    auth: {
      side: function () {
        return menuHtml('Authentication', ['Users', 'Policies', 'Providers', 'Email Templates', 'Rate Limits'], 'Users');
      },
      main: function () {
        var r = rng(17);
        var rows = [];
        for (var i = 0; i < 24; i++) {
          rows.push([uuid(r), email(r), pick(r, ['email', 'email', 'google']), ts(r),
            r() < 0.2 ? null : ts(r)]);
        }
        return shellMain('<span class="tname">users</span>'
          + '<button class="btn btn-primary">Add user</button>',
          '<table class="grid">' + staticGrid(['uid', 'email', 'provider', 'created_at', 'last_sign_in_at'], rows) + '</table>',
          '<span>2,341 users</span><span>showing 24</span>');
      },
    },
    storage: {
      side: function () {
        return menuHtml('Storage', ['media (public)', 'floorplans (public)', 'documents (private)'], 'media (public)');
      },
      main: function () {
        var r = rng(19);
        var rows = [];
        for (var i = 0; i < 20; i++) {
          var proj = slugify(pick(r, PROJECTS));
          rows.push([proj + '/' + pick(r, ['hero', 'gallery', 'lifestyle', 'team']) + '-' + pad2(int(r, 1, 40)) + '.jpg',
            int(r, 120, 4200) + ' KB', 'image/jpeg', ts(r)]);
        }
        return shellMain('<span class="tname">media</span>'
          + '<button class="btn btn-primary">Upload</button><button class="btn">New folder</button>',
          '<table class="grid">' + staticGrid(['name', 'size', 'type', 'created_at'], rows) + '</table>',
          '<span>1,204 objects</span><span>1.9 GB</span>');
      },
    },
    queues: {
      // 农场。side/main 都交给 farm.js 填充与接管。
      side: function () { return ''; },
      main: function () { return ''; },
      after: function () { if (window.DBFarm) window.DBFarm.mount($('main'), $('side')); },
    },
    settings: {
      side: function () {
        return menuHtml('Project Settings', ['General', 'API', 'Database', 'Auth', 'Billing'], 'General');
      },
      main: function () {
        var rows = [
          ['Project name', 'podmatrix'], ['Reference ID', 'kfjqwzlxvbnm'],
          ['Region', 'ap-southeast-2 (Sydney)'], ['Postgres version', '15.8'],
          ['Instance size', 'micro'], ['Point-in-time recovery', 'disabled'],
        ];
        return shellMain('<span class="tname">general</span>',
          '<table class="grid">' + staticGrid(['setting', 'value'], rows) + '</table>',
          '<span>read-only in this session</span>');
      },
    },
  };

  var currentSection = 'tables';

  // ---------- 状态持久化（记住停在哪个分区、哪张表） ----------

  var UI_KEY = 'dbconsole.ui.v1';

  function persist() {
    try { localStorage.setItem(UI_KEY, JSON.stringify({ sec: currentSection, tbl: currentTable })); } catch (e) {}
  }

  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(UI_KEY));
      if (s && SECTIONS[s.sec]) currentSection = s.sec;
      if (s && TABLES[s.tbl]) currentTable = s.tbl;
    } catch (e) {}
  }

  // ---------- 分区切换 ----------

  function activate(sec) {
    var s = SECTIONS[sec];
    if (!s) return;
    if (currentSection === 'queues' && sec !== 'queues' && window.DBFarm) window.DBFarm.unmount();
    currentSection = sec;

    var icons = document.querySelectorAll('.ic');
    for (var i = 0; i < icons.length; i++) {
      icons[i].classList.toggle('is-active', icons[i].getAttribute('data-sec') === sec);
    }

    $('side').innerHTML = s.side();
    $('main').innerHTML = s.main();
    if (sec !== 'tables') {
      $('rail-label').textContent = 'Project';
      $('definition').innerHTML = projectFacts();
    }
    if (s.after) s.after();
    persist();
  }

  // ---------- 事件 ----------

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var ic = e.target.closest('.ic[data-sec]');
    if (ic) { activate(ic.getAttribute('data-sec')); return; }

    var tbl = e.target.closest('.tbl[data-obj]');
    if (tbl) { showTable(tbl.getAttribute('data-obj')); return; }

    var mi = e.target.closest('.sm-item');
    if (mi) {
      // 二级菜单只做高亮，不切内容——静态假界面，点起来手感对就够了。
      var sibs = mi.parentElement.querySelectorAll('.sm-item');
      for (var i = 0; i < sibs.length; i++) sibs[i].classList.remove('is-active');
      mi.classList.add('is-active');
      return;
    }

    if (e.target.id === 'refresh') { showTable(currentTable, { rerun: true }); return; }
    if (e.target.id === 'run') {
      var st1 = $('sql-status');
      if (st1) {
        st1.innerHTML = '<span>' + TABLES.enquiries.rows + ' rows</span><span>fetched in '
          + int(rng(Date.now() >>> 0), 40, 420) + ' ms</span><span class="role">role: postgres</span>';
      }
    }
  });

  restore();
  activate(currentSection);
})();
