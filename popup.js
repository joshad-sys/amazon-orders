// ============================================
// Amazon Order History Exporter — Popup Logic
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // ---- Version Label ----
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) versionLabel.textContent = 'v' + chrome.runtime.getManifest().version;

  // ---- Element References ----
  const statusBanner = document.getElementById('statusBanner');
  const statusText = document.getElementById('statusText');
  const controlsSection = document.getElementById('controlsSection');
  const progressSection = document.getElementById('progressSection');
  const completeSection = document.getElementById('completeSection');

  const btnCsv = document.getElementById('btnCsv');
  const btnPdf = document.getElementById('btnPdf');
  const btnStart = document.getElementById('btnStart');
  const btnStartLabel = document.getElementById('btnStartLabel');
  const btnCancel = document.getElementById('btnCancel');
  const btnReset = document.getElementById('btnReset');
  const btnDownloadCsv = document.getElementById('btnDownloadCsv');
  const btnDownloadPdf = document.getElementById('btnDownloadPdf');

  const toggleAllYears = document.getElementById('toggleAllYears');
  const toggleImages = document.getElementById('toggleImages');
  const imageModeSelector = document.getElementById('imageModeSelector');
  const btnImageUrl = document.getElementById('btnImageUrl');
  const btnImageEmbed = document.getElementById('btnImageEmbed');
  const imageSizeSelector = document.getElementById('imageSizeSelector');
  const btnSizeSmall = document.getElementById('btnSizeSmall');
  const btnSizeMedium = document.getElementById('btnSizeMedium');
  const btnSizeLarge = document.getElementById('btnSizeLarge');
  const toggleCategories = document.getElementById('toggleCategories');
  const btnSettings = document.getElementById('btnSettings');

  const progressBarFill = document.getElementById('progressBarFill');
  const progressPercent = document.getElementById('progressPercent');
  const currentPageEl = document.getElementById('currentPage');
  const totalPagesEl = document.getElementById('totalPages');
  const totalPagesWrap = document.getElementById('totalPagesWrap');
  const orderCountEl = document.getElementById('orderCount');
  const completeSummary = document.getElementById('completeSummary');

  // Year progress elements
  const yearProgressRow = document.getElementById('yearProgressRow');
  const currentYearLabel = document.getElementById('currentYearLabel');
  const yearIndexEl = document.getElementById('yearIndex');
  const totalYearsEl = document.getElementById('totalYears');

  // ---- State ----
  let exportFormat = { csv: true, pdf: true };
  let exportAllYears = false;
  let includeImages = false;
  let imageMode = 'embedded'; // 'url' or 'embedded'
  let imageSize = 'medium'; // 'small', 'medium', 'large'
  let categorizeItems = false;

  // ---- Display version ----
  const manifest = chrome.runtime.getManifest();
  const versionLabel = document.getElementById('versionLabel');
  if (versionLabel) {
    versionLabel.textContent = 'v' + manifest.version;
  }

  // ---- Initialize ----
  init();

  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnAmazon = tab?.url && (
      tab.url.includes('amazon.com/gp/your-account/order-history') ||
      tab.url.includes('amazon.com/your-orders') ||
      tab.url.includes('amazon.com/gp/css/order-history')
    );

    const state = await getState();

    if (state.scrapingState === 'scraping') {
      showProgressUI(state);
      const yearInfo = state.exportAllYears && state.currentYear
        ? ` (${state.currentYear})`
        : '';
      setStatus('scraping', `Scraping in progress${yearInfo}…`);
    } else if (state.scrapingState === 'complete') {
      showCompleteUI(state);
      setStatus('complete', `Export complete — ${(state.orders || []).length} orders`);
    } else {
      if (isOnAmazon) {
        setStatus('ready', 'Ready to export your order history');
        btnStart.disabled = false;
      } else {
        setStatus('idle', 'Navigate to your Amazon Orders page to begin');
        btnStart.disabled = true;
      }

      if (state.error) {
        setStatus('error', state.error);
      }
    }
  }

  // ---- Format Toggles ----
  btnCsv.addEventListener('click', () => {
    btnCsv.classList.toggle('active');
    exportFormat.csv = btnCsv.classList.contains('active');
    updateStartButtonState();
  });

  btnPdf.addEventListener('click', () => {
    btnPdf.classList.toggle('active');
    exportFormat.pdf = btnPdf.classList.contains('active');
    updateStartButtonState();
  });

  // ---- Export All Years Toggle ----
  toggleAllYears.addEventListener('change', () => {
    exportAllYears = toggleAllYears.checked;
    btnStartLabel.textContent = exportAllYears ? 'Start Full Export' : 'Start Export';
  });

  // ---- Image Options ----
  toggleImages.addEventListener('change', () => {
    includeImages = toggleImages.checked;
    imageModeSelector.classList.toggle('hidden', !includeImages);
    updateImageSizeVisibility();
  });

  btnImageUrl.addEventListener('click', () => {
    imageMode = 'url';
    btnImageUrl.classList.add('active');
    btnImageEmbed.classList.remove('active');
    updateImageSizeVisibility();
  });

  btnImageEmbed.addEventListener('click', () => {
    imageMode = 'embedded';
    btnImageEmbed.classList.add('active');
    btnImageUrl.classList.remove('active');
    updateImageSizeVisibility();
  });

  function updateImageSizeVisibility() {
    // Show size selector only when images are enabled AND embedded mode is selected
    const show = includeImages && imageMode === 'embedded';
    imageSizeSelector.classList.toggle('hidden', !show);
  }

  // Size buttons
  const sizeButtons = [btnSizeSmall, btnSizeMedium, btnSizeLarge];
  for (const btn of sizeButtons) {
    btn.addEventListener('click', () => {
      imageSize = btn.dataset.size;
      sizeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  // ---- Categorize Toggle ----
  toggleCategories.addEventListener('change', () => {
    categorizeItems = toggleCategories.checked;
  });

  // ---- Settings Button ----
  btnSettings.addEventListener('click', async () => {
    try {
      await chrome.runtime.openOptionsPage();
    } catch (e) {
      // Fallback: open options.html directly in a new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    }
  });

  // ---- Merge Reports Link ----
  const btnMerge = document.getElementById('btnMerge');
  if (btnMerge) {
    btnMerge.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('merge.html') });
    });
  }

  function updateStartButtonState() {
    const hasFormat = exportFormat.csv || exportFormat.pdf;
    if (btnStart.dataset.amazonReady === 'true') {
      btnStart.disabled = !hasFormat;
    }
  }

  // ---- Start Export ----
  btnStart.addEventListener('click', async () => {
    btnStart.disabled = true;

    chrome.runtime.sendMessage({
      type: 'START_SCRAPING',
      exportFormat: exportFormat,
      exportAllYears: exportAllYears,
      includeImages: includeImages,
      imageMode: imageMode,
      imageSize: imageSize,
      categorizeItems: categorizeItems,
    });

    showProgressUI({
      currentPage: 1,
      totalPages: null,
      orders: [],
      exportAllYears: exportAllYears,
      currentYear: null,
      currentYearIndex: 0,
      yearQueue: [],
    });
    const statusMsg = exportAllYears
      ? 'Detecting available years…'
      : 'Starting scan…';
    setStatus('scraping', statusMsg);
  });

  // ---- Cancel ----
  btnCancel.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CANCEL_SCRAPING' });
    showControlsUI();
    setStatus('ready', 'Export cancelled');
  });

  // ---- Reset ----
  btnReset.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESET' });
    showControlsUI();
    setStatus('ready', 'Ready to export your order history');
    btnStart.disabled = false;
  });

  // ---- Download Buttons ----
  btnDownloadCsv.addEventListener('click', async () => {
    const state = await getState();
    let orders = state.orders || [];
    if (orders.length > 0) {
      const opts = {
        includeImages: state.includeImages || false,
        imageMode: state.imageMode || 'url',
        imageSize: state.imageSize || 'medium',
        exportAllYears: state.exportAllYears || false,
        categorizeItems: state.categorizeItems || false,
      };

      // Apply categories at export time
      if (opts.categorizeItems) {
        const categories = await CategoryEngine.getCategories();
        orders = CategoryEngine.categorizeOrders(orders, categories);
      }

      ExportEngine.downloadCSV(orders, opts);
    }
  });

  btnDownloadPdf.addEventListener('click', async () => {
    const state = await getState();
    let orders = state.orders || [];
    if (orders.length > 0) {
      const opts = {
        includeImages: state.includeImages || false,
        imageMode: state.imageMode || 'url',
        imageSize: state.imageSize || 'medium',
        exportAllYears: state.exportAllYears || false,
        categorizeItems: state.categorizeItems || false,
      };

      // Apply categories at export time
      let categories = [];
      if (opts.categorizeItems) {
        categories = await CategoryEngine.getCategories();
        orders = CategoryEngine.categorizeOrders(orders, categories);
      }

      // Generate charts for PDF (when applicable)
      if (opts.categorizeItems && opts.exportAllYears) {
        setStatus('scraping', 'Generating charts…');

        // Pie chart: spending by category
        const catStats = CategoryEngine.buildCategoryStats(orders, categories);
        opts.pieChartImage = ChartRenderer.renderPieChart(catStats, {
          title: 'Spending by Category',
        });

        // Bar chart: yearly spending
        const yearStats = ExportEngine._buildYearlyStats(orders);
        opts.barChartImage = ChartRenderer.renderBarChart(yearStats, {
          title: 'Yearly Spending Overview',
        });
      } else if (opts.categorizeItems) {
        // Single year with categories: pie chart only
        const catStats = CategoryEngine.buildCategoryStats(orders, categories);
        opts.pieChartImage = ChartRenderer.renderPieChart(catStats, {
          title: 'Spending by Category',
        });
      }

      if (opts.includeImages && opts.imageMode === 'embedded') {
        // Fetch and convert images to base64 before PDF generation
        setStatus('scraping', 'Downloading product images for PDF…');
        btnDownloadPdf.disabled = true;

        try {
          const imageData = await fetchAllImages(orders);
          ExportEngine.downloadPDF(orders, { ...opts, imageData });
        } catch (err) {
          console.error('[Popup] Image fetch error:', err);
          // Fall back to URL mode
          ExportEngine.downloadPDF(orders, { ...opts, imageMode: 'url' });
        }

        btnDownloadPdf.disabled = false;
        setStatus('complete', `Export complete — ${orders.length} orders`);
      } else {
        ExportEngine.downloadPDF(orders, opts);
      }
    }
  });

  // ---- Fetch images for embedded mode ----
  async function fetchAllImages(orders) {
    const imageData = {}; // url -> base64 data URL
    const uniqueUrls = new Set();

    // Collect unique image URLs
    for (const order of orders) {
      for (const item of (order.items || [])) {
        if (item.imageUrl) {
          uniqueUrls.add(item.imageUrl);
        }
      }
    }

    console.log(`[Popup] Fetching ${uniqueUrls.size} unique product images...`);

    // Fetch in parallel with concurrency limit
    const urls = Array.from(uniqueUrls);
    const batchSize = 5;

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            return { url, dataUrl: await blobToDataUrl(blob) };
          } catch (err) {
            console.warn(`[Popup] Failed to fetch image: ${url}`, err);
            return { url, dataUrl: null };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.dataUrl) {
          imageData[result.value.url] = result.value.dataUrl;
        }
      }
    }

    console.log(`[Popup] Successfully fetched ${Object.keys(imageData).length}/${uniqueUrls.size} images.`);
    return imageData;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ---- Listen for progress updates from background ----
  chrome.runtime.onMessage.addListener((message) => {
    console.log('[Popup] Received message:', message.type, message);

    if (message.type === 'PROGRESS_UPDATE') {
      updateProgress(message);
    } else if (message.type === 'SCRAPING_DONE') {
      handleComplete(message);
    } else if (message.type === 'SCRAPING_ERROR') {
      setStatus('error', message.error || 'An error occurred');
      showControlsUI();
    }
  });

  // ============================================
  // UI Helpers
  // ============================================

  function setStatus(type, text) {
    statusBanner.className = `status-banner status-${type}`;
    statusText.textContent = text;

    if (type === 'ready') {
      btnStart.dataset.amazonReady = 'true';
    } else {
      btnStart.dataset.amazonReady = 'false';
    }
  }

  function showControlsUI() {
    controlsSection.classList.remove('hidden');
    progressSection.classList.add('hidden');
    completeSection.classList.add('hidden');
  }

  function showProgressUI(state) {
    controlsSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    completeSection.classList.add('hidden');

    if (state.exportAllYears) {
      yearProgressRow.classList.remove('hidden');
    } else {
      yearProgressRow.classList.add('hidden');
    }

    updateProgress({
      currentPage: state.currentPage || 1,
      totalPages: state.totalPages || null,
      orderCount: (state.orders || []).length,
      exportAllYears: state.exportAllYears || false,
      currentYear: state.currentYear || null,
      currentYearIndex: state.currentYearIndex || 0,
      totalYears: (state.yearQueue || []).length,
    });
  }

  function showCompleteUI(state) {
    controlsSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    completeSection.classList.remove('hidden');

    const orderCount = (state.orders || []).length;
    const pages = state.currentPage || '?';

    if (state.exportAllYears && state.yearQueue && state.yearQueue.length > 0) {
      const yearCount = state.yearQueue.length;
      completeSummary.textContent = `${orderCount} orders collected across ${yearCount} year${yearCount !== 1 ? 's' : ''}`;
    } else {
      completeSummary.textContent = `${orderCount} orders collected across ${pages} page${pages !== 1 ? 's' : ''}`;
    }

    const fmt = state.exportFormat || { csv: true, pdf: true };
    btnDownloadCsv.classList.toggle('hidden', !fmt.csv);
    btnDownloadPdf.classList.toggle('hidden', !fmt.pdf);
  }

  function updateProgress(data) {
    const page = data.currentPage || 1;
    const total = data.totalPages;
    const orders = data.orderCount || 0;

    currentPageEl.textContent = page;
    orderCountEl.textContent = orders;

    if (data.exportAllYears && data.totalYears > 0) {
      yearProgressRow.classList.remove('hidden');
      currentYearLabel.textContent = data.currentYear || '—';
      yearIndexEl.textContent = (data.currentYearIndex || 0) + 1;
      totalYearsEl.textContent = data.totalYears;
    }

    if (total) {
      totalPagesWrap.classList.remove('hidden');
      totalPagesEl.textContent = total;

      const percent = Math.min(Math.round((page / total) * 100), 100);
      progressBarFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
    } else {
      totalPagesWrap.classList.add('hidden');
      const fakePercent = Math.min(Math.round((1 - 1 / (page + 1)) * 90), 90);
      progressBarFill.style.width = `${fakePercent}%`;
      progressPercent.textContent = `Page ${page}`;
    }

    const yearSuffix = data.exportAllYears && data.currentYear
      ? ` · ${data.currentYear}`
      : '';
    setStatus('scraping', `Scanning page ${page}${total ? ' of ' + total : ''}… ${orders} orders found${yearSuffix}`);
  }

  function handleComplete(data) {
    getState().then((fullState) => {
      showCompleteUI(fullState);
      setStatus('complete', `Export complete — ${(fullState.orders || []).length} orders`);
    });
  }

  function getState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        resolve(response || {});
      });
    });
  }
});
