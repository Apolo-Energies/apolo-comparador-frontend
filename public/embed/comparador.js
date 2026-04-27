(function () {
  'use strict';

  var cfg = Object.assign(
    {
      baseUrl: 'https://TU-DOMINIO.com',
      // Id del contenedor en WordPress donde se montará el iframe.
      targetId: 'apolo-comparador',
      // Altura inicial antes de que el iframe reporte la suya.
      initialHeight: 720,
      // Qué hacer al pulsar "Contratar Apolo" dentro del iframe.
      //   'self'   → redirige la página de WordPress
      //   'blank'  → abre en nueva pestaña
      contratarTarget: 'self',
      contratarUrl: 'https://apolo-energies.com/contratar',
    },
    window.ApoloComparadorConfig || {}
  );

  function mount() {
    var target = document.getElementById(cfg.targetId);
    if (!target) {
      console.warn('[ApoloComparador] No se encontró #' + cfg.targetId);
      return;
    }
    if (target.dataset.apoloMounted === '1') return;
    target.dataset.apoloMounted = '1';

    var iframe = document.createElement('iframe');
    iframe.src = cfg.baseUrl + '/comparador-publico?embed=1';
    iframe.title = 'Comparador Apolo Energies';
    iframe.loading = 'lazy';
    iframe.allow = 'clipboard-write';
    iframe.style.cssText = [
      'width: 100%',
      'border: 0',
      'display: block',
      'background: transparent',
      'height: ' + cfg.initialHeight + 'px',
      'transition: height .25s ease'
    ].join(';');
    target.appendChild(iframe);

    // Autoresize + acciones desde el iframe
    window.addEventListener('message', function (ev) {
      var data = ev.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'apolo-comparador:resize' && typeof data.height === 'number') {
        iframe.style.height = Math.max(data.height, 320) + 'px';
      }

      if (data.type === 'apolo-comparador:contratar') {
        var url = data.url || cfg.contratarUrl;
        if (cfg.contratarTarget === 'blank') {
          window.open(url, '_blank', 'noopener');
        } else {
          window.location.href = url;
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
