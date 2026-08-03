(() => {
  'use strict';
  const startedAt = Date.now();
  const demoRoute = location.pathname.endsWith('/demo-profissional.html') || location.pathname.endsWith('/demo-profissional') || new URLSearchParams(location.search).get('demo') === '1';
  if (!demoRoute && (!sessionStorage.getItem('humanevo_access_granted') || !sessionStorage.getItem('humanevo_cloud_auth_v1'))) {
    location.replace('/');
    return;
  }
  const findBoot = () => document.querySelector('.boot-screen');

  const clearOldVersionAndOpen = async () => {
    try { sessionStorage.removeItem('humanevo_fast_start'); } catch (_) {}
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (_) {}
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch (_) {}
    location.replace('./painel.html?v=3.10.9&recovered=' + Date.now());
  };

  const showRecovery = () => {
    const boot = findBoot();
    if (!boot || window.__HUMANEVO_APP_READY__) return;
    boot.innerHTML = `
      <div class="boot-logo">H</div>
      <h2>Vamos recuperar a abertura</h2>
      <p>Uma versão anterior pode estar armazenada no navegador.</p>
      <div class="boot-actions">
        <button id="boot-clear" type="button">Limpar versão antiga e abrir</button>
        <button id="boot-reload" type="button">Tentar novamente</button>
      </div>`;
    document.getElementById('boot-clear')?.addEventListener('click', clearOldVersionAndOpen);
    document.getElementById('boot-reload')?.addEventListener('click', () => location.reload());
  };

  window.addEventListener('error', event => {
    console.error('Falha de inicialização Humanevo:', event.error || event.message);
    setTimeout(showRecovery, 50);
  });

  window.addEventListener('unhandledrejection', event => {
    console.error('Falha assíncrona Humanevo:', event.reason);
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const boot = findBoot();
      if (!boot || window.__HUMANEVO_APP_READY__) return;
      const text = boot.querySelector('p');
      if (text) text.textContent = 'Abrindo o painel com os dados locais...';
    }, 550);
    setTimeout(showRecovery, 3500);
  });

  window.addEventListener('humanevo:ready', () => {
    window.__HUMANEVO_BOOT_MS__ = Date.now() - startedAt;
  });
})();
