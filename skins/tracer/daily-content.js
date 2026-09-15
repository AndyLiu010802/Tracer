(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerDaily = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Public-domain source texts. English lines are our concise translations.
  var quotes = [
    { zh: '千里之行，始于足下。', en: 'A journey of a thousand miles begins beneath your feet.', authorZh: '《道德经》第六十四章', authorEn: 'Tao Te Ching · 64', source: 'https://ctext.org/dao-de-jing' },
    { zh: '学而时习之，不亦说乎？', en: 'Is it not a joy to learn and put learning into practice?', authorZh: '《论语·学而》', authorEn: 'Analects · Xue Er', source: 'https://ctext.org/analects/xue-er' },
    { zh: '不积跬步，无以至千里。', en: 'Without gathering small steps, no great distance is reached.', authorZh: '《荀子·劝学》', authorEn: 'Xunzi · Encouraging Learning', source: 'https://ctext.org/xunzi/quan-xue' },
    { zh: '温故而知新，可以为师矣。', en: 'Revisit what you know and discover something new; then you can teach.', authorZh: '《论语·为政》', authorEn: 'Analects · Wei Zheng', source: 'https://ctext.org/analects/wei-zheng' },
    { zh: '欲速则不达。', en: 'Hurrying can keep you from arriving.', authorZh: '《论语·子路》', authorEn: 'Analects · Zi Lu', source: 'https://ctext.org/analects/zi-lu' },
    { zh: '锲而不舍，金石可镂。', en: 'Keep carving, and even metal and stone can be engraved.', authorZh: '《荀子·劝学》', authorEn: 'Xunzi · Encouraging Learning', source: 'https://ctext.org/xunzi/quan-xue' },
    { zh: '知之者不如好之者，好之者不如乐之者。', en: 'Knowing is surpassed by loving, and loving by finding joy.', authorZh: '《论语·雍也》', authorEn: 'Analects · Yong Ye', source: 'https://ctext.org/analects/yong-ye' }
  ];
  var scenes = ['mountains', 'coast', 'forest', 'dunes'];
  function dayNumber(date) { return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000); }
  function quote(date) { return quotes[((dayNumber(date) % quotes.length) + quotes.length) % quotes.length]; }
  function nextScene(previous, random) { var options = scenes.filter(function (s) { return s !== previous; }); return options[Math.min(options.length - 1, Math.floor(Math.max(0, random) * options.length))]; }
  return { quotes: quotes, scenes: scenes, quote: quote, nextScene: nextScene, dayNumber: dayNumber };
});
