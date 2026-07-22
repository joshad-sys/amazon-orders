// ============================================
// Amazon Order History Exporter — Content Script
// Injected into Amazon order history pages
// ============================================

(function () {
  'use strict';

  // Guard against multiple injections
  if (window.__amazonOrderExporterInjected) return;
  window.__amazonOrderExporterInjected = true;

  console.log('[Content] Amazon Order Exporter content script loaded.');

  // ---- Timing constants (adjusted by Fast Mode) ----
  // Defaults are "robust" mode; fast mode uses aggressive values
  let NAVIGATION_DELAY_MS = 2000;   // Delay before navigating to next page
  let PAGE_READY_POLL_MS = 500;     // How often to check if page content has loaded
  let PAGE_READY_TIMEOUT_MS = 15000; // Max time to wait for page content
  let SCRAPE_RETRY_DELAY_MS = 3000; // Wait before retrying if no orders found
  let MAX_SCRAPE_RETRIES = 2;       // Max retries if page seems empty
  let PAGE_READY_GRACE_MS = 500;    // Grace period after content detected

  // Fast Mode values
  const FAST_NAVIGATION_DELAY_MS = 300;
  const FAST_PAGE_READY_POLL_MS = 200;
  const FAST_PAGE_READY_TIMEOUT_MS = 8000;
  const FAST_SCRAPE_RETRY_DELAY_MS = 500;
  const FAST_MAX_SCRAPE_RETRIES = 0;
  const FAST_PAGE_READY_GRACE_MS = 0;

  let isCurrentlyScraping = false;

  // Load fast mode setting from storage
  function applyTimingMode(fastMode) {
    if (fastMode) {
      NAVIGATION_DELAY_MS = FAST_NAVIGATION_DELAY_MS;
      PAGE_READY_POLL_MS = FAST_PAGE_READY_POLL_MS;
      PAGE_READY_TIMEOUT_MS = FAST_PAGE_READY_TIMEOUT_MS;
      SCRAPE_RETRY_DELAY_MS = FAST_SCRAPE_RETRY_DELAY_MS;
      MAX_SCRAPE_RETRIES = FAST_MAX_SCRAPE_RETRIES;
      PAGE_READY_GRACE_MS = FAST_PAGE_READY_GRACE_MS;
      console.log('[Content] ⚡ Fast Mode enabled');
    } else {
      console.log('[Content] 🛡️ Robust Mode (default)');
    }
  }

  // Apply on load
  chrome.storage.local.get('fastMode', (result) => {
    applyTimingMode(result.fastMode === true);
  });

  // ---- Noise words to filter from item names ----
  const ITEM_NAME_BLOCKLIST = [
    'view invoice',
    'view order',
    'view order details',
    'archive order',
    'write a product review',
    'leave seller feedback',
    'buy it again',
    'add to list',
    'track package',
    'return or replace items',
    'share gift receipt',
    'problem with order',
    'leave packaging feedback',
    'get product support',
  ];

  // ---- Message Listener ----
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Received message:', message.type);

    if (message.type === 'BEGIN_SCRAPE') {
      if (!isCurrentlyScraping) {
        beginScrapeWithReadyCheck();
      }
      sendResponse({ ok: true });
    } else if (message.type === 'SWITCH_YEAR') {
      console.log('[Content] Switching to year:', message.year);
      selectYear(message.year);
      sendResponse({ ok: true });
    }
    return false;
  });

  // ---- Auto-resume on page load ----
  chrome.storage.local.get(['scrapingState', 'exportAllYears', 'currentYear'], (result) => {
    if (result.scrapingState === 'scraping' && !isCurrentlyScraping) {
      console.log('[Content] Resuming scrape on new page...');
      if (result.exportAllYears && result.currentYear) {
        console.log(`[Content] In Export All Years mode, current year: ${result.currentYear}`);
      }
      // Wait for page to be fully ready before resuming
      beginScrapeWithReadyCheck();
    }
  });

  // ============================================
  // PAGE READINESS DETECTION
  // ============================================

  async function beginScrapeWithReadyCheck() {
    console.log('[Content] Waiting for page to be fully ready...');

    try {
      await waitForPageReady();
      console.log('[Content] Page is ready, starting scrape.');
      startScraping(0);
    } catch (err) {
      console.warn('[Content] Page readiness timeout, attempting scrape anyway:', err.message);
      startScraping(0);
    }
  }

  function waitForPageReady() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      function check() {
        // Step 1: Wait for document to be fully loaded
        if (document.readyState !== 'complete') {
          if (Date.now() - startTime > PAGE_READY_TIMEOUT_MS) {
            reject(new Error('Page load timeout'));
            return;
          }
          setTimeout(check, PAGE_READY_POLL_MS);
          return;
        }

        // Step 2: Wait for meaningful content to appear in the DOM
        // Look for order containers OR the year filter dropdown
        const hasOrders = document.querySelector(
          '.order-card, .a-box-group, [data-order-id]'
        );
        const hasYearDropdown = document.querySelector(
          'select[name="orderFilter"], select[name="timeFilter"], #orderFilter, #time-filter'
        );
        const hasNoOrdersMessage = document.body.textContent.includes('no orders') ||
          document.body.textContent.includes('0 orders');

        if (hasOrders || hasYearDropdown || hasNoOrdersMessage) {
          // Content is loaded — add a small grace period for any remaining async rendering
          setTimeout(resolve, PAGE_READY_GRACE_MS);
          return;
        }

        // Still waiting for content
        if (Date.now() - startTime > PAGE_READY_TIMEOUT_MS) {
          reject(new Error('Content not found within timeout'));
          return;
        }

        setTimeout(check, PAGE_READY_POLL_MS);
      }

      check();
    });
  }

  // ============================================
  // SCRAPING ENGINE
  // ============================================

  async function startScraping(retryCount) {
    isCurrentlyScraping = true;

    // Check if we were cancelled
    const state = await getState();
    if (state.scrapingState === 'cancelled') {
      console.log('[Content] Scraping was cancelled. Stopping.');
      isCurrentlyScraping = false;
      return;
    }

    // If exportAllYears is true and we haven't detected years yet, do it now
    if (state.exportAllYears && (!state.yearQueue || state.yearQueue.length === 0)) {
      console.log('[Content] Export All Years mode — detecting available years...');
      const years = detectAvailableYears();
      if (years.length > 0) {
        chrome.runtime.sendMessage({
          type: 'YEARS_DETECTED',
          years: years,
        });
        // Background will handle sending SWITCH_YEAR — stop here
        isCurrentlyScraping = false;
        return;
      } else {
        console.warn('[Content] No year options found, falling back to single-page scrape.');
      }
    }

    console.log('[Content] Starting scrape of current page...');

    try {
      // 1. Extract orders from the current page
      const orders = extractOrdersFromPage();
      console.log(`[Content] Found ${orders.length} orders on this page.`);

      // 1b. Retry if no orders found — page may still be loading async content
      if (orders.length === 0 && retryCount < MAX_SCRAPE_RETRIES) {
        console.log(`[Content] No orders found, retrying in ${SCRAPE_RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_SCRAPE_RETRIES})`);
        isCurrentlyScraping = false;
        setTimeout(() => startScraping(retryCount + 1), SCRAPE_RETRY_DELAY_MS);
        return;
      }

      // 2. Detect pagination info
      const paginationInfo = detectPagination();
      const currentPage = paginationInfo.currentPage;
      const totalPages = paginationInfo.totalPages;

      // 3. Send scraped data to background
      chrome.runtime.sendMessage({
        type: 'PAGE_SCRAPED',
        orders: orders,
        currentPage: currentPage,
        totalPages: totalPages,
      });

      // 4. Check for next page
      if (paginationInfo.hasNextPage) {
        // Check cancellation before navigating
        const stateCheck = await getState();
        if (stateCheck.scrapingState === 'cancelled') {
          console.log('[Content] Scraping cancelled before navigation.');
          isCurrentlyScraping = false;
          return;
        }

        console.log(`[Content] Navigating to next page in ${NAVIGATION_DELAY_MS}ms...`);
        setTimeout(() => {
          navigateToNextPage(paginationInfo.nextPageElement);
        }, NAVIGATION_DELAY_MS);
      } else {
        // No more pages for this year/filter
        console.log('[Content] No more pages. Scraping complete for this view!');
        chrome.runtime.sendMessage({
          type: 'SCRAPING_COMPLETE',
          currentPage: currentPage,
        });
        isCurrentlyScraping = false;
      }
    } catch (error) {
      console.error('[Content] Scraping error:', error);
      chrome.runtime.sendMessage({
        type: 'SCRAPING_ERROR',
        error: error.message || 'Failed to scrape the current page.',
      });
      isCurrentlyScraping = false;
    }
  }

  // ============================================
  // YEAR DETECTION & SELECTION
  // ============================================

  function detectAvailableYears() {
    const years = [];

    // Strategy 1: Find the year/time-period dropdown <select>
    const selectors = [
      'select[name="orderFilter"]',
      'select[name="timeFilter"]',
      'select[id*="orderFilter"]',
      'select[id*="time-filter"]',
      'select[id*="dropdown"]',
      '#orderFilter',
      '#time-filter',
    ];

    let selectEl = null;
    for (const sel of selectors) {
      selectEl = document.querySelector(sel);
      if (selectEl) {
        console.log(`[Content] Found year dropdown via: ${sel}`);
        break;
      }
    }

    // Strategy 2: Broader search — find any <select> near "orders placed in" text
    if (!selectEl) {
      const allSelects = document.querySelectorAll('select');
      for (const sel of allSelects) {
        const options = sel.querySelectorAll('option');
        let hasYears = false;
        for (const opt of options) {
          if (/^\d{4}$/.test(opt.value?.trim()) || /^\d{4}$/.test(opt.textContent?.trim())) {
            hasYears = true;
            break;
          }
        }
        if (hasYears) {
          selectEl = sel;
          console.log('[Content] Found year dropdown via broad <select> scan');
          break;
        }
      }
    }

    if (!selectEl) {
      console.warn('[Content] Could not find the year filter dropdown.');
      return years;
    }

    // Extract year options (only 4-digit years, skip "last 30 days" etc.)
    const options = selectEl.querySelectorAll('option');
    for (const opt of options) {
      const value = opt.value?.trim();
      const text = opt.textContent?.trim();
      const yearMatch = (value && value.match(/(\d{4})/)) || (text && text.match(/(\d{4})/));
      if (yearMatch) {
        years.push({
          value: value,
          year: yearMatch[1],
        });
      }
    }

    console.log(`[Content] Detected ${years.length} years:`, years.map((y) => y.year));
    return years.map((y) => y.value);
  }

  function selectYear(yearValue) {
    const selectors = [
      'select[name="orderFilter"]',
      'select[name="timeFilter"]',
      'select[id*="orderFilter"]',
      'select[id*="time-filter"]',
      'select[id*="dropdown"]',
      '#orderFilter',
      '#time-filter',
    ];

    let selectEl = null;
    for (const sel of selectors) {
      selectEl = document.querySelector(sel);
      if (selectEl) break;
    }

    if (!selectEl) {
      const allSelects = document.querySelectorAll('select');
      for (const sel of allSelects) {
        const options = sel.querySelectorAll('option');
        for (const opt of options) {
          if (opt.value?.trim() === yearValue) {
            selectEl = sel;
            break;
          }
        }
        if (selectEl) break;
      }
    }

    if (!selectEl) {
      console.error('[Content] Could not find the year filter dropdown to switch years.');
      chrome.runtime.sendMessage({
        type: 'SCRAPING_ERROR',
        error: 'Could not find the year filter dropdown. The page layout may have changed.',
      });
      return;
    }

    console.log(`[Content] Selecting year: ${yearValue}`);
    selectEl.value = yearValue;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));

    const form = selectEl.closest('form');
    if (form) {
      console.log('[Content] Submitting form to apply year filter...');
      setTimeout(() => {
        form.submit();
      }, 200);
    } else {
      setTimeout(() => {
        const submitBtn = document.querySelector(
          'input[type="submit"], button[type="submit"], .a-button-input'
        );
        if (submitBtn) {
          console.log('[Content] Clicking submit button to apply year filter...');
          submitBtn.click();
        }
      }, 500);
    }
  }

  // ============================================
  // ORDER EXTRACTION
  // ============================================

  function extractOrdersFromPage() {
    const orders = [];
    const orderContainers = findOrderContainers();

    if (orderContainers.length === 0) {
      console.warn('[Content] No order containers found on this page.');
      return orders;
    }

    for (const container of orderContainers) {
      try {
        const order = extractSingleOrder(container);
        if (order && order.orderId) {
          orders.push(order);
        }
      } catch (e) {
        console.warn('[Content] Failed to extract order from container:', e);
      }
    }

    return orders;
  }

  function findOrderContainers() {
    // Strategy 1: Modern Amazon layout uses .order-card
    let containers = document.querySelectorAll('.order-card');
    if (containers.length > 0) {
      console.log('[Content] Found order containers via .order-card');
      return containers;
    }

    // Strategy 2: Older layout uses .a-box-group within order-info
    containers = document.querySelectorAll('.a-box-group.a-spacing-base');
    if (containers.length > 0) {
      const filtered = Array.from(containers).filter(
        (el) => el.textContent && /\d{3}-\d{7}-\d{7}/.test(el.textContent)
      );
      if (filtered.length > 0) {
        console.log('[Content] Found order containers via .a-box-group (filtered)');
        return filtered;
      }
    }

    // Strategy 3: Look for any container with order IDs
    containers = document.querySelectorAll('.a-box-group');
    const filtered = Array.from(containers).filter(
      (el) => el.textContent && /\d{3}-\d{7}-\d{7}/.test(el.textContent)
    );
    if (filtered.length > 0) {
      console.log('[Content] Found order containers via .a-box-group (broad)');
      return filtered;
    }

    // Strategy 4: data-order-id attribute
    containers = document.querySelectorAll('[data-order-id]');
    if (containers.length > 0) {
      console.log('[Content] Found order containers via [data-order-id]');
      return containers;
    }

    // Strategy 5: Scan for order ID patterns in the entire page
    const orderIdElements = findElementsContainingOrderIds();
    if (orderIdElements.length > 0) {
      console.log('[Content] Found order containers via text pattern scan');
      return orderIdElements.map((el) => findOrderAncestor(el));
    }

    return [];
  }

  function findElementsContainingOrderIds() {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (/\d{3}-\d{7}-\d{7}/.test(node.textContent)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        },
      }
    );

    while (walker.nextNode()) {
      results.push(walker.currentNode.parentElement);
    }
    return results;
  }

  function findOrderAncestor(element) {
    let current = element;
    for (let i = 0; i < 10; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;
      if (
        current.classList.contains('a-box-group') ||
        current.classList.contains('order-card') ||
        current.dataset.orderId
      ) {
        return current;
      }
      if (current.offsetWidth > 500 && current.children.length > 2) {
        return current;
      }
    }
    return current;
  }

  function extractSingleOrder(container) {
    const text = container.textContent || '';
    const order = {
      orderId: '',
      orderDate: '',
      items: [],
      orderTotal: '',
      shipTo: '',
      status: '',
    };

    // ---- Order ID ----
    const orderIdMatch = text.match(/(\d{3}-\d{7}-\d{7})/);
    if (orderIdMatch) {
      order.orderId = orderIdMatch[1];
    } else {
      const dataOrderId =
        container.dataset.orderId ||
        container.querySelector('[data-order-id]')?.dataset.orderId;
      if (dataOrderId) {
        order.orderId = dataOrderId;
      }
    }

    // ---- Order Date ----
    const datePatterns = [
      /Order placed\s*\n?\s*(\w+ \d{1,2}, \d{4})/i,
      /Ordered on\s+(\w+ \d{1,2}, \d{4})/i,
      /Order date\s*:?\s*(\w+ \d{1,2}, \d{4})/i,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        order.orderDate = match[1] || match[0];
        break;
      }
    }

    // ---- Order Total ----
    // Strategy 1: Look for the total in the order header section specifically
    // Amazon's order card header has columns: ORDER PLACED | TOTAL | SHIP TO | ORDER #
    order.orderTotal = extractOrderTotal(container);

    // ---- Ship To ----
    const shipToPatterns = [
      /Ship to\s*\n?\s*([A-Z][a-zA-Z\s.'-]+?)(?:\n|$)/i,
      /Deliver to\s*\n?\s*([A-Z][a-zA-Z\s.'-]+?)(?:\n|$)/i,
    ];

    for (const pattern of shipToPatterns) {
      const match = text.match(pattern);
      if (match) {
        order.shipTo = match[1].trim();
        break;
      }
    }

    // ---- Delivery Status ----
    const statusPatterns = [
      /(Delivered\s+\w+\s+\d{1,2}(?:,\s*\d{4})?)/i,
      /(Arriving\s+\w+(?:,?\s+\w+ \d{1,2})?)/i,
      /(Shipped)/i,
      /(Out for delivery)/i,
      /(Cancelled)/i,
      /(Returned?\s+\w+ \d{1,2},?\s*\d{0,4})/i,
      /(Refund\w*)/i,
      /(Not yet shipped)/i,
    ];

    for (const pattern of statusPatterns) {
      const match = text.match(pattern);
      if (match) {
        order.status = match[1].trim();
        break;
      }
    }

    // ---- Items ----
    order.items = extractItems(container);

    // ---- Single-item fallback ----
    // If there's exactly 1 item and no item price was found,
    // use the order total as the item price (they're the same for single-item orders)
    if (order.orderTotal) {
      const itemsWithPrice = order.items.filter((item) => item.price);
      const itemsWithoutPrice = order.items.filter((item) => !item.price);

      if (itemsWithoutPrice.length > 0 && itemsWithPrice.length === 0) {
        // No items got individual prices — distribute order total evenly
        // This is approximate but far better than $0 for spending analysis
        const totalAmt = parseFloat(order.orderTotal.replace(/[$,]/g, ''));
        if (!isNaN(totalAmt) && order.items.length > 0) {
          const totalQty = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
          const perUnit = totalAmt / totalQty;

          for (const item of order.items) {
            const qty = item.quantity || 1;
            const itemTotal = perUnit * qty;
            if (order.items.length === 1) {
              // Single item: use exact order total
              item.price = order.orderTotal;
            } else {
              // Multi-item: mark as estimated with ~ prefix
              item.price = '~$' + itemTotal.toFixed(2);
            }
          }
        }
      }
    }

    return order;
  }

  // ============================================
  // ORDER TOTAL — Improved extraction
  // ============================================

  function extractOrderTotal(container) {
    // Strategy 1: Look for the header section that contains "ORDER PLACED" / "TOTAL"
    // Amazon typically uses .a-box with .a-row elements for the order header
    const headerCandidates = container.querySelectorAll(
      '.a-box .a-row, .a-box .a-column, .order-header, [class*="order-info"]'
    );

    for (const el of headerCandidates) {
      const elText = el.textContent || '';
      // Look for elements that contain "Total" label near a price
      if (/total/i.test(elText) && /\$[\d,]+\.\d{2}/.test(elText)) {
        // Extract the price that follows "Total"
        const totalMatch = elText.match(/(?:Total)\s*\$?([\d,]+\.\d{2})/i);
        if (totalMatch) {
          return '$' + totalMatch[1];
        }
        // Fallback: just grab the price in this element
        const priceMatch = elText.match(/\$([\d,]+\.\d{2})/);
        if (priceMatch) {
          return '$' + priceMatch[1];
        }
      }
    }

    // Strategy 2: Look for a value element that's a sibling/child of a "TOTAL" label
    const allElements = container.querySelectorAll('span, div');
    for (const el of allElements) {
      const txt = (el.textContent || '').trim();
      if (/^total$/i.test(txt)) {
        // Found a "TOTAL" label — look for price in next sibling or parent's next child
        const parent = el.parentElement;
        if (parent) {
          const priceMatch = parent.textContent.match(/\$([\d,]+\.\d{2})/);
          if (priceMatch) {
            return '$' + priceMatch[1];
          }
        }
      }
    }

    // Strategy 3: Regex fallback on full container text
    const text = container.textContent || '';
    const totalPatterns = [
      /(?:Order\s+)?Total\s*:?\s*\$?([\d,]+\.\d{2})/i,
      /Grand\s+Total\s*:?\s*\$?([\d,]+\.\d{2})/i,
    ];

    for (const pattern of totalPatterns) {
      const match = text.match(pattern);
      if (match) {
        return '$' + match[1];
      }
    }

    return '';
  }

  // ============================================
  // ITEM EXTRACTION — Fixed
  // ============================================

  function extractItems(container) {
    const items = [];

    // Strategy 1: Find REAL product links only — NO invoice/summary links
    const productLinks = container.querySelectorAll(
      'a[href*="/dp/"], a[href*="/gp/product/"]'
    );

    const seenNames = new Set();

    for (const link of productLinks) {
      const name = cleanItemName(link.textContent);
      if (name && name.length > 3 && !seenNames.has(name)) {
        seenNames.add(name);

        // Find item-specific price (NOT the order total)
        const price = findItemPrice(link, container);

        // Find product thumbnail image
        const imageUrl = findItemImage(link);

        // Find quantity (e.g. "Qty: 2")
        const quantity = findItemQuantity(link);

        items.push({
          name: name,
          price: price || '',
          quantity: quantity,
          link: link.href || '',
          imageUrl: imageUrl || '',
        });
      }
    }

    // Strategy 2: If no product links found, look for item name patterns
    if (items.length === 0) {
      const titleElements = container.querySelectorAll(
        '.yohtmlc-product-title, .a-link-normal[title], .a-text-bold'
      );

      for (const el of titleElements) {
        const name = cleanItemName(el.textContent || el.title);
        if (name && name.length > 3 && !seenNames.has(name)) {
          seenNames.add(name);
          const imageUrl = findItemImage(el);
          const quantity = findItemQuantity(el);
          items.push({
            name: name,
            price: '',
            quantity: quantity,
            link: el.href || '',
            imageUrl: imageUrl || '',
          });
        }
      }
    }

    // If still no items, create a placeholder
    if (items.length === 0) {
      items.push({
        name: '(Item details not available)',
        price: '',
        quantity: 1,
        link: '',
        imageUrl: '',
      });
    }

    return items;
  }

  // ---- Quantity Extraction ----
  function findItemQuantity(element) {
    // Walk up 4 levels from the product link/element looking for quantity text
    let current = element;
    for (let i = 0; i < 4; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;

      const text = current.textContent || '';

      // Match patterns like "Qty: 2", "Qty:2", "Quantity: 3", "x2", "× 3"
      const qtyMatch = text.match(/(?:Qty|Quantity)\s*:\s*(\d+)/i);
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[1], 10);
        if (qty > 0 && qty < 1000) return qty; // Sanity check
      }
    }

    // Default to 1
    return 1;
  }

  function cleanItemName(text) {
    if (!text) return '';
    let cleaned = text.replace(/\s+/g, ' ').trim();

    // Check against blocklist
    const lower = cleaned.toLowerCase();
    for (const blocked of ITEM_NAME_BLOCKLIST) {
      if (lower === blocked || lower.startsWith(blocked)) {
        return '';
      }
    }

    return cleaned;
  }

  // ============================================
  // ITEM PRICE — Fixed (no longer grabs order total)
  // ============================================

  function findItemPrice(linkElement, orderContainer) {
    // Strategy 1: Look for Amazon's price-specific elements near the link
    // These are safe to trust at 5 levels since they're explicitly price elements
    let current = linkElement;
    for (let i = 0; i < 5; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;

      // Skip if we've reached the order container itself
      if (current === orderContainer) break;

      // Look for Amazon's structured price elements
      const priceEl = current.querySelector(
        'span.a-price .a-offscreen, span.a-color-price, .a-price'
      );
      if (priceEl) {
        const priceText = priceEl.textContent.trim();
        const match = priceText.match(/\$([\d,]+\.\d{2})/);
        if (match) {
          // Double-check it's not inside the order header
          if (!isElementInOrderHeader(priceEl, orderContainer)) {
            return '$' + match[1];
          }
        }
      }
    }

    // Strategy 2: Look for a price in the item's immediate row/container
    // Limited to 3 levels and NOT in the order header section
    current = linkElement;
    for (let i = 0; i < 3; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;

      if (current === orderContainer) break;

      // Skip if this element is the order header
      if (isElementInOrderHeader(current, orderContainer)) {
        continue;
      }

      // Check for a price pattern in just this element's direct text nodes
      // (avoids picking up prices from nested child containers)
      const directText = getDirectTextContent(current);
      const priceMatch = directText.match(/\$([\d,]+\.\d{2})/);
      if (priceMatch) {
        return '$' + priceMatch[1];
      }
    }

    // No item-specific price found
    // (the caller may fall back to order total for single-item orders)
    return '';
  }

  // Get only the direct text of an element, not text from child elements
  function getDirectTextContent(element) {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text;
  }

  function isElementInOrderHeader(element, orderContainer) {
    // Check if the element is within the order header area
    // The header typically contains "ORDER PLACED", "TOTAL", "SHIP TO" labels
    const headerSelectors = [
      '.a-box:first-child',
      '.order-header',
      '[class*="order-info"]',
    ];

    for (const sel of headerSelectors) {
      const header = orderContainer.querySelector(sel);
      if (header && header.contains(element)) {
        return true;
      }
    }

    // Also check by text content
    const parent = element.closest('.a-box');
    if (parent) {
      const parentText = parent.textContent || '';
      if (/ORDER PLACED/i.test(parentText) && /TOTAL/i.test(parentText) && /SHIP TO/i.test(parentText)) {
        return true;
      }
    }

    return false;
  }

  // ============================================
  // ITEM IMAGE — New
  // ============================================

  function findItemImage(linkElement) {
    // Strategy 1: Look for an <img> within the same row/container as the product link
    // Walk up a few levels to find a container that has an image
    let current = linkElement;
    for (let i = 0; i < 5; i++) {
      if (!current.parentElement) break;
      current = current.parentElement;

      const images = current.querySelectorAll('img');
      for (const img of images) {
        const src = img.src || img.dataset.src || '';
        if (isProductImage(src, img)) {
          return src;
        }
      }
    }

    // Strategy 2: Look for a sibling image element
    const parent = linkElement.parentElement;
    if (parent) {
      const siblingImgs = parent.parentElement?.querySelectorAll('img');
      if (siblingImgs) {
        for (const img of siblingImgs) {
          const src = img.src || img.dataset.src || '';
          if (isProductImage(src, img)) {
            return src;
          }
        }
      }
    }

    return '';
  }

  function isProductImage(src, imgElement) {
    if (!src) return false;

    // Must be from Amazon's image CDN
    const isAmazonCdn = /images[-.]amazon|m\.media-amazon|images-na\.ssl-images-amazon/i.test(src);
    if (!isAmazonCdn) return false;

    // Filter out tiny icons (< 30px) and UI chrome
    const width = imgElement.naturalWidth || imgElement.width || 0;
    const height = imgElement.naturalHeight || imgElement.height || 0;
    if (width > 0 && width < 30) return false;
    if (height > 0 && height < 30) return false;

    // Filter out common Amazon UI images (sprites, icons, logos)
    if (/sprite|icon|logo|arrow|star|rating|prime/i.test(src)) return false;

    return true;
  }

  // ============================================
  // PAGINATION
  // ============================================

  function detectPagination() {
    const result = {
      currentPage: 1,
      totalPages: null,
      hasNextPage: false,
      nextPageElement: null,
    };

    // Strategy 1: Look for "Next" link via .a-last
    const nextLink = document.querySelector('.a-last:not(.a-disabled) a');
    if (nextLink) {
      result.hasNextPage = true;
      result.nextPageElement = nextLink;
    }

    // Strategy 2: aria-label based
    if (!result.hasNextPage) {
      const ariaNext = document.querySelector(
        'a[aria-label*="Next"], a[aria-label*="next"]'
      );
      if (ariaNext) {
        result.hasNextPage = true;
        result.nextPageElement = ariaNext;
      }
    }

    // Strategy 3: Text-based "Next" link in pagination
    if (!result.hasNextPage) {
      const paginationLinks = document.querySelectorAll(
        '.a-pagination a, [class*="pagination"] a'
      );
      for (const link of paginationLinks) {
        if (/^\s*next\s*$/i.test(link.textContent)) {
          result.hasNextPage = true;
          result.nextPageElement = link;
          break;
        }
      }
    }

    // Detect current page number
    const activePage = document.querySelector(
      '.a-pagination .a-selected, .a-pagination .a-normal.a-selected'
    );
    if (activePage) {
      const num = parseInt(activePage.textContent.trim(), 10);
      if (!isNaN(num)) result.currentPage = num;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const startIndex = parseInt(urlParams.get('startIndex') || '0', 10);
      if (!isNaN(startIndex)) {
        result.currentPage = Math.floor(startIndex / 10) + 1;
      }
    }

    // Detect total pages
    const paginationItems = document.querySelectorAll(
      '.a-pagination li:not(.a-last):not(.a-disabled)'
    );
    if (paginationItems.length > 0) {
      const lastItem = paginationItems[paginationItems.length - 1];
      const num = parseInt(lastItem.textContent.trim(), 10);
      if (!isNaN(num)) {
        result.totalPages = num;
      }
    }

    if (result.currentPage === 1) {
      const match = window.location.href.match(/[?&](?:page|startIndex)=(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (window.location.href.includes('startIndex')) {
          result.currentPage = Math.floor(val / 10) + 1;
        } else {
          result.currentPage = val;
        }
      }
    }

    console.log('[Content] Pagination:', result);
    return result;
  }

  function navigateToNextPage(nextElement) {
    if (nextElement) {
      console.log('[Content] Clicking next page link...');
      nextElement.click();
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  function getState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (state) => resolve(state));
    });
  }
})();
