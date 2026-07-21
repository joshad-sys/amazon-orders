# Amazon Order History Exporter

A Chrome extension that exports your Amazon order history to beautifully formatted **CSV** and **PDF** files. Automatically walks through all paginated pages and supports multi-year exports.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## Features

### Core Export
- 📋 **CSV Export** — One row per item, ready for Excel/Google Sheets
- 📄 **PDF Export** — Professional dark-themed report with styled tables
- 📅 **Export All Years** — Automatically cycles through every year in your order history
- ⏳ **Smart Page Loading** — Waits for Amazon pages to fully render before scraping

### Data Captured
- Order date, ID, status, ship-to address
- Item name, individual price, order total
- Product link
- **Quantity** — Detects `Qty: N` for multi-quantity orders
- **Item images** — Embed actual product images in PDF or `=IMAGE()` formulas in CSV
- **Categories** — AI-style keyword matching assigns items to categories (Electronics, Home & Kitchen, etc.)

### Analytics (PDF)
- 📊 **Yearly Summary Table** — Items purchased, item price totals, and order totals per year with grand totals
- 📈 **Bar Chart** — Yearly spending overview with adaptive labels
- 🍩 **Doughnut Chart** — Spending breakdown by category with legend

### Merge Reports
- 🔀 **Combine accounts** — Drag and drop two CSV exports (e.g., yours + spouse's) to merge
- 🎨 **Per-account shading** — Different row colors in merged PDF
- 📊 **Stacked Bar Chart** — Combined yearly spending with distinct colors per account
- 🏷️ **Account labels** — Customizable names and chart colors

### Settings
- ⚙️ **Category Editor** — Full CRUD options page to add/remove/rename categories and keywords
- 💾 **Synced Storage** — Categories persist via `chrome.storage.sync` across devices
- 🖼️ **Image Controls** — Choose URL vs. embedded, small/medium/large sizing

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/amazon-orders.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the cloned folder
5. Navigate to [Amazon Order History](https://www.amazon.com/gp/your-account/order-history) and click the extension icon

## Usage

1. Go to your Amazon **Order History** page
2. Click the extension popup icon
3. Select export options (CSV, PDF, images, categories, all years)
4. Click **Start Export** — the extension walks through every page automatically
5. When complete, download your files

### Merging Reports
1. Export CSVs from two different Amazon accounts
2. Click **Merge Reports** in the popup footer
3. Drop both CSVs, customize labels/colors, and download the merged report

## Project Structure

```
amazon-orders/
├── manifest.json        # Chrome Extension manifest (V3)
├── background.js        # Service worker — state management & message routing
├── content.js           # Content script — DOM scraping on Amazon pages
├── popup.html/css/js    # Extension popup UI
├── export.js            # CSV and PDF generation engine
├── categories.js        # Category definitions + keyword matching
├── charts.js            # Canvas-based chart rendering (pie, bar, stacked bar)
├── options.html/css/js  # Category settings editor page
├── merge.html/css/js    # Report merge tool page
├── lib/                 # Third-party libraries
│   ├── papaparse.min.js
│   ├── jspdf.umd.min.js
│   └── jspdf.plugin.autotable.min.js
└── icons/               # Extension icons (16, 48, 128px)
```

## Privacy

**All data stays local.** This extension:
- ✅ Only runs on Amazon order history pages
- ✅ Processes everything in your browser
- ✅ Never sends data to any external server
- ✅ No analytics, no tracking, no accounts

## Dependencies

- [PapaParse](https://www.papaparse.com/) — CSV parsing/generation
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation
- [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) — PDF table formatting

## License

MIT
