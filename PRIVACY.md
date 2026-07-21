# Privacy Policy — Amazon Order History Exporter

**Last updated:** July 21, 2026

## Overview

Amazon Order History Exporter is a Chrome browser extension that helps users export their Amazon order history to CSV and PDF files. **All data processing happens locally in your browser.**

## Data Collection

This extension **does not collect, transmit, or store any personal data** on external servers. Specifically:

- ❌ No analytics or tracking
- ❌ No data sent to any server
- ❌ No user accounts or sign-ups
- ❌ No cookies set by the extension
- ❌ No advertising or third-party integrations

## Data Processing

The extension processes the following data **locally in your browser only**:

- **Order history data**: Order dates, IDs, item names, prices, totals, and shipping addresses are read from Amazon order history pages you visit.
- **Product images**: If you enable image export, product thumbnail URLs are read from the page. Images are fetched directly from Amazon's CDN and embedded in your exported files.
- **Category settings**: Your custom category configurations are stored in Chrome's built-in `chrome.storage.sync`, which syncs across your Chrome browsers. This data never leaves Google's infrastructure.

## Permissions

| Permission | Why It's Needed |
|-----------|----------------|
| `activeTab` | To read order data from the Amazon page you're viewing |
| `storage` | To save export state and category settings |
| `downloads` | To save CSV and PDF files to your computer |
| `scripting` | To inject the content script if it hasn't loaded automatically |
| Host access to `amazon.com` | To read order history and fetch product images |

## Data Storage

- **Export files** (CSV, PDF) are saved to your local Downloads folder. The extension does not retain copies.
- **Settings** (categories, keywords) are stored in `chrome.storage.sync` and can be cleared by uninstalling the extension.
- **No data persists** after you close the extension popup, except your category settings.

## Third-Party Libraries

The extension bundles the following open-source libraries, which run entirely in your browser:

- [PapaParse](https://www.papaparse.com/) — CSV generation (MIT License)
- [jsPDF](https://github.com/parallax/jsPDF) — PDF generation (MIT License)
- [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) — PDF tables (MIT License)

None of these libraries make network requests.

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect data from children.

## Changes to This Policy

Any changes to this privacy policy will be posted in this file and reflected in the extension's store listing.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/joshad-sys/amazon-orders).
