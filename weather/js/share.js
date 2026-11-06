/*
 * დღის პროგნოზის სურათი (1080×1350) და გაზიარება. ტელეფონზე იხსნება სისტემური „გაზიარება“
 * (Messenger, Viber...), კომპიუტერზე — სურათი ინახება.
 */
(function (root) {
  'use strict';

  var W = 1080, H = 1350;

  function draw(d) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var font = '"Noto Sans Georgian", "BPG Arial", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2563eb');
    grad.addColorStop(1, '#1e3a8a');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.fillStyle = '#ffffff';
    g.textBaseline = 'alphabetic';
    g.font = '700 64px ' + font;
    g.fillText(d.place, 80, 150);
    g.globalAlpha = 0.8;
    g.font = '400 38px ' + font;
    g.fillText(d.date, 80, 210);
    g.globalAlpha = 1;

    g.font = '220px ' + font;
    g.fillText(d.icon, 70, 500);
    g.font = '800 230px ' + font;
    g.fillText(d.temp, 420, 500);

    g.font = '600 52px ' + font;
    g.fillText(d.cond, 80, 610);
    g.globalAlpha = 0.85;
    g.font = '400 40px ' + font;
    g.fillText(d.feels + (d.range ? '  ·  ' + d.range : ''), 80, 675);
    g.globalAlpha = 1;

    if (d.wear) {
      g.fillStyle = 'rgba(255,255,255,0.14)';
      roundRect(g, 60, 730, W - 120, 120, 28);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = '500 40px ' + font;
      g.fillText('👕 ' + d.wear, 100, 805, W - 200);
    }

    var colW = (W - 120) / 3;
    d.days.forEach(function (day, i) {
      var x = 60 + i * colW;
      g.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(g, x + 8, 900, colW - 16, 260, 28);
      g.fill();
      g.fillStyle = '#ffffff';
      g.textAlign = 'center';
      g.font = '600 38px ' + font;
      g.fillText(day.label, x + colW / 2, 960, colW - 40);
      g.font = '90px ' + font;
      g.fillText(day.icon, x + colW / 2, 1070);
      g.font = '500 38px ' + font;
      g.fillText(day.range, x + colW / 2, 1130);
      g.textAlign = 'left';
    });

    g.globalAlpha = 0.85;
    g.font = '500 36px ' + font;
    g.fillText(d.app + '  ·  ' + d.sources, 80, H - 80);
    g.globalAlpha = 1;
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function share(d) {
    var canvas = draw(d);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) { reject(new Error('blob')); return; }
        var file = typeof File !== 'undefined' ? new File([blob], 'weather.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: d.text }).then(function () { resolve('shared'); }, function (e) {
            if (e && e.name === 'AbortError') resolve('cancelled'); else reject(e);
          });
          return;
        }
        // გაზიარება მიუწვდომელია — ვინახავთ ფაილად
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'weather.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        resolve('saved');
      }, 'image/png');
    });
  }

  root.WeatherShare = { share: share, draw: draw };
})(window);
