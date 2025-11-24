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

      // Save order data globally for use in other functions
      window.currentOrder = order;

      // Update UI with real order data
      const orderNumber = order.number || val;
      const orderNumberDisplay = document.getElementById('orderNumberDisplay');
      const channelNameDisplay = document.getElementById('channelNameDisplay');
      const orderCompositionDisplay = document.getElementById('orderCompositionDisplay');
      const recipientNameDisplay = document.getElementById('recipientNameDisplay');
      const deliveryAddressDisplay = document.getElementById('deliveryAddressDisplay');
      const orderStatus = document.getElementById('orderStatus');

      if (orderNumberDisplay) orderNumberDisplay.textContent = orderNumber;
      if (channelNameDisplay) channelNameDisplay.textContent = order.channelName || order.channelDisplay || 'Не указано';
      if (orderCompositionDisplay) {
        // Если composition пустое, используем productName
        const composition = order.composition && order.composition.trim() 
          ? order.composition 
          : (order.productName || 'Не указано');
        orderCompositionDisplay.textContent = composition;
      }
      if (recipientNameDisplay) recipientNameDisplay.textContent = order.recipient || 'Не указано';
      if (deliveryAddressDisplay) deliveryAddressDisplay.textContent = order.deliveryAddress || 'Не указано';
      if (orderStatus) orderStatus.textContent = order.status || 'Ожидает оплаты';

      // Update hero card elements (sticky card at top)
      const heroOrderNumber = document.getElementById('heroOrderNumber');
      const heroChannelName = document.getElementById('heroChannelName');
      const heroProductDelivery = document.getElementById('heroProductDelivery');
      
      if (heroOrderNumber) heroOrderNumber.textContent = orderNumber;
      if (heroChannelName) {
        const channelName = order.channelName || order.channelDisplay || 'Не указано';
        heroChannelName.textContent = `Телеграм-канал «${channelName}»`;
      }
      if (heroProductDelivery) {
        const productName = order.productName || 'Не указано';
        const deliveryAddress = order.deliveryAddress || 'Не указано';
        heroProductDelivery.textContent = `Товар: ${productName} · Доставка: ${deliveryAddress}`;
      }

      // Update payment section header with order number
      const paymentHeader = document.querySelector('.payment-module .module-header h3');
      if (paymentHeader) {
        paymentHeader.textContent = `Оплата заказа ${orderNumber}`;
      }

      // Calculate and update delivery prices
      updateDeliveryPrices(order.price || 0);
      
      // Update summary amount with default selected plan (auto-fast)
      updateSummary();

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

  // Calculate delivery prices based on product price
  function updateDeliveryPrices(productPrice) {
    if (!productPrice || productPrice <= 0) {
      // If no price, show 0
      document.querySelectorAll('.plan-price').forEach(el => {
        if (el) el.textContent = '0 ₽';
      });
      return;
    }

    // Delivery prices calculation:
    // - Авто быстрое: 15% от стоимости товара + 2% страхование
    // - Авто обычное: 12% от стоимости товара + 2% страхование
    // - Ж/Д: 10% от стоимости товара + 2% страхование
    // - Авиа экспресс: 3000 руб/кг (минимум 10 кг = 30000 руб) + 2% страхование
    
    const insurance = Math.round(productPrice * 0.02); // 2% страхование
    
    const autoFastPrice = Math.round(productPrice * 0.15) + insurance;
    const autoNormalPrice = Math.round(productPrice * 0.12) + insurance;
    const railwayPrice = Math.round(productPrice * 0.10) + insurance;
    const airExpressPrice = 30000 + insurance; // Минимум 10 кг по 3000 руб/кг

    const autoFastEl = document.getElementById('planPriceAutoFast');
    const autoNormalEl = document.getElementById('planPriceAutoNormal');
    const railwayEl = document.getElementById('planPriceRailway');
    const airExpressEl = document.getElementById('planPriceAirExpress');

    if (autoFastEl) {
      autoFastEl.textContent = `${autoFastPrice.toLocaleString('ru-RU')} ₽`;
      const card = autoFastEl.closest('.plan-card');
      if (card) card.setAttribute('data-amount', autoFastPrice);
    }
    if (autoNormalEl) {
      autoNormalEl.textContent = `${autoNormalPrice.toLocaleString('ru-RU')} ₽`;
      const card = autoNormalEl.closest('.plan-card');
      if (card) card.setAttribute('data-amount', autoNormalPrice);
    }
    if (railwayEl) {
      railwayEl.textContent = `${railwayPrice.toLocaleString('ru-RU')} ₽`;
      const card = railwayEl.closest('.plan-card');
      if (card) card.setAttribute('data-amount', railwayPrice);
    }
    if (airExpressEl) {
      airExpressEl.textContent = `${airExpressPrice.toLocaleString('ru-RU')} ₽`;
      const card = airExpressEl.closest('.plan-card');
      if (card) card.setAttribute('data-amount', airExpressPrice);
    }
    
    // Update summary after prices are calculated
    updateSummary();
  }
  
  // Helper function to update summary (exposed for use in updateDeliveryPrices)
  function updateSummary() {
    const activePlan = document.querySelector('.plan-card.active');
    if (!activePlan) return;
    
    const planName = activePlan.querySelector('.plan-title')?.textContent || '';
    const planAmount = parseInt(activePlan.getAttribute('data-amount') || '0', 10);
    
    const summaryPlan = document.getElementById('summaryPlan');
    const summaryAmount = document.getElementById('summaryAmount');
    
    if (summaryPlan) summaryPlan.textContent = planName;
    if (summaryAmount) {
      summaryAmount.textContent = `${planAmount.toLocaleString('ru-RU')} ₽`;
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

    // Handle delivery plan selection
    document.querySelectorAll('.plan-card').forEach(card => {
      card.addEventListener('click', function() {
        // Remove active class from all cards
        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active'));
        // Add active class to clicked card
        this.classList.add('active');
        // Update summary
        updateSummary();
      });
    });

    // Handle payment method selection
    document.querySelectorAll('.method').forEach(method => {
      method.addEventListener('click', function() {
        // Remove active class from all methods
        document.querySelectorAll('.method').forEach(m => m.classList.remove('active'));
        // Add active class to clicked method
        this.classList.add('active');
        // Update summary method
        const methodName = this.querySelector('.plan-title')?.textContent || '';
        const summaryMethod = document.getElementById('summaryMethod');
        if (summaryMethod) summaryMethod.textContent = methodName;
      });
    });
  }

  // Remove black background from video using Canvas with better quality
  function setupVideoChromaKey(videoId) {
    const video = document.getElementById(videoId);
    if (!video) return;

    // Wait for video to be ready
    const initCanvas = () => {
      if (video.readyState < 2) {
        video.addEventListener('loadeddata', initCanvas);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const wrapper = video.parentElement;
      
      // Set canvas size to match video
      const videoWidth = video.videoWidth || 150;
      const videoHeight = video.videoHeight || 150;
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      canvas.style.width = video.style.width || video.width + 'px';
      canvas.style.height = video.style.height || video.height + 'px';
      canvas.style.background = 'transparent';
      canvas.style.position = 'relative';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.zIndex = '0';
      
      // Hide original video but keep it playing
      video.style.opacity = '0';
      video.style.position = 'absolute';
      video.style.pointerEvents = 'none';
      
      // Add canvas to wrapper
      wrapper.style.position = 'relative';
      wrapper.appendChild(canvas);
      
      let animationFrameId;
      
      function processFrame() {
        if (video.readyState >= 2) {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Process pixels - remove black/dark pixels with smooth transition
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate brightness using luminance formula
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
            
            // Smooth transition for black background removal
            // Threshold: pixels darker than 50 will be made transparent
            if (brightness < 50) {
              // Smooth alpha transition
              const alpha = Math.max(0, (brightness / 50) * 255);
              data[i + 3] = alpha;
            }
          }
          
          // Put processed image data back
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Continue processing frames
        animationFrameId = requestAnimationFrame(processFrame);
      }
      
      // Start processing frames
      processFrame();
      
      // Cleanup on video end (if needed)
      video.addEventListener('ended', () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      });
    };
    
    initCanvas();
  }

  // Detect Telegram WebView and add class to body
  function detectTelegramWebView() {
    if (window.Telegram && window.Telegram.WebApp) {
      document.body.classList.add('telegram-webview');
      // Set theme colors for Telegram
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
    } else if (window.navigator.userAgent.includes('Telegram')) {
      document.body.classList.add('telegram-webview');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    detectTelegramWebView();
    bindUI();
    setupMascot();
    
    // Setup chroma key for hero mascot video after a short delay
    setTimeout(() => {
      setupVideoChromaKey('hero-mascot-video');
    }, 300);
  });

  // Expose small API if needed
  window.showToast = showToast;
  window.loadOrderData = loadOrderData;

})();