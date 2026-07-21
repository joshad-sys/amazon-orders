# Amazon Order History Exporter

A Chrome extension that exports your Amazon order history to beautifully formatted **CSV** and **PDF** files. Automatically walks through all paginated pages and supports multi-year exports.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-green) ![License MIT](https://img.shields.io/badge/License-MIT-yellow)

## Features

### Core Export
- 📋 **CSV Export** — One row per item, ready for Excel/Google Sheets
- 📄 **PDF Export** — Professional dark-themed report with styled tables
- 📅 **Export All Years** — Automatically cycles through every year in your order history
- ⏳ **Smart Page Loading** — Waits for Amazon pages to fully render before scraping
- 🏷️ **Version Stamped** — Filenames and PDF headers include the extension version

### Data Captured

| Field | Description |
|-------|-------------|
| Order Date | e.g., "July 10, 2026" |
| Order ID | Amazon's `xxx-xxxxxxx-xxxxxxx` format |
| Item Name | Full product name |
| Item Price | Individual item price (estimated with `~` prefix for multi-item orders) |
| Quantity | Detects `Qty: N` for multi-quantity orders |
| Order Total | Total for the order |
| Ship To | Recipient name |
| Status | Delivered, Shipped, Cancelled, Returned, Refunded, etc. |
| Product Link | Direct URL to the product page |
| Category | Auto-assigned via keyword matching (when enabled) |
| Product Image | Embedded in PDF or `=IMAGE()` formula in CSV (when enabled) |

### Order Status Detection

The extension detects and records the following order statuses:

| Status | Included in Export? | Counted in Totals? |
|--------|-------------------|-------------------|
| ✅ Delivered | Yes | Yes |
| 📦 Shipped | Yes | Yes |
| 🚚 Out for delivery | Yes | Yes |
| ⏳ Arriving | Yes | Yes |
| ⏸️ Not yet shipped | Yes | Yes |
| ❌ Cancelled | Yes | Yes |
| ↩️ Returned | Yes | Yes |
| 💰 Refunded | Yes | Yes |

> **Note:** Cancelled, returned, and refunded orders are **included** in exports with their status clearly labeled. They are also counted in spending totals. If you need to exclude them, you can filter by the Status column in Excel/Google Sheets after export.

### Analytics (PDF Report)
- 📊 **Yearly Summary Table** — Items purchased, item price totals, and order totals per year with grand totals
- 📈 **Bar Chart** — Yearly spending overview with adaptive labels
- 🍩 **Doughnut Chart** — Spending breakdown by category with legend

### Merge Reports
- 🔀 **Combine accounts** — Drag and drop two CSV exports (e.g., yours + spouse's) to merge
- 🎨 **Per-account shading** — Different row colors in merged PDF
- 📊 **Stacked Bar Chart** — Combined yearly spending with distinct colors per account
- 🏷️ **Account labels** — Customizable names and chart colors
- 📥 **Dual export** — Download merged data as CSV or PDF

### Settings & Customization
- ⚙️ **Category Editor** — Full CRUD options page to add/remove/rename categories and keywords
- 💾 **Synced Storage** — Categories persist via `chrome.storage.sync` across devices
- 🖼️ **Image Controls** — Choose URL vs. embedded, small/medium/large sizing
- 🔄 **Reset to Defaults** — Restore built-in categories at any time

## Installation

### From Chrome Web Store
*(Coming soon — currently in review)*

### From Source (Developer Mode)
1. Clone this repository:
   ```bash
   git clone https://github.com/joshad-sys/amazon-orders.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the cloned folder
5. Navigate to [Amazon Order History](https://www.amazon.com/gp/your-account/order-history) and click the extension icon

## Usage

### Basic Export
1. Go to your Amazon **Order History** page
2. Click the extension popup icon
3. Choose your format: **CSV**, **PDF**, or both
4. Configure options:
   - **Export All Years** — Cycle through every year automatically
   - **Include Product Images** — Choose embedded or URL mode, and image size
   - **Categorize Items** — Auto-assign categories based on item name keywords
5. Click **Start Export** — the extension walks through every page automatically
6. When complete, download your files

### Merging Reports
1. Export CSVs from two different Amazon accounts
2. Click **Merge Reports** in the popup footer (or from the Settings page)
3. Drag and drop (or browse) both CSV files
4. Customize account labels and chart colors
5. Download the merged CSV or PDF report

### Customizing Categories
1. Click the ⚙️ gear icon in the popup (or right-click extension → Options)
2. Add, remove, or rename categories
3. Edit keyword lists — items are matched case-insensitively, longer keyword matches score higher
4. Changes auto-save and sync across your Chrome devices

## Default Categories

| Category | Example Keywords |
|----------|-----------------|
| Electronics & Computers | laptop, monitor, keyboard, usb, hdmi, charger |
| Smart Home | thermostat, alexa, echo dot, smart plug, ring doorbell |
| Home & Kitchen | cookware, bedding, vacuum, cleaning, furniture |
| Tools & Hardware | drill, wrench, screwdriver, dewalt, milwaukee |
| Garden & Outdoor | plant, soil, hose, mower, patio, grill |
| Sports & Fitness | gym, yoga, cycling, camping, water bottle |
| Toys & Games | lego, puzzle, board game, nerf, trampoline |
| Health & Personal Care | vitamin, sunscreen, shampoo, toothbrush, first aid |
| Clothing & Accessories | shirt, pants, shoes, jacket, watch, jewelry |
| **Food & Grocery** | **whole foods, organic, produce, bread, cheese, coffee** |
| Pet Supplies | dog, cat, leash, treat, litter, chew toy |
| Books & Media | book, kindle, dvd, vinyl, guitar, synthesizer |
| Office & School | pen, notebook, printer paper, stapler, calculator |
| Automotive | car, tire, motor oil, dash cam, wiper, floor mat |

> Items that don't match any category keywords are labeled **"Other"**.

## How It Works

### Scraping Process
1. The content script (`content.js`) is injected into Amazon order history pages
2. It detects order containers using multiple strategies (`.order-card`, `.a-box-group`, `[data-order-id]`, text pattern scanning)
3. For each order, it extracts: date, ID, total, status, ship-to, and individual items
4. Item prices are extracted per-item when available; for orders without individual prices, the order total is distributed evenly across items (marked with `~` prefix)
5. The popup coordinates page navigation — clicking "Next" to walk through all pages
6. In "Export All Years" mode, the popup switches the year filter dropdown and re-scrapes each year

### Supported Amazon Pages
The extension runs on these URL patterns:
- `amazon.com/gp/your-account/order-history*`
- `amazon.com/your-orders/*`
- `amazon.com/gp/css/order-history*`

### Whole Foods & Grocery Orders
Whole Foods purchases appear on your regular Amazon order history and are scraped like any other order. With categories enabled, they're auto-tagged as **Food & Grocery** using keywords like `whole foods market`, `365 everyday`, `organic`, produce names, and more.

### Image Handling
- **URL mode**: Adds `=IMAGE("url")` formulas in CSV for Google Sheets auto-display
- **Embedded mode**: Downloads product thumbnails and embeds them directly in the PDF
- **Size options**: Small (8mm), Medium (12mm), Large (18mm) in the PDF table

## Project Structure

```
amazon-orders/
├── manifest.json          # Chrome Extension manifest (V3)
├── background.js          # Service worker — state management & message routing
├── content.js             # Content script — DOM scraping on Amazon pages
├── popup.html/css/js      # Extension popup UI
├── export.js              # CSV and PDF generation engine
├── categories.js          # Category definitions + keyword matching engine
├── charts.js              # Canvas-based chart rendering (doughnut, bar, stacked bar)
├── options.html/css/js    # Category settings editor page
├── merge.html/css/js      # Multi-account report merge tool
├── lib/                   # Third-party libraries (bundled locally)
│   ├── papaparse.min.js
│   ├── jspdf.umd.min.js
│   └── jspdf.plugin.autotable.min.js
├── icons/                 # Extension icons (16, 48, 128px)
├── store-assets/          # Chrome Web Store graphics & resize script
├── README.md              # This file
├── PRIVACY.md             # Privacy policy
├── LICENSE                # MIT License
└── STORE_SUBMISSION.md    # Chrome Web Store submission reference
```

## Privacy

**All data stays local.** This extension:
- ✅ Only runs on Amazon order history pages
- ✅ Processes everything in your browser
- ✅ Never sends data to any external server
- ✅ No analytics, no tracking, no accounts
- ✅ No remote code — all libraries are bundled locally

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Dependencies

All dependencies are bundled locally in `lib/` — no CDN or network requests:

| Library | Version | Purpose |
|---------|---------|---------|
| [PapaParse](https://www.papaparse.com/) | 5.x | CSV parsing and generation |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.x | PDF document generation |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.x | PDF table formatting |

## License

[MIT](LICENSE)
