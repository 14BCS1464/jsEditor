/* Shared light/dark switch for every editor. Persists in localStorage as suite-theme. */
(function () {
  var KEY = 'suite-theme';

  try {
    if (!localStorage.getItem(KEY) && localStorage.getItem('rn-ui') === 'dark') {
      localStorage.setItem(KEY, 'dark');
    }
  } catch (e) {}

  function read() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; }
    catch (e) { return 'light'; }
  }

  function monacoTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs';
  }

  function paint(theme, notify) {
    var dark = theme === 'dark';
    var root = document.documentElement;
    if (dark) root.dataset.theme = 'dark';
    else delete root.dataset.theme;

    /* React Native workspace follows the same switch. The phone preview keeps its own theme. */
    if (dark) delete root.dataset.ui;
    else root.dataset.ui = 'light';

    var buttons = document.querySelectorAll('[data-suite-theme]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = btn.querySelector('span');
      var icon = btn.querySelector('i');
      if (label) label.textContent = dark ? 'Light' : 'Dark';
      if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    var body = document.body;
    if (body && body.classList.contains('suite-json')) {
      body.classList.toggle('dark', dark);
      body.classList.toggle('light', !dark);
    }

    if (window.monaco && monaco.editor && typeof monaco.editor.setTheme === 'function') {
      try { monaco.editor.setTheme(monacoTheme()); } catch (e) {}
    }

    if (notify !== false && document.body) {
      document.dispatchEvent(new CustomEvent('suite-theme', { detail: theme }));
    }
  }

  window.suiteMonacoTheme = monacoTheme;
  window.suiteToggleTheme = function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) {}
    paint(next);
  };

  paint(read(), false);

  function whenReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  whenReady(function () { paint(read()); });

  var started = Date.now();
  var timer = setInterval(function () {
    if (window.monaco && monaco.editor) {
      try { monaco.editor.setTheme(monacoTheme()); } catch (e) {}
    }
    if (Date.now() - started > 8000) clearInterval(timer);
  }, 300);
})();
