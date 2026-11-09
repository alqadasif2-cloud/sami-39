(function() {
  try {
    var docEl = document.documentElement;
    var ua = navigator.userAgent || '';

    // 1. Feature detection: CSS modern features
    var supportsBackdrop = false;
    var supportsOklch = false;
    if (window.CSS && typeof CSS.supports === 'function') {
      try {
        supportsBackdrop = CSS.supports('backdrop-filter', 'blur(10px)') || CSS.supports('-webkit-backdrop-filter', 'blur(10px)');
      } catch (e) {}
      try {
        supportsOklch = CSS.supports('color', 'oklch(50% 0.1 100)');
      } catch (e) {}
    }

    // 2. Android version & WebView engine detection
    var isAndroid = /Android/i.test(ua);
    var androidVer = 0;
    var chromeVer = 0;

    var androidMatch = ua.match(/Android\s+([0-9\.]+)/i);
    if (androidMatch && androidMatch[1]) {
      androidVer = parseFloat(androidMatch[1]) || 0;
    }

    var chromeMatch = ua.match(/(?:Chrome|CriOS|Version)\/([0-9]+)/i);
    if (chromeMatch && chromeMatch[1]) {
      chromeVer = parseInt(chromeMatch[1], 10) || 0;
    }

    var isLegacyAndroid = isAndroid && (
      androidVer < 12 ||
      (chromeVer > 0 && chromeVer < 111) ||
      !supportsBackdrop ||
      !supportsOklch
    );

    if (isLegacyAndroid) {
      docEl.classList.add('sami-legacy-android');
      if (document.body) document.body.classList.add('sami-legacy-android');
      window.__samiIsLegacyAndroid = true;
    }

    if (isAndroid) {
      docEl.classList.add('sami-android-webview');
      if (document.body) document.body.classList.add('sami-android-webview');
    }
  } catch (err) {}
})();
