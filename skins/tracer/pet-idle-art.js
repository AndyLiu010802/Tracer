(function () {
  'use strict';
  // Hand-drawn pixel props surround the original sprite; its face and identity stay intact.
  const path = (fill, d, cls = '') => '<path' + (cls ? ' class="' + cls + '"' : '') + ' fill="' + fill + '" d="' + d + '"/>';
  const group = (cls, content) => '<g class="' + cls + '">' + content + '</g>';
  const water = () => group('idle-pond',
    path('#263e48','M100 125h40v4h12v6h5v9h-10v5h-43v-3H91v-7h-5v-8h14z') +
    path('#487f91','M100 129h40v4h11v9h-12v3h-34v-4H94v-9h6z') +
    path('#6faeba','M108 132h15v3h-15zM135 137h13v3h-13zM100 138h7v3h-7z','idle-water-glint') +
    path('#8aac80','M139 130h8v4h-8zM145 126h3v6h-3zM91 132h6v4h-6z') +
    path('#c2c982','M139 129h3v3h-3z'));
  const fish = () => group('idle-fish',
    path('#293f4d','M122 127h12v3h4v6h-4v3h-12v-4h-5v-6h5z') +
    path('#e4b878','M123 129h10v3h4v2h-4v3h-10zM119 130h4v4h-4z') +
    path('#f5d59b','M125 130h7v2h-7z') + path('#374954','M132 132h2v2h-2z'));
  const splash = () => group('idle-water-splash',
    path('#a5d4d7','M119 117h3v5h-3zM132 113h3v6h-3zM142 120h4v3h-4zM111 126h4v3h-4z'));
  const bed = () => group('idle-garden-bed',
    path('#344a39','M12 137h124v14H12z') + path('#8d654a','M17 137h114v11H17z') +
    path('#ad8060','M20 138h108v3H20z') + path('#684934','M23 144h14v3H23zM47 143h21v3H47zM83 144h16v3H83zM109 142h16v3h-16z') +
    path('#b6976a','M15 136h6v16h-6zM127 136h6v16h-6z') +
    group('idle-sprouts',path('#629568','M35 130h3v11h-3zM74 129h3v12h-3zM112 130h3v11h-3z') +
      path('#91ba78','M26 125h8v3h4v5h-8v-3h-4zM38 121h8v5h-5v4h-4v-4h1zM66 122h8v3h4v6h-7v-3h-5zM77 118h9v6h-5v5h-5v-6h1zM104 122h8v3h4v7h-7v-4h-5zM115 126h9v5h-9z') +
      path('#c0d69a','M39 122h5v2h-5zM80 119h4v3h-4zM106 123h4v2h-4z')));
  const ore = () => group('idle-ore',
    path('#35454c','M119 115h20v5h9v10h6v17h-44v-15h4v-11h5z') +
    path('#78868a','M121 119h16v5h8v9h5v10h-35v-11h4v-10h2z') +
    path('#9aa2a0','M122 121h13v3h-13zM117 134h8v3h-8z') +
    path('#506774','M140 128h5v14h-11v-4h6zM117 139h17v4h-17z') +
    path('#79b8c9','M126 119h6v9h-3v5h-6v-9h3zM138 133h6v6h-6z') +
    path('#bddee0','M127 121h3v6h-3zM139 134h3v2h-3z'));
  const gems = () => group('idle-crystal-sparks',
    path('#bfe1d0','M145 102h3v4h4v3h-4v4h-3v-4h-4v-3h4zM118 104h3v3h3v3h-3v3h-3v-3h-3v-3h3z') +
    path('#e7d9a0','M152 122h3v3h-3zM112 120h3v3h-3z'));
  const dust = () => group('idle-soil-dust',path('#be9b70','M99 126h3v3h-3zM139 118h4v4h-4zM144 134h3v3h-3z') + path('#8c6748','M103 132h4v3h-4zM148 127h4v3h-4z'));
  const paw = cls => group(cls,
    path('#4b6451','M99 104h8v3h8v4h9v10h-6v4h-13v-6h-6z') +
    path('#bad4b0','M101 106h5v3h8v4h8v6h-5v4h-10v-6h-6z') +
    path('#789c75','M109 119h4v3h-4zM116 115h4v3h-4z'));
  const vignette = (kind, activity, body) => '<g class="pet-idle-vignette" data-idle-kind="' + kind + '" data-idle-activity="' + activity + '">' + body + '</g>';

  window.TracerPetIdleArt = function () {
    const layer = document.createElement('span');
    layer.className = 'pet-idle-scene'; layer.setAttribute('aria-hidden','true');
    layer.innerHTML = '<svg class="pet-idle-canvas" viewBox="0 0 160 160" focusable="false" aria-hidden="true" shape-rendering="crispEdges">' +
      vignette('humanoid','fishing',water() +
        path('#a57c53','M99 137h16v5H99zM99 134h4v9h-4z') +
        group('idle-rod',path('#473f35','M101 112h4V99h5V86h5V74h5V63h5V53h5v-4h4v8h-5v10h-5v11h-5v12h-5v13h-5v11h-8z') +
          path('#d0ad77','M104 100h3v12h-3zM110 87h3v12h-3zM116 74h3v12h-3zM122 64h3v10h-3zM128 54h3v10h-3z') +
          path('#b5cec9','M133 54h2v5h3v10h3v16h2v37h-2V85h-2V70h-3V60h-3z')) +
        group('idle-float',path('#f0daba','M139 121h7v7h-7z') + path('#cb7760','M139 125h7v4h-7z') + path('#e5ead8','M142 117h2v4h-2z')) + fish()) +
      vignette('creature','fishing',water() + fish() + paw('idle-fishing-paw') + splash()) +
      vignette('humanoid','exercise',
        path('#496963','M25 141h110v8H25z') + path('#80a097','M29 141h102v3H29z') + path('#aac0a3','M33 145h12v2H33zM114 145h12v2h-12z') +
        group('idle-dumbbell idle-dumbbell-left',path('#344752','M14 98h5v-5h7v7h19v-7h7v5h5v17h-5v5h-7v-9H26v9h-7v-5h-5z') +
          path('#849ba4','M20 96h4v20h-4zM47 96h4v20h-4z') + path('#b9c7c1','M26 103h19v4H26z') + path('#5b7381','M15 101h4v10h-4zM52 101h4v10h-4z')) +
        group('idle-dumbbell idle-dumbbell-right',path('#344752','M103 98h5v-5h7v7h19v-7h7v5h5v17h-5v5h-7v-9h-19v9h-7v-5h-5z') +
          path('#849ba4','M109 96h4v20h-4zM136 96h4v20h-4z') + path('#b9c7c1','M115 103h19v4h-19z') + path('#5b7381','M104 101h4v10h-4zM141 101h4v10h-4z')) +
        path('#b4d3c6','M18 82h3v5h-3zM145 80h3v5h-3z','idle-effort-marks')) +
      vignette('creature','exercise',
        path('#526d48','M15 143h132v5H15z') + path('#83a364','M19 142h6v-5h3v6h31v-4h3v5h42v-5h3v5h26v-7h3v6h7v3H19z') +
        group('idle-hurdle',path('#785c43','M110 124h5v21h-5zM137 124h5v21h-5z') + path('#d4b27a','M106 125h40v6h-40z') + path('#f0d5a0','M109 126h34v2h-34z') + path('#cb8564','M116 125h5v6h-5zM132 125h5v6h-5z')) +
        group('idle-exercise-trail',path('#8da97b','M14 132h5v3h-5zM20 127h4v4h-4zM24 132h4v3h-4zM22 136h6v4h-6z') + path('#abc392','M39 137h5v3h-5zM45 132h4v4h-4zM49 137h4v3h-4zM46 141h7v3h-7z')) +
        path('#e6d08d','M120 108h3v4h4v3h-4v4h-3v-4h-4v-3h4z','idle-effort-marks')) +
      vignette('humanoid','farming',bed() +
        group('idle-hoe',path('#d1b37d','M28 92h4v40h-4z') + path('#789398','M24 130h18v4H24zM38 134h4v7h-4z') + path('#abc1bc','M25 130h13v2H25z')) +
        group('idle-watering-can',path('#365458','M119 98h16v4h5v5h6v-8h5v15h-12v15h-23v-17h-7v-4h10z') +
          path('#82a99c','M120 105h16v21h-16zM111 109h9v4h-9zM136 111h12v-3h-12z') +
          path('#b3c8ad','M122 107h11v3h-11zM119 99h13v3h-13z') + path('#617f78','M123 121h13v5h-13z')) +
        group('idle-watering-drops',path('#8ec6ce','M106 117h3v6h-3zM100 124h3v5h-3zM110 128h3v4h-3zM95 130h3v4h-3z'))) +
      vignette('creature','farming',bed() +
        path('#b08357','M104 132h27v8h-27zM111 128h12v4h-12z') +
        paw('idle-digging-paw') + dust() +
        group('idle-seeds',path('#e2c993','M94 118h3v4h-3zM101 125h3v3h-3zM110 130h3v4h-3z')) +
        group('idle-garden-splash',path('#93c6ca','M133 125h3v5h-3zM141 122h3v5h-3zM145 132h4v3h-4z'))) +
      vignette('humanoid','mining',ore() +
        path('#65786c','M101 146h50v3h-50z') +
        group('idle-pickaxe',path('#544432','M107 111h5V92h5V80h5v-9h5v-5h5v7h-5v11h-5v13h-5v18h-10z') +
          path('#b7a16d','M110 98h3v13h-3zM116 84h3v14h-3zM122 74h3v10h-3z') +
          path('#b2c5c7','M107 64h27v4h10v5h6v10h-5v-6h-10v-5h-28v4h-7v-6h7z') +
          path('#718e9d','M107 68h27v4h-27zM139 74h6v3h-6z')) + gems() + dust()) +
      vignette('creature','mining',ore() +
        paw('idle-mining-paw') + gems() +
        group('idle-ore-scratches',path('#d0d8ba','M123 123h2v10h-2zM129 122h2v10h-2zM135 124h2v9h-2z')) +
        group('idle-found-crystal',path('#426d79','M94 136h9v4h4v8H91v-8h3z') + path('#9fd3ce','M96 135h5v10h-5z') + path('#dcebd3','M97 136h2v5h-2z'))) +
      '</svg>';
    return layer;
  };
})();
