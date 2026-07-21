// ============================================
// Amazon Order History Exporter — Background Service Worker
// ============================================

// Centralized state managed in chrome.storage.local
// Schema:
// {
//   scrapingState: 'idle' | 'scraping' | 'complete' | 'cancelled',
//   orders: [ { orderId, orderDate, items: [{name, price}], orderTotal, shipTo, status } ],
//   currentPage: number,
//   totalPages: number | null,
//   exportFormat: { csv: bool, pdf: bool },
//   error: string | null,
//   exportAllYears: bool,
//   yearQueue: string[],           // e.g. ['2026', '2025', ...]
//   currentYearIndex: number,
//   currentYear: string | null,
//   includeImages: bool,
//   imageMode: 'url' | 'embedded',
// }

const DEFAULT_STATE = {
  scrapingState: 'idle',
  orders: [],
  currentPage: 0,
  totalPages: null,
  exportFormat: { csv: true, pdf: true },
  error: null,
  exportAllYears: false,
  yearQueue: [],
  currentYearIndex: 0,
  currentYear: null,
  includeImages: false,
  imageMode: 'embedded',
  imageSize: 'medium',
  categorizeItems: false,
};

// Initialize state on install
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set(DEFAULT_STATE);
  console.log('[Background] Extension installed, state initialized.');
});

// Message handler — relay between popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message.type, message);

  switch (message.type) {
    case 'START_SCRAPING':
      handleStartScraping(message);
      sendResponse({ ok: true });
      break;

    case 'CANCEL_SCRAPING':
      handleCancelScraping();
      sendResponse({ ok: true });
      break;

    case 'PAGE_SCRAPED':
      handlePageScraped(message, sender);
      sendResponse({ ok: true });
      break;

    case 'SCRAPING_COMPLETE':
      handleScrapingComplete(message);
      sendResponse({ ok: true });
      break;

    case 'SCRAPING_ERROR':
      handleScrapingError(message);
      sendResponse({ ok: true });
      break;

    case 'YEARS_DETECTED':
      handleYearsDetected(message);
      sendResponse({ ok: true });
      break;

    case 'GET_STATE':
      chrome.storage.local.get(null, (state) => {
        sendResponse(state);
      });
      return true; // async response

    case 'RESET':
      chrome.storage.local.set(DEFAULT_STATE, () => {
        sendResponse({ ok: true });
      });
      return true;

    case 'GET_ORDERS':
      chrome.storage.local.get(['orders'], (result) => {
        sendResponse({ orders: result.orders || [] });
      });
      return true;

    default:
      console.warn('[Background] Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

async function handleStartScraping(message) {
  const state = {
    scrapingState: 'scraping',
    orders: [],
    currentPage: 0,
    totalPages: null,
    exportFormat: message.exportFormat || { csv: true, pdf: true },
    error: null,
    exportAllYears: message.exportAllYears || false,
    yearQueue: [],
    currentYearIndex: 0,
    currentYear: null,
    includeImages: message.includeImages || false,
    imageMode: message.imageMode || 'embedded',
    imageSize: message.imageSize || 'medium',
    categorizeItems: message.categorizeItems || false,
  };
  await chrome.storage.local.set(state);

  // Find the active Amazon tab and send scrape command
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'BEGIN_SCRAPE' });
    } catch (e) {
      console.error('[Background] Failed to send BEGIN_SCRAPE to tab:', e);
      // Content script may not be injected yet, try injecting it
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        // Wait a moment then try again
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'BEGIN_SCRAPE' });
          } catch (e2) {
            console.error('[Background] Second attempt failed:', e2);
            await chrome.storage.local.set({
              scrapingState: 'idle',
              error: 'Failed to connect to the Amazon page. Please refresh and try again.',
            });
          }
        }, 500);
      } catch (e2) {
        console.error('[Background] Failed to inject content script:', e2);
        await chrome.storage.local.set({
          scrapingState: 'idle',
          error: 'Could not inject content script. Make sure you are on an Amazon order history page.',
        });
      }
    }
  }
}

async function handleCancelScraping() {
  await chrome.storage.local.set({
    scrapingState: 'cancelled',
  });
  console.log('[Background] Scraping cancelled.');
}

