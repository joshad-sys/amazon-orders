# Chrome Web Store — Submission Reference

All settings and copy used when publishing to the Chrome Web Store. Keep this updated when resubmitting new versions.

---

## Store Listing

**Extension Name:**
```
Amazon Order History Exporter
```

**Summary (132 chars max):**
```
Export your Amazon order history to CSV and PDF. All years, categories, charts, and multi-account merge.
```

**Detailed Description:**
```
Export your entire Amazon order history with one click. The extension automatically walks through every page of your order history, extracting item names, prices, quantities, images, and order totals.

✅ CSV & PDF export with styled tables
✅ Export all years automatically
✅ Item images (embedded or URL)
✅ Quantity detection for multi-quantity orders
✅ Smart category assignment (Electronics, Home & Kitchen, etc.)
✅ Customizable category editor with synced settings
✅ Yearly spending bar chart & category pie chart
✅ Yearly summary table with per-year breakdowns
✅ Merge reports from multiple Amazon accounts
✅ Stacked bar chart for merged account spending
✅ All data stays local — nothing leaves your browser
```

**Category:**
```
Productivity
```

**Language:**
```
English
```

---

## Privacy Tab

### Permission Justifications

**activeTab justification:**
```
The activeTab permission is required to read order data from the Amazon order history page the user is currently viewing. The extension's content script parses the DOM to extract order dates, item names, prices, quantities, and order totals. This only activates when the user clicks the extension icon on an Amazon order history page.
```

**storage justification:**
```
The storage permission is used to save user preferences and settings via chrome.storage.sync. This includes custom item category definitions (category names, keywords, and colors) that the user configures in the extension's options page. Storage is also used to persist export state between popup sessions. No personal or order data is stored.
```

**downloads justification:**
```
The downloads permission is required to save the exported CSV and PDF report files to the user's local Downloads folder. When the user completes an export, the extension generates the files in-browser and triggers a download. This is the core functionality of the extension.
```

**scripting justification:**
```
The scripting permission is used as a fallback to inject the content script into the active Amazon tab if it has not already been loaded. This ensures the extension works reliably when the user navigates to the order history page after installing the extension, without requiring a full page reload.
```

**Host permission justification:**
```
Host access to amazon.com is required because the extension reads order history data directly from the Amazon order history page DOM. The content script runs on amazon.com/gp/your-account/order-history pages to extract order details. Host access is also used to fetch product thumbnail images from Amazon's CDN for embedding in PDF exports.
```

### Remote Code

- **Are you using remote code?** → **No, I am not using remote code**
- All JavaScript (including PapaParse, jsPDF, jsPDF-AutoTable) is bundled locally in the `lib/` folder.

### Data Usage

**What user data do you plan to collect?**
- ☐ Personally identifiable information
- ☐ Health information
- ☐ Financial and payment information
- ☐ Authentication information
- ☐ Personal communications
- ☐ Location
- ☐ Web history
- ☐ User activity
- ☑ **Website content** — the extension reads text and images from Amazon order history pages

**Certifications (check all three):**
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy Policy URL

```
https://github.com/joshad-sys/amazon-orders/blob/main/PRIVACY.md
```

---

## Account Settings

**Trader/Non-trader (EEA):** Non-trader

---

## Graphic Assets

All assets are in `store-assets/`:

| File | Dimensions | Upload To |
|------|-----------|-----------|
| `store-icon-128x128.png` | 128×128 | Store icon |
| `1-popup.png` | 1280×800 | Screenshot 1 |
| `2-pdf-report.png` | 1280×800 | Screenshot 2 |
| `3-charts.png` | 1280×800 | Screenshot 3 |
| `4-merge.png` | 1280×800 | Screenshot 4 |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo tile |

Use `store-assets/resize-image.ps1` to resize new AI-generated images to exact dimensions.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.5.0 | 2026-07-21 | Initial Chrome Web Store submission |
