// Runs independently of the application bundle, including when that bundle fails to load.
(function () {
  var mounted = false;
  var timer;
  function showFailure() {
    if (mounted) return;
    var panel = document.getElementById('startup-status');
    if (!panel) return;
    panel.textContent = '';
    var message = document.createElement('p');
    message.textContent = 'No se pudo abrir Vestika. Comprueba la conexión e intenta de nuevo.';
    var button = document.createElement('button');
    button.textContent = 'Intentar de nuevo';
    button.onclick = function () { window.location.reload(); };
    panel.append(message, button);
  }
  window.addEventListener('vestika:mounted', function () {
    mounted = true;
    clearTimeout(timer);
    var panel = document.getElementById('startup-status');
    if (panel) panel.remove();
  }, { once: true });
  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT' && event.target.type === 'module') showFailure();
  }, true);
  window.addEventListener('unhandledrejection', showFailure);
  timer = setTimeout(showFailure, 20000);
}());
