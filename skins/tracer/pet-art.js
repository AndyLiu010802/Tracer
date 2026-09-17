(function (root, factory) {
  const art = factory();
  if (typeof module === 'object' && module.exports) module.exports = art;
  else root.TracerPetArt = art;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const p = (fill, d, cls = '') => '<path' + (cls ? ' class="' + cls + '"' : '') + ' fill="' + fill + '" d="' + d + '"/>';
  const g = (name, x, y, body, extra = '') => '<g class="rig-part rig-' + name + (extra ? ' ' + extra : '') + '" style="transform-origin:' + x + 'px ' + y + 'px">' + body + '</g>';
  const eyes = (open, closed) => g('eyes', 80, 71, p('#35404a', open)) + '<g class="rig-eyes-closed">' + p('#35404a', closed) + '</g>';
  const specs = {
    sprout: { species: 'cloud-sheep', name: 'Sprout', signature: 'patient-gardener' },
    miso: { species: 'ginger-cat', name: 'Miso', signature: 'playful-food-critic' },
    brook: { species: 'penguin', name: 'Brook', signature: 'earnest-mapmaker' },
    ember: { species: 'fox', name: 'Ember', signature: 'bold-scout' },
    luna: { species: 'moon-rabbit', name: 'Luna', signature: 'quiet-moonwatcher' },
    nova: { species: 'starlight-dragon', name: 'Nova', signature: 'apprentice-inventor' }
  };
  function sprout() {
    return g('leg-left', 62, 120, p('#60776b', 'M55 114h15v24H53v-8h2z') + p('#d2dac6', 'M55 115h14v12H55z')) +
      g('leg-right', 97, 120, p('#60776b', 'M90 115h15v15h3v8H90z') + p('#d2dac6', 'M90 115h14v12H90z')) +
      g('body', 80, 124, p('#b3c7b2', 'M42 72h18V62h40v7h18v10h10v30h-8v13h-17v8H57v-8H40v-13H32V84h10z') +
        p('#eee9d5', 'M44 75h16V66h37v7h18v11h9v22h-9v13H99v7H60v-8H43v-12h-7V87h8z') +
        p('#faf5e2', 'M44 87h17v14H44zM70 77h22v16H70zM98 87h16v15H98zM60 104h21v15H60z') + p('#d8ddc7', 'M87 108h14v12H87z')) +
      g('arm-left', 48, 88, p('#bdcdb6', 'M37 84h15v26H36v-9h-4V90h5z') + p('#f3eed9', 'M37 86h12v19H36z') + p('#708575', 'M38 107h10v6H38z')) +
      g('arm-right', 112, 88, p('#bdcdb6', 'M109 84h15v8h5v13h-5v8h-16z') + p('#f3eed9', 'M112 86h11v20h-11z') + p('#708575', 'M111 108h11v6h-11z')) +
      g('head', 80, 77,
        g('ear-left', 53, 54, p('#9db89e', 'M48 48H29v7h-6v13h9v5h13V62h8z') + p('#d4dabb', 'M29 53h16v11H29z')) +
        g('ear-right', 108, 54, p('#9db89e', 'M108 48h21v7h7v13h-9v5h-14V62h-5z') + p('#d4dabb', 'M115 53h15v11h-15z')) +
        p('#b7cbb4', 'M54 37h52v8h10v30h-8v15H55V78H44V48h10z') + p('#e5e7cf', 'M57 44h47v7h8v26h-12v10H61V76H49V52h8z') +
        p('#faf4df', 'M49 35h12v-8h17v5h11v-7h15v10h11v17h-13v-9H61v10H47z') +
        eyes('M61 60h6v9h-6zM93 60h6v9h-6z', 'M58 66h13v3H58zM90 66h13v3H90z') +
        g('mouth', 80, 79, p('#897465', 'M76 73h8v5h-8zM78 80h4v3h-4z')) + p('#dbb6ac', 'M54 71h10v4H54zM98 71h10v4H98z') +
        g('leaf', 81, 35, p('#5d8460', 'M78 13h5v23h-5z') + p('#8eaf69', 'M63 12h14v5h5v8H71v-5h-8zM84 5h15v10h-6v6h-10v-8h1z') + p('#b8cb87', 'M86 7h10v4H86z'))) +
      g('soil-pat', 112, 135, p('#b79565', 'M102 135h17v4h-17zM120 132h4v4h-4zM98 131h3v3h-3z'));
  }
  function miso() {
    return g('tail', 108, 116,
      '<g class="rig-tail-relaxed">' + p('#ad6c45', 'M103 112h17V99h9V78h-7V62h9v5h8v33h-7v18h-13v7h-17z') + p('#e1a65e', 'M112 113h12V99h9V77h-7V64h5v8h5v26h-7v17h-14v6h-11v-5h8z') + p('#7c5140', 'M129 86h10v6h-10zM120 104h11v6h-11z') + '</g>' +
      '<g class="rig-tail-curled">' + p('#ad6c45', 'M107 110h20V88h-13v-9h20v7h7v30h-12v9h-22z') + p('#efbd76', 'M110 115h21V91h-12v-8h14v6h5v23h-10v10h-18z') + '</g>') +
      g('leg-left', 66, 124, p('#b77c4c', 'M55 118h25v20H48v-9h7z') + p('#f6d6a0', 'M50 129h22v6H50z')) +
      g('leg-right', 94, 124, p('#b77c4c', 'M85 117h21v13h7v8H84z') + p('#f6d6a0', 'M91 129h20v6H91z')) +
      g('body', 81, 129, p('#c9874f', 'M64 77h34v10h11v39H54V93h10z') + p('#edb673', 'M65 82h30v8h11v34H57V95h8z') +
        p('#f6d7a3', 'M69 87h22v39H66V101h3z') + p('#a96e43', 'M57 99h10v5H57zM98 103h10v6H98zM57 114h9v5h-9z')) +
      g('arm-left', 62, 91, p('#bd804c', 'M54 87h15v42H55v-9h-5V98h4z') + p('#f6d7a3', 'M54 120h15v12H53z') + p('#865d44', 'M55 105h13v5H55z')) +
      g('arm-right', 100, 91, p('#bd804c', 'M93 87h15v13h5v26H99v-20h-6z') + p('#f6d7a3', 'M99 118h15v12H99z') + p('#865d44', 'M99 103h13v5H99z')) +
      g('head', 80, 81,
        g('ear-left', 54, 47, p('#b27648', 'M40 50V20h8v6h8v8h12v16z') + p('#e7b3a0', 'M45 29h6v10h7v9H45z')) +
        g('ear-right', 105, 47, p('#b27648', 'M92 49V35h13v-8h8v-8h7v32z') + p('#e7b3a0', 'M107 35h6v-6h3v19h-13v-9h4z')) +
        p('#cb8b51', 'M46 42h67v10h9v27h-10v12H50V82H39V55h7z') + p('#efbd7a', 'M49 46h60v11h9v18h-10v12H53V79H44V58h5z') +
        p('#a66b43', 'M69 44h6v13h-6zM82 44h6v10h-6zM95 45h5v12h-5zM43 64h9v4h-9zM109 66h10v4h-10z') +
        eyes('M56 62h15v4H56zM90 62h15v4H90zM62 64h5v7h-5zM95 64h5v7h-5z', 'M56 66h15v3H56zM90 66h15v3H90z') +
        p('#f8dfb2', 'M66 75h28v10H66z') + g('mouth', 80, 79, p('#976356', 'M77 72h7v5h-7zM79 78h3v4h-3zM73 82h7v3h-7zM82 82h7v3h-7z')) +
        g('tongue', 84, 83, p('#dc9a9d', 'M80 80h8v7h-8z')) + p('#8c6c51', 'M36 76h17v2H36zM110 76h17v2h-17z'));
  }
  function brook() {
    return g('leg-left', 64, 128, p('#cc9559', 'M56 122h17v11h4v9H43v-7h7v-5h6z') + p('#edbf78', 'M49 134h24v5H49z')) +
      g('leg-right', 94, 128, p('#cc9559', 'M86 123h17v8h9v5h6v7H83v-10h3z') + p('#edbf78', 'M87 135h26v5H87z')) +
      g('arm-left', 55, 70, p('#385b74', 'M50 65h11v26h-5v16H45v7H35V99h5V78h10z') + p('#5e90a6', 'M48 77h8v14h-5v17h-9V96h3V82h3z'), 'rig-flipper-left') +
      g('arm-right', 106, 70, p('#385b74', 'M102 64h13v15h8v21h7v12h-12v-8h-8V91h-8z') + p('#5e90a6', 'M108 73h6v14h7v18h-5V95h-8z'), 'rig-flipper-right') +
      g('body', 81, 130, p('#416981', 'M56 50h48v18h9v44h-6v18H55v-14h-8V74h9z') + p('#77aebe', 'M58 55h44v22h6v32h-7v17H60v-15h-8V78h6z') +
        p('#ecebdd', 'M66 77h27v9h9v35H58V89h8z') + p('#d9ddcf', 'M61 110h6v13h-6zM96 105h6v15h-6z')) +
      g('head', 80, 59, p('#3d637c', 'M62 25h34v7h10v30H97v11H62V64H53V36h9z') + p('#83b9c7', 'M64 28h29v8h10v24H96v8H63V60h-7V38h8z') +
        p('#edece0', 'M61 43h13v19H60zM87 43h14v19H87z') + eyes('M64 46h6v10h-6zM91 46h6v10h-6z', 'M61 52h13v3H61zM87 52h14v3H87z') +
        g('mouth', 81, 62, p('#c78b50', 'M72 58h18v5h6v6H68v-6h4z') + p('#efc278', 'M74 60h14v4H74z'))) +
      g('map', 105, 109, p('#567f80', 'M98 96h12v29H95v-21h3z') + p('#e4d7ae', 'M98 97h8v17h-8z') + p('#94ac8a', 'M100 101h4v8h-4z')) +
      g('pebbles', 125, 138, p('#839aa1', 'M119 136h7v5h-7zM130 132h6v9h-6zM141 135h7v6h-7z') + p('#c3d5cc', 'M120 136h4v2h-4zM131 132h3v3h-3zM142 135h4v2h-4z'));
  }
  function ember() {
    return g('tail', 52, 108, p('#aa5342', 'M51 120H33v-8H20V99H10V78H5V52h10v9h17v8h13v14h13v25h-7z') +
      p('#df8156', 'M48 114H35v-8H25V94H15V76h-6V58h7v8h16v8h10v14h12v18h-6z') + p('#f4dbb5', 'M5 52h10v9h17v8h-7v10H14V73H8V64H5z')) +
      g('leg-left', 60, 111, p('#aa5747', 'M47 105h18v18h-6v14H43v-8h7v-12h-3z') + p('#62504d', 'M43 130h16v8H43z')) +
      g('leg-right', 81, 114, p('#aa5747', 'M73 108h15v24h6v7H74v-10h-1z') + p('#62504d', 'M74 132h20v7H74z')) +
      g('body', 87, 117, p('#b45c46', 'M47 83h39V75h25v17h7v24h-16v8H54v-8H43V94h4z') + p('#e99868', 'M52 87h36v-7h19v15h7v16h-14v9H57v-9H48V97h4z') + p('#f4d8ad', 'M93 94h20v17h-12v8H85v-10h8z')) +
      g('arm-left', 106, 107, p('#bb654b', 'M99 102h14v23h-4v13H94v-8h5z') + p('#63504c', 'M94 132h15v7H94z')) +
      g('arm-right', 120, 104, p('#bf6b4e', 'M114 98h15v29h7v11h-21v-9h-1z') + p('#63504c', 'M116 131h20v8h-20z')) +
      g('head', 108, 83,
        g('ear-left', 97, 48, p('#a24c41', 'M87 51V18h7v8h8v9h9v20z') + p('#e5afa0', 'M91 29h4v9h7v11H91z')) +
        g('ear-right', 125, 45, p('#a24c41', 'M113 50V29h7V17h7v15h8v22z') + p('#e5afa0', 'M120 29h5v14h5v8h-13V38h3z')) +
        p('#bd6148', 'M93 39h31v9h13v11h8v9h8v11h-13v8h-22v9h-20V84H86V56h7z') + p('#e99562', 'M96 44h24v8h12v10h8v10h9v5h-13v7h-19v8h-15V80H91V58h5z') +
        p('#f5ddb9', 'M116 68h25v5h9v6h-13v6h-20v7h-15V82h10v-8h4z') + eyes('M115 57h7v9h-7zM97 56h5v7h-5z', 'M112 62h13v3h-13zM94 61h10v3H94z') +
        g('mouth', 139, 76, p('#4d4141', 'M145 68h9v7h-9zM134 80h10v3h-10z')));
  }
  function luna() {
    return g('tail', 114, 116, p('#a593c4', 'M111 103h15v7h6v15h-7v6h-17v-9h-5v-12h8z') + p('#e4d9ed', 'M113 106h11v7h5v9h-7v5h-12v-11h-4v-5h7z')) +
      g('leg-left', 61, 120, p('#a190c0', 'M47 107h22v21h9v13H38v-12h5v-16h4z') + p('#dbcfe7', 'M43 130h29v8H43z')) +
      g('leg-right', 98, 123, p('#a190c0', 'M92 108h18v13h8v11h6v9H86v-13h6z') + p('#dbcfe7', 'M91 131h27v7H91z')) +
      g('body', 81, 128, p('#aa96c4', 'M65 80h34v13h9v32H53V103h7V88h5z') + p('#cebee0', 'M66 84h29v12h10v25H57v-16h7V92h2z') + p('#e9dfed', 'M71 92h18v11h6v22H66v-23h5z')) +
      g('arm-left', 61, 93, p('#b5a2cf', 'M54 91h14v22h6v15H56v-14h-5V99h3z') + p('#e4d8e9', 'M57 118h15v11H57z')) +
      g('arm-right', 99, 93, p('#b5a2cf', 'M94 90h13v10h4v15h-5v14H89v-12h6z') + p('#e4d8e9', 'M92 118h14v11H92z')) +
      g('head', 81, 85,
        g('ear-left', 62, 61, p('#ac98c6', 'M50 61V17h6V8h13v9h5v39h-6v11z') + p('#d7c7e3', 'M55 19h13v36H55z') + p('#deaabf', 'M59 19h6v32h-6z')) +
        g('ear-right', 99, 61, p('#ac98c6', 'M89 61V23h6V3h13v10h8v17h-7v35z') + p('#d7c7e3', 'M95 25h6V7h6v11h5v9h-8v33h-9z') + p('#deaabf', 'M98 27h5v26h-5zM101 13h4v12h-4z')) +
        p('#b29dca', 'M58 51h45v9h12v24h-8v12H55V85H46V64h12z') + p('#d4c5e2', 'M61 55h40v10h11v15h-8v12H58V82H50V66h11z') +
        p('#e8dce9', 'M57 79h49v10H57z') + eyes('M62 69h6v9h-6zM94 69h6v9h-6z', 'M59 74h12v3H59zM91 74h12v3H91z') +
        g('mouth', 81, 86, p('#a37c94', 'M77 81h8v5h-8zM79 87h4v3h-4z')) + p('#e5b4cb', 'M53 78h10v4H53zM101 78h9v4h-9z')) +
      g('moonstone', 123, 137, p('#778fa9', 'M120 127h9v5h5v11h-20v-10h6z') + p('#cbd9e0', 'M121 128h6v13h-10v-6h4z') + p('#f5efcf', 'M121 129h3v6h-3z'));
  }
  function nova() {
    return g('tail', 96, 122, p('#3e887c', 'M95 112h15v12h17v-8h12v-13h7v23h-11v9h-25v-5H96z') + p('#84ceb1', 'M101 117h6v11h23v-7h10v-11h4v14h-10v8h-23v-5h-10z') + p('#e5cf86', 'M138 97h6v6h7v5h-7v7h-6v-7h-6v-5h6z')) +
      g('wing-left', 53, 77, p('#3b8178', 'M53 67H42V51H28v9H17v16H8v24h12v-9h13v11h13V85h10z') + p('#83bcaa', 'M42 62H30v8H19v12h-6v10h8v-7h14v8h7V78h10V70H42z') + p('#bad2af', 'M23 73h6v8h-6zM35 67h5v16h-5z')) +
      g('wing-right', 100, 77, p('#3b8178', 'M101 67h12V51h14v9h11v16h10v23h-12v-9h-14v12h-12V84h-10z') + p('#83bcaa', 'M113 63h12v7h11v12h7v9h-8v-7h-14v10h-8V78h-11v-8h11z') + p('#bad2af', 'M126 71h5v10h-5zM115 69h5v14h-5z')) +
      g('leg-left', 61, 122, p('#448e7e', 'M50 115h19v19h7v8H41v-10h9z') + p('#d6d9b0', 'M43 135h7v6h-7zM56 135h7v6h-7z')) +
      g('leg-right', 90, 123, p('#448e7e', 'M82 115h18v17h9v10H77v-9h5z') + p('#d6d9b0', 'M84 135h6v6h-6zM98 135h7v6h-7z')) +
      g('body', 78, 128, p('#438f7e', 'M60 72h36v16h10v37H49v-25h6V82h5z') + p('#89d1b2', 'M62 77h28v14h11v29H54v-18h6V87h2z') +
        p('#d1d9aa', 'M69 86h19v13h9v26H63V99h6z') + p('#a2b893', 'M67 102h27v3H67zM65 113h32v3H65z')) +
      g('arm-left', 56, 88, p('#4f9d89', 'M47 84h13v25h-7v11H37v-9h6V95h4z') + p('#b8d2ac', 'M38 111h5v8h-5zM47 111h5v8h-5z')) +
      g('arm-right', 99, 88, p('#4f9d89', 'M95 83h12v14h9v12h5v10h-15v-9h-8V98h-3z') + p('#b8d2ac', 'M106 111h5v8h-5zM115 111h5v8h-5z')) +
      g('head', 83, 74,
        g('ear-left', 59, 44, p('#d8c47f', 'M53 42V18h6v9h7v17z') + p('#f3dfa0', 'M55 21h3v13h-3z')) +
        g('ear-right', 100, 41, p('#d8c47f', 'M96 42V24h5V12h6v30z') + p('#f3dfa0', 'M101 23h3v12h-3z')) +
        p('#448e7e', 'M61 32h40v10h11v18h14v16h-12v11H62V77H50V47h11z') + p('#90d6b7', 'M64 37h33v11h10v17h14v8h-11v10H66V73H55V50h9z') +
        p('#d8dfb1', 'M85 68h34v8h-13v7H80V75h5z') + eyes('M67 51h7v11h-7zM95 51h6v10h-6z', 'M64 58h13v3H64zM92 57h12v3H92z') +
        g('mouth', 106, 77, p('#487264', 'M112 65h5v4h-5zM98 76h17v3H98z')) + p('#e6cb88', 'M74 32h7v7h-7z')) +
      g('sneeze', 127, 77, p('#f0dc93', 'M131 67h3v4h4v3h-4v4h-3v-4h-4v-3h4zM143 80h3v3h-3zM137 88h4v4h-4z')) +
      g('gadget', 29, 135, p('#617c84', 'M22 126h12v5h5v10H18v-10h4z') + p('#b4d1c3', 'M25 129h6v9h-6z') + p('#ead994', 'M27 123h3v10h-3zM23 127h11v3H23z'));
  }
  const bodies = { sprout, miso, brook, ember, luna, nova };
  function art(value) {
    const id = Object.prototype.hasOwnProperty.call(bodies, value) ? value : 'sprout', spec = specs[id];
    return '<svg class="pet-sprite pet-rig pet-rig-' + id + '" data-rig="' + id + '" data-species="' + spec.species + '" data-signature="' + spec.signature + '" viewBox="0 0 160 160" aria-hidden="true" focusable="false" shape-rendering="crispEdges">' +
      '<title>' + spec.name + '</title>' + p('#152a2633', 'M43 141h74v3h11v4H32v-4h11z', 'rig-shadow') + g('posture', 80, 135, bodies[id]()) + '</svg>';
  }
  art.rigs = Object.freeze(Object.fromEntries(Object.entries(specs).map(([id, spec]) => [id, Object.freeze({ ...spec })])));
  return art;
});