async function handlePageScraped(message) {
  const state = await getState();

  // Append new orders (deduplicate by orderId)
  const existingOrders = state.orders || [];
  const newOrders = message.orders || [];

  // Build a set of existing order IDs for dedup
  const existingIds = new Set(existingOrders.map((o) => o.orderId));
  const uniqueNewOrders = newOrders.filter((o) => !existingIds.has(o.orderId));

  const allOrders = [...existingOrders, ...uniqueNewOrders];

  const update = {
    orders: allOrders,
    currentPage: message.currentPage || (state.currentPage + 1),
    totalPages: message.totalPages || state.totalPages,
  };

  await chrome.storage.local.set(update);

  // Broadcast progress to popup
  broadcastToPopup({
    type: 'PROGRESS_UPDATE',
    orderCount: allOrders.length,
    currentPage: update.currentPage,
    totalPages: update.totalPages,
    newOrdersOnPage: uniqueNewOrders.length,
    exportAllYears: state.exportAllYears || false,
    currentYear: state.currentYear || null,
    currentYearIndex: state.currentYearIndex || 0,
    totalYears: (state.yearQueue || []).length,
  });
}

async function handleYearsDetected(message) {
  const years = message.years || [];
  console.log('[Background] Years detected:', years);

  if (years.length === 0) {
    await chrome.storage.local.set({
      scrapingState: 'idle',
      error: 'No year options found on the page. Make sure you are on the Amazon Order History page.',
    });
    broadcastToPopup({
      type: 'SCRAPING_ERROR',
      error: 'No year options found on the page.',
    });
    return;
  }

  // Store the year queue and start with the first year
  const update = {
    yearQueue: years,
    currentYearIndex: 0,
    currentYear: years[0],
    currentPage: 0,
    totalPages: null,
  };
  await chrome.storage.local.set(update);

  console.log(`[Background] Starting with year: ${years[0]}`);

  // Broadcast initial year progress
  broadcastToPopup({
    type: 'PROGRESS_UPDATE',
    orderCount: 0,
    currentPage: 0,
    totalPages: null,
    exportAllYears: true,
    currentYear: years[0],
    currentYearIndex: 0,
    totalYears: years.length,
  });

  // Tell content script to switch to the first year
  await sendToActiveTab({ type: 'SWITCH_YEAR', year: years[0] });
}

async function handleScrapingComplete(message) {
  const state = await getState();
  const orders = state.orders || [];

  // Update current page info
  await chrome.storage.local.set({
    currentPage: message.currentPage || state.currentPage,
  });

  // If we're in "export all years" mode, check if there are more years
  if (state.exportAllYears) {
    const yearQueue = state.yearQueue || [];
    const nextIndex = (state.currentYearIndex || 0) + 1;

    if (nextIndex < yearQueue.length) {
      // More years to process
      const nextYear = yearQueue[nextIndex];
      console.log(`[Background] Year ${state.currentYear} done. Moving to year: ${nextYear} (${nextIndex + 1}/${yearQueue.length})`);

      await chrome.storage.local.set({
        currentYearIndex: nextIndex,
        currentYear: nextYear,
        currentPage: 0,
        totalPages: null,
        scrapingState: 'scraping', // Keep scraping
      });

      // Broadcast year progress
      broadcastToPopup({
        type: 'PROGRESS_UPDATE',
        orderCount: orders.length,
        currentPage: 0,
        totalPages: null,
        exportAllYears: true,
        currentYear: nextYear,
        currentYearIndex: nextIndex,
        totalYears: yearQueue.length,
      });

      // Tell content script to switch to the next year
      await sendToActiveTab({ type: 'SWITCH_YEAR', year: nextYear });
      return;
    }

    // All years done!
    console.log(`[Background] All ${yearQueue.length} years scraped. Total: ${orders.length} orders.`);
  }

  // Mark as complete
  await chrome.storage.local.set({
    scrapingState: 'complete',
    currentPage: message.currentPage || state.currentPage,
  });

  broadcastToPopup({
    type: 'SCRAPING_DONE',
    orderCount: orders.length,
    totalPages: message.currentPage || state.currentPage,
  });
}

async function handleScrapingError(message) {
  await chrome.storage.local.set({
    scrapingState: 'idle',
    error: message.error || 'An unknown error occurred.',
  });

  broadcastToPopup({
    type: 'SCRAPING_ERROR',
    error: message.error,
  });
}

function broadcastToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may be closed, that's fine
  });
}

async function sendToActiveTab(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await chrome.tabs.sendMessage(tabs[0].id, message);
    } else {
      // If no active tab, try to find Amazon order tabs
      const amazonTabs = await chrome.tabs.query({ url: 'https://www.amazon.com/*' });
      if (amazonTabs.length > 0) {
        await chrome.tabs.sendMessage(amazonTabs[0].id, message);
      }
    }
  } catch (e) {
    console.error('[Background] Failed to send message to tab:', e);
  }
}

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (state) => resolve(state));
  });
}
