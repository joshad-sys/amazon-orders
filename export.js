// ============================================
// Amazon Order History Exporter — Export Engine
// Handles CSV and PDF generation
// ============================================

const ExportEngine = {
  get _version() {
    try { return chrome.runtime.getManifest().version; }
    catch (e) { return 'unknown'; }
  },

  // ---- CSV Export ----
  generateCSV(orders, opts = {}) {
    const { includeImages = false, imageMode = 'url', categorizeItems = false } = opts;

    // Flatten orders: one row per item
    const rows = [];

    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const row = {
            'Order Date': order.orderDate || '',
            'Order ID': order.orderId || '',
            'Item Name': item.name || '',
          };

          if (categorizeItems) {
            row['Category'] = item.category || 'Other';
          }

          row['Qty'] = item.quantity || 1;
          row['Item Price'] = item.price || '';
          row['Order Total'] = order.orderTotal || '';
          row['Ship To'] = order.shipTo || '';
          row['Status'] = order.status || '';
          row['Product Link'] = item.link || '';

          if (includeImages && item.imageUrl) {
            if (imageMode === 'embedded') {
              row['Image'] = `=IMAGE("${item.imageUrl}", 2)`;
            } else {
              row['Image URL'] = item.imageUrl;
            }
          } else if (includeImages) {
            row[imageMode === 'embedded' ? 'Image' : 'Image URL'] = '';
          }

          rows.push(row);
        }
      } else {
        const row = {
          'Order Date': order.orderDate || '',
          'Order ID': order.orderId || '',
          'Item Name': '',
        };

        if (categorizeItems) {
          row['Category'] = '';
        }

        row['Qty'] = '';
        row['Item Price'] = '';
        row['Order Total'] = order.orderTotal || '';
        row['Ship To'] = order.shipTo || '';
        row['Status'] = order.status || '';
        row['Product Link'] = '';

        if (includeImages) {
          row[imageMode === 'embedded' ? 'Image' : 'Image URL'] = '';
        }

        rows.push(row);
      }
    }

    // Use PapaParse to convert to CSV
    const csv = Papa.unparse(rows);

    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    return bom + csv;
  },

  downloadCSV(orders, opts = {}) {
    const csvContent = this.generateCSV(orders, opts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = `amazon_orders_${this._dateStamp()}_v${this._version}.csv`;

    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        console.log('[Export] CSV download started, ID:', downloadId);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    );
  },

  // Image size presets (in mm)
  IMAGE_SIZES: {
    small: 8,
    medium: 14,
    large: 20,
  },

  // ---- PDF Export ----
  generatePDF(orders, opts = {}) {
    const { includeImages = false, imageMode = 'url', imageData = {}, imageSize = 'medium' } = opts;
    const embedImages = includeImages && imageMode === 'embedded';
    const maxImgMm = this.IMAGE_SIZES[imageSize] || this.IMAGE_SIZES.medium;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // ---- Title Page / Header ----
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background header bar
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Orange accent line
    doc.setFillColor(255, 153, 0);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Amazon Order History', 14, 14);

    // Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`Generated on ${dateStr}  •  ${orders.length} orders  •  v${this._version}`, 14, 22);

    const showCategories = opts.categorizeItems || false;

    // ---- Build table headers ----
    const tableHeaders = [];
    if (embedImages) tableHeaders.push('');
    tableHeaders.push('Date', 'Order ID', 'Item');
    if (showCategories) tableHeaders.push('Category');
    tableHeaders.push('Qty', 'Item Price', 'Order Total', 'Status');
    if (includeImages && !embedImages) tableHeaders.push('Image URL');

    const tableData = [];
    const imageCells = []; // Track cells that need images drawn

    let rowIndex = 0;
    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          const imgUrl = item.imageUrl || '';
          const hasEmbedImage = embedImages && imgUrl && imageData[imgUrl];

          const row = [];
          if (embedImages) row.push(''); // Image placeholder
          row.push(order.orderDate || '');
          row.push(order.orderId || '');
          row.push(this._truncate(item.name || '', embedImages ? 50 : 60));
          if (showCategories) row.push(item.category || 'Other');
          row.push(item.quantity > 1 ? String(item.quantity) : '1');
          row.push(item.price || '');
          row.push(i === 0 ? (order.orderTotal || '') : '');
          row.push(order.status || '');
          if (includeImages && !embedImages) row.push(this._truncate(imgUrl, 40));

          tableData.push(row);
          if (hasEmbedImage) {
            imageCells.push({ row: rowIndex, col: 0, dataUrl: imageData[imgUrl] });
          }
          rowIndex++;
        }
      } else {
        const row = [];
        if (embedImages) row.push('');
        row.push(order.orderDate || '', order.orderId || '', '');
        if (showCategories) row.push('');
        row.push('', '', order.orderTotal || '', order.status || '');
        if (includeImages && !embedImages) row.push('');
        tableData.push(row);
        rowIndex++;
      }
    }

    // ---- Column Styles (dynamically indexed) ----
    let colIdx = 0;
    const columnStyles = {};

    if (embedImages) {
      columnStyles[colIdx] = { cellWidth: maxImgMm + 6 }; // Image
      colIdx++;
    }
    columnStyles[colIdx++] = { cellWidth: 28 }; // Date
    columnStyles[colIdx++] = { cellWidth: 36 }; // Order ID
    columnStyles[colIdx++] = { cellWidth: 'auto' }; // Item
    if (showCategories) {
      columnStyles[colIdx++] = { cellWidth: 28, fontSize: 7 }; // Category
    }
    columnStyles[colIdx++] = { cellWidth: 12, halign: 'center' }; // Qty
    columnStyles[colIdx++] = { cellWidth: 22, halign: 'right' }; // Item Price
    columnStyles[colIdx++] = { cellWidth: 22, halign: 'right', fontStyle: 'bold' }; // Order Total
    columnStyles[colIdx++] = { cellWidth: 30 }; // Status
    if (includeImages && !embedImages) {
      columnStyles[colIdx++] = { cellWidth: 35, fontSize: 6 }; // Image URL
    }

    // ---- AutoTable ----
    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 34,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        lineColor: [60, 60, 80],
        lineWidth: 0.2,
        textColor: [40, 40, 40],
        valign: 'middle',
        minCellHeight: embedImages ? (maxImgMm + 4) : 8,
      },
      headStyles: {
        fillColor: [26, 26, 46],
        textColor: [255, 200, 100],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
        minCellHeight: 8,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250],
      },
      columnStyles: columnStyles,
      margin: { top: 34, left: 14, right: 14 },
      didDrawCell: (data) => {
        // Embed product images in the image column
        if (embedImages && data.section === 'body' && data.column.index === 0) {
          const cellInfo = imageCells.find((c) => c.row === data.row.index);
          if (cellInfo && cellInfo.dataUrl) {
            try {
              // Determine aspect ratio from the base64 image
              const dims = this._getImageDimensions(cellInfo.dataUrl);
              let imgW = maxImgMm;
              let imgH = maxImgMm;

              if (dims && dims.width > 0 && dims.height > 0) {
                const aspect = dims.width / dims.height;
                if (aspect > 1) {
                  // Landscape: width is max, height scales down
                  imgW = maxImgMm;
                  imgH = maxImgMm / aspect;
                } else {
                  // Portrait or square: height is max, width scales down
                  imgH = maxImgMm;
                  imgW = maxImgMm * aspect;
                }
              }

              const x = data.cell.x + (data.cell.width - imgW) / 2;
              const y = data.cell.y + (data.cell.height - imgH) / 2;
              doc.addImage(cellInfo.dataUrl, 'JPEG', x, y, imgW, imgH);
            } catch (err) {
              console.warn('[Export] Failed to embed image in PDF:', err);
            }
          }
        }
      },
      didDrawPage: (data) => {
        // Footer on every page
        const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
        const totalPagesCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${pageNum} of ${totalPagesCount}`,
          pageWidth - 14,
          pageHeight - 8,
          { align: 'right' }
        );
        doc.text('Amazon Order History Exporter', 14, pageHeight - 8);

        // Re-draw header on subsequent pages
        if (data.pageNumber > 1) {
          doc.setFillColor(26, 26, 46);
          doc.rect(0, 0, pageWidth, 18, 'F');
          doc.setFillColor(255, 153, 0);
          doc.rect(0, 18, pageWidth, 1, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(255, 255, 255);
          doc.text('Amazon Order History (continued)', 14, 12);
        }
      },
    });

    // ---- Summary Section ----
    let finalY = doc.lastAutoTable.finalY || 40;

    if (opts.exportAllYears) {
      // ---- Yearly Breakdown Table ----
      const yearStats = this._buildYearlyStats(orders);

      // Section title
      if (finalY + 40 > pageHeight - 20) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFillColor(26, 26, 46);
      doc.rect(0, finalY + 8, pageWidth, 10, 'F');
      doc.setFillColor(255, 153, 0);
      doc.rect(0, finalY + 18, pageWidth, 1, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('Yearly Summary', 14, finalY + 15);

      // Build table rows
      const summaryData = yearStats.years.map((ys) => [
        ys.year,
        ys.itemCount.toLocaleString(),
        '$' + ys.itemPriceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        '$' + ys.orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]);

      // Grand totals row
      summaryData.push([
        'Grand Total',
        yearStats.grandItemCount.toLocaleString(),
        '$' + yearStats.grandItemPriceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        '$' + yearStats.grandOrderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]);

      doc.autoTable({
        head: [['Year', 'Items Purchased', 'Item Prices Total', 'Order Total']],
        body: summaryData,
        startY: finalY + 22,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 4,
          lineColor: [60, 60, 80],
          lineWidth: 0.2,
          textColor: [40, 40, 40],
          valign: 'middle',
        },
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: [255, 200, 100],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 250],
        },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 40, halign: 'center' },
          2: { cellWidth: 50, halign: 'right' },
          3: { cellWidth: 50, halign: 'right' },
        },
        margin: { left: (pageWidth - 180) / 2, right: (pageWidth - 180) / 2 },
        // Style the Grand Total row differently
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === summaryData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 245, 230];
            data.cell.styles.textColor = [180, 90, 0];
            data.cell.styles.fontSize = 10;
          }
        },
        didDrawPage: (data) => {
          // Footer
          const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
          const totalPagesCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`Page ${pageNum} of ${totalPagesCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
          doc.text('Amazon Order History Exporter', 14, pageHeight - 8);
        },
      });
    } else {
      // ---- Simple summary box for single-year export ----
      if (finalY + 20 < pageHeight - 20) {
        doc.setFillColor(255, 153, 0, 0.08);
        doc.setDrawColor(255, 153, 0);
        doc.setLineWidth(0.3);
        doc.roundedRect(14, finalY + 8, pageWidth - 28, 14, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 130, 0);

        let totalSpend = 0;
        for (const order of orders) {
          if (order.orderTotal) {
            const amt = parseFloat(order.orderTotal.replace(/[$,]/g, ''));
            if (!isNaN(amt)) totalSpend += amt;
          }
        }

        doc.text(
          `Summary: ${orders.length} orders  •  Total spend: $${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          pageWidth / 2,
          finalY + 16.5,
          { align: 'center' }
        );
      }
    }

    // ---- Charts Section ----
    const chartPageHeader = () => {
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setFillColor(255, 153, 0);
      doc.rect(0, 18, pageWidth, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('Spending Analytics', 14, 12);
    };

    // Bar chart: yearly spending (own page)
    if (opts.barChartImage) {
      doc.addPage();
      chartPageHeader();

      // Scale to fill page width with margins, maintain 2:1 aspect ratio
      const barChartW = pageWidth - 28;
      const barChartH = barChartW * 0.5;
      const barChartX = 14;
      doc.addImage(opts.barChartImage, 'PNG', barChartX, 26, barChartW, barChartH);
    }

    // Pie chart: category breakdown (own page)
    if (opts.pieChartImage) {
      doc.addPage();
      chartPageHeader();

      // Scale to fit nicely centered, maintain ~1.6:1 aspect ratio
      const pieChartW = pageWidth - 40;
      const pieChartH = pieChartW * 0.63;
      const pieChartX = 20;
      doc.addImage(opts.pieChartImage, 'PNG', pieChartX, 28, pieChartW, pieChartH);
    }

    return doc;
  },

  downloadPDF(orders, opts = {}) {
    const doc = this.generatePDF(orders, opts);
    const filename = `amazon_orders_${this._dateStamp()}_v${this._version}.pdf`;

    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    chrome.downloads.download(
      {
        url: url,
        filename: filename,
        saveAs: true,
      },
      (downloadId) => {
        console.log('[Export] PDF download started, ID:', downloadId);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    );
  },

  // ---- Helpers ----

  // Build per-year statistics from orders
  _buildYearlyStats(orders) {
    const yearMap = {}; // year -> { itemCount, itemPriceTotal, orderTotal, seenOrderIds }

    for (const order of orders) {
      // Extract year from order date (e.g., "July 10, 2026" → "2026")
      const yearMatch = (order.orderDate || '').match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : 'Unknown';

      if (!yearMap[year]) {
        yearMap[year] = {
          year: year,
          itemCount: 0,
          itemPriceTotal: 0,
          orderTotal: 0,
          seenOrderIds: new Set(),
        };
      }

      const ys = yearMap[year];

      // Count items (factoring in quantity) and sum item prices
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const qty = item.quantity || 1;
          // Only count real items (not placeholders)
          if (item.name && !item.name.startsWith('(')) {
            ys.itemCount += qty;
          }
          if (item.price) {
            const amt = parseFloat(item.price.replace(/[~$,]/g, ''));
            if (!isNaN(amt)) ys.itemPriceTotal += amt * qty;
          }
        }
      }

      // Sum order total only once per unique order ID
      if (order.orderId && !ys.seenOrderIds.has(order.orderId)) {
        ys.seenOrderIds.add(order.orderId);
        if (order.orderTotal) {
          const amt = parseFloat(order.orderTotal.replace(/[$,]/g, ''));
          if (!isNaN(amt)) ys.orderTotal += amt;
        }
      }
    }

    // Sort years newest-first
    const years = Object.values(yearMap)
      .map(({ seenOrderIds, ...rest }) => rest) // Drop the Set before returning
      .sort((a, b) => (b.year === 'Unknown' ? -1 : b.year.localeCompare(a.year)));

    // Grand totals
    const grandItemCount = years.reduce((sum, y) => sum + y.itemCount, 0);
    const grandItemPriceTotal = years.reduce((sum, y) => sum + y.itemPriceTotal, 0);
    const grandOrderTotal = years.reduce((sum, y) => sum + y.orderTotal, 0);

    return { years, grandItemCount, grandItemPriceTotal, grandOrderTotal };
  },

  _dateStamp() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },

  _truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  },

  // Extract image dimensions from base64 data URL (without DOM)
  // Supports JPEG, PNG, GIF headers
  _getImageDimensions(dataUrl) {
    try {
      // Extract the base64 portion
      const base64 = dataUrl.split(',')[1];
      if (!base64) return null;

      // Decode to binary string
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // PNG: width and height at bytes 16-23
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
        return { width, height };
      }

      // GIF: width and height at bytes 6-9 (little-endian)
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        const width = bytes[6] | (bytes[7] << 8);
        const height = bytes[8] | (bytes[9] << 8);
        return { width, height };
      }

      // JPEG: scan for SOF0 marker (0xFF 0xC0) which contains dimensions
      if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
        let i = 2;
        while (i < bytes.length - 9) {
          if (bytes[i] === 0xFF) {
            const marker = bytes[i + 1];
            // SOF0, SOF1, SOF2 markers contain image dimensions
            if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
              const height = (bytes[i + 5] << 8) | bytes[i + 6];
              const width = (bytes[i + 7] << 8) | bytes[i + 8];
              return { width, height };
            }
            // Skip this marker segment
            const segLength = (bytes[i + 2] << 8) | bytes[i + 3];
            i += 2 + segLength;
          } else {
            i++;
          }
        }
      }

      return null;
    } catch (e) {
      console.warn('[Export] Failed to read image dimensions:', e);
      return null;
    }
  },
};
