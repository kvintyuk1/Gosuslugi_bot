// Main app JS moved out of index.html to satisfy CSP (no inline scripts)
(function(){
  'use strict';

  // Toast
  function showToast(message, type = 'info', timeout = 3000){
    const toast = document.getElementById('toast');
    if (!toast) return;
    const msg = document.getElementById('toastMessage');
    const icon = document.getElementById('toastIcon');
    msg.textContent = message;
    icon.textContent = type === 'info' ? 'ℹ️' : (type === 'success' ? '✅' : '⚠️');
    toast.classList.add('show');
    toast.classList.remove('success','info');
    toast.classList.add(type === 'success' ? 'success' : 'info');
    clearTimeout(window._toastHide);
    window._toastHide = setTimeout(()=> toast.classList.remove('show'), timeout);
  }

  // Order loader - fetches real data from API
  async function loadOrderData(){
    const input = document.getElementById('orderNumberInput');
    const orderError = document.getElementById('orderError');
    if (!input) return;
    const val = input.value.trim();
    if (orderError) { orderError.textContent = ''; orderError.classList.remove('show'); }

    if (!val){
      if (orderError) { orderError.textContent = 'Введите номер заказа (например TG-00001)'; orderError.classList.add('show'); }
      return;
    }

    if (!/^TG-\d+/i.test(val)){
      if (orderError) { orderError.textContent = 'Неверный формат номера заказа. Ожидается TG-<числа>'; orderError.classList.add('show'); }
      return;
    }

    // Show loading state
    showToast('Загрузка данных заказа...', 'info', 2000);

    try {
      // Determine API URL - use config if available, otherwise use relative path
      const apiBaseUrl = window.API_SERVER_URL || '';
      const apiUrl = `${apiBaseUrl}/api/order/${val}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          if (orderError) {
            orderError.textContent = `Заказ ${val} не найден. Проверьте номер заказа.`;
            orderError.classList.add('show');
          }
          showToast('Заказ не найден', 'error');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const order = data.order;

      if (!order) {
        if (orderError) {
          orderError.textContent = 'Ошибка: данные заказа не получены';
          orderError.classList.add('show');
        }
        showToast('Ошибка загрузки данных', 'error');
        return;
      }

      // Update UI with real order data
      const orderNumberDisplay = document.getElementById('orderNumberDisplay');
      const channelNameDisplay = document.getElementById('channelNameDisplay');
      const orderCompositionDisplay = document.getElementById('orderCompositionDisplay');
      const recipientNameDisplay = document.getElementById('recipientNameDisplay');
      const deliveryAddressDisplay = document.getElementById('deliveryAddressDisplay');
      const orderStatus = document.getElementById('orderStatus');

      if (orderNumberDisplay) orderNumberDisplay.textContent = order.number || val;
      if (channelNameDisplay) channelNameDisplay.textContent = order.channelName || order.channelDisplay || 'Не указано';
      if (orderCompositionDisplay) {
        const composition = order.composition && order.composition.trim() ? order.composition : 'Не указано';
        orderCompositionDisplay.textContent = composition;
      }
      if (recipientNameDisplay) recipientNameDisplay.textContent = order.recipient || 'Не указано';
      if (deliveryAddressDisplay) deliveryAddressDisplay.textContent = order.deliveryAddress || 'Не указано';
      if (orderStatus) orderStatus.textContent = order.status || 'Ожидает оплаты';

      // Show order content
      document.querySelectorAll('.order-content-hidden').forEach(el=> el.classList.remove('order-content-hidden'));
      document.querySelectorAll('.order-content-visible').forEach(el=> el.classList.add('order-content-visible'));
      const main = document.getElementById('mainContent'); if (main) main.style.display = '';
      const footer = document.getElementById('footerContent'); if (footer) footer.classList.remove('order-content-hidden');

      showToast('Данные заказа загружены', 'success');
    } catch (error) {
      console.error('Error loading order:', error);
      if (orderError) {
        orderError.textContent = `Ошибка загрузки: ${error.message}`;
        orderError.classList.add('show');
      }
      showToast('Ошибка загрузки данных заказа', 'error');
    }
  }

  // Mascot playlist player
  function setupMascot(){
    const playlist = [
      'img/maxae.webm',
      'img/dymae.webm',
      'img/stoit.webm',
      'img/chyhae.webm',
      'img/zitxnyv.webm'
    ];
    const video = document.getElementById('max-maskot-video');
    if (!video) return;
    let idx = 0; let firstCycle = true;

    function play(i){ idx = i; video.src = playlist[i]; video.load(); video.play().catch(()=>{}); }

    video.addEventListener('ended', ()=>{
      if (firstCycle){
        if (idx < playlist.length - 1) idx++;
        else { firstCycle = false; idx = 1; }
      } else {
        idx++; if (idx > playlist.length - 1) idx = 1;
      }
      play(idx);
    });

    window.setTimeout(()=> play(0), 100);

    // toggle mute on click
    const container = document.getElementById('max-maskot-container');
    if (container){
      container.addEventListener('click', ()=>{
        video.muted = !video.muted;
        if (!video.muted) video.play().catch(()=>{});
      });
    }
  }

  // Attach UI event listeners
  function bindUI(){
    // burger and other elements that use data-toast
    document.querySelectorAll('[data-toast]').forEach(el=>{
      el.addEventListener('click', function(e){
        if (this.tagName === 'A') e.preventDefault();
        const msg = this.dataset.toast || 'Операция';
        const type = this.dataset.toastType || 'info';
        showToast(msg, type);
      });
    });

    const logo = document.getElementById('logoHome');
    if (logo){
      logo.addEventListener('click', function(e){ e.preventDefault(); window.scrollTo({top:0, behavior:'smooth'}); });
    }

    const loginBtn = document.querySelector('.login-button');
    if (loginBtn && loginBtn.dataset && loginBtn.dataset.toast){
      // already handled by data-toast selector above
    }

    const loadBtn = document.querySelector('.order-load-btn');
    if (loadBtn) loadBtn.addEventListener('click', loadOrderData);

    const orderInput = document.getElementById('orderNumberInput');
    if (orderInput) orderInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') loadOrderData(); });

    document.querySelectorAll('.service-item').forEach(item=>{
      // if no data-toast provided, use inner text as message
      if (!item.dataset.toast){
        item.dataset.toast = item.textContent.trim();
        item.dataset.toastType = 'info';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindUI();
    setupMascot();
  });

  // Expose small API if needed
  window.showToast = showToast;
  window.loadOrderData = loadOrderData;

})();