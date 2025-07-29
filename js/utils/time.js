(function(global) {
  function parseTime(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  function formatTime(mins) {
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m}`;
  }
  global.TimeUtils = { parseTime, formatTime };
})(window);
