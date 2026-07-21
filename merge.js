// ============================================
// Amazon Order History Exporter — Merge Engine
// Parses two CSVs and produces combined reports
// ============================================

(function () {
  'use strict';

  const _version = chrome.runtime.getManifest().version;
  const _versionLabel = document.getElementById('versionLabel');
  if (_versionLabel) _versionLabel.textContent = 'v' + _version;

  // ---- State ----
  let dataA = null; // { rows: [...], fileName, label, color }
  let dataB = null;

  // ---- DOM refs ----
  const dropZoneA = document.getElementById('dropZoneA');
  const dropZoneB = document.getElementById('dropZoneB');
  const fileInputA = document.getElementById('fileInputA');
  const fileInputB = document.getElementById('fileInputB');
  const fileInfoA = document.getElementById('fileInfoA');
  const fileInfoB = document.getElementById('fileInfoB');
  const fileNameA = document.getElementById('fileNameA');
  const fileNameB = document.getElementById('fileNameB');
  const orderCountA = document.getElementById('orderCountA');
  const orderCountB = document.getElementById('orderCountB');
  const removeA = document.getElementById('removeA');
  const removeB = document.getElementById('removeB');
  const labelA = document.getElementById('labelA');
  const labelB = document.getElementById('labelB');
  const colorA = document.getElementById('colorA');
  const colorB = document.getElementById('colorB');
  const duplicateWarning = document.getElementById('duplicateWarning');
  const duplicateText = document.getElementById('duplicateText');
  const previewSection = document.getElementById('previewSection');
  const totalOrders = document.getElementById('totalOrders');
  const totalItems = document.getElementById('totalItems');
  const totalSpend = document.getElementById('totalSpend');
  const yearRange = document.getElementById('yearRange');
  const btnMergeCSV = document.getElementById('btnMergeCSV');
  const btnMergePDF = document.getElementById('btnMergePDF');
  const versionLabel = document.getElementById('versionLabel');

  // ---- Version display ----
  if (versionLabel && chrome?.runtime?.getManifest) {
    versionLabel.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  // ---- Drag & Drop Setup ----
  [
    { zone: dropZoneA, input: fileInputA, side: 'A' },
    { zone: dropZoneB, input: fileInputB, side: 'B' },
  ].forEach(({ zone, input, side }) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        handleFile(file, side);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        handleFile(e.target.files[0], side);
      }
    });
  });

  // ---- Remove buttons ----
  removeA.addEventListener('click', () => clearSide('A'));
  removeB.addEventListener('click', () => clearSide('B'));

  // ---- Export buttons ----
  btnMergeCSV.addEventListener('click', exportMergedCSV);
  btnMergePDF.addEventListener('click', exportMergedPDF);

  // ---- Handle file selection ----
  function handleFile(file, side) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        console.warn('[Merge] CSV parse warnings:', parsed.errors);
      }

      const rows = parsed.data;
      const fileData = { rows, fileName: file.name };

      if (side === 'A') {
        dataA = fileData;
        showFileInfo('A', file.name, rows);
      } else {
        dataB = fileData;
        showFileInfo('B', file.name, rows);
      }

      updatePreview();
    };
    reader.readAsText(file);
  }

  // ---- Show file info badge ----
  function showFileInfo(side, fileName, rows) {
    const info = side === 'A' ? fileInfoA : fileInfoB;
    const nameEl = side === 'A' ? fileNameA : fileNameB;
    const countEl = side === 'A' ? orderCountA : orderCountB;
    const zone = side === 'A' ? dropZoneA : dropZoneB;

    nameEl.textContent = fileName;

    // Count unique orders and items
    const orderIds = new Set(rows.map((r) => r['Order ID']).filter(Boolean));
    const itemCount = rows.filter((r) => r['Item Name'] && r['Item Name'].length > 0).length;

    countEl.textContent = `${orderIds.size} orders • ${itemCount} items`;

    zone.classList.add('loaded');
    info.classList.remove('hidden');
  }

  // ---- Clear a side ----
  function clearSide(side) {
    if (side === 'A') {
      dataA = null;
      fileInfoA.classList.add('hidden');
      dropZoneA.classList.remove('loaded');
      fileInputA.value = '';
    } else {
      dataB = null;
      fileInfoB.classList.add('hidden');
      dropZoneB.classList.remove('loaded');
      fileInputB.value = '';
    }
    updatePreview();
  }

  // ---- Update merge preview ----
  function updatePreview() {
    if (!dataA || !dataB) {
      previewSection.classList.add('hidden');
      duplicateWarning.classList.add('hidden');
      return;
    }

    // Check for duplicates
    const idsA = new Set(dataA.rows.map((r) => r['Order ID']).filter(Boolean));
    const idsB = new Set(dataB.rows.map((r) => r['Order ID']).filter(Boolean));
    let dupeCount = 0;
    for (const id of idsB) {
      if (idsA.has(id)) dupeCount++;
    }

    if (dupeCount > 0) {
      duplicateWarning.classList.remove('hidden');
      duplicateText.textContent = `${dupeCount} duplicate order ID(s) found. These will be kept from both accounts but flagged.`;
    } else {
      duplicateWarning.classList.add('hidden');
    }

    // Combined stats
    const allRows = [...dataA.rows, ...dataB.rows];
    const allOrderIds = new Set(allRows.map((r) => r['Order ID']).filter(Boolean));
    const allItems = allRows.filter((r) => r['Item Name'] && r['Item Name'].length > 0);

    // Total spend from Order Total column (unique order IDs)
    let spend = 0;
    const seenOrders = new Set();
    for (const row of allRows) {
      const id = row['Order ID'];
      if (id && !seenOrders.has(id)) {
        seenOrders.add(id);
        const val = parseFloat((row['Order Total'] || '').replace(/[~$,]/g, ''));
        if (!isNaN(val)) spend += val;
      }
    }

    // Year range
    const years = allRows
      .map((r) => {
        const m = (r['Order Date'] || '').match(/(\d{4})/);
        return m ? parseInt(m[1]) : null;
      })
      .filter(Boolean);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);

    totalOrders.textContent = allOrderIds.size.toLocaleString();
    totalItems.textContent = allItems.length.toLocaleString();
    totalSpend.textContent = '$' + spend.toLocaleString('en-US', { minimumFractionDigits: 2 });
    yearRange.textContent = years.length > 0 ? `${minYear} – ${maxYear}` : '-';

    previewSection.classList.remove('hidden');
  }

  // ---- Build merged rows with Account column ----
  function buildMergedRows() {
    const lA = labelA.value || 'Account A';
    const lB = labelB.value || 'Account B';

    const tag = (rows, label) =>
      rows.map((row) => {
        const r = { Account: label };
        for (const key of Object.keys(row)) {
          r[key] = row[key];
        }
        return r;
      });

    const merged = [...tag(dataA.rows, lA), ...tag(dataB.rows, lB)];

    // Sort by date (newest first)
    merged.sort((a, b) => {
      const dA = new Date(a['Order Date'] || '');
      const dB = new Date(b['Order Date'] || '');
      return dB - dA;
    });

    return merged;
  }

  // ---- Export Merged CSV ----
  function exportMergedCSV() {
    if (!dataA || !dataB) return;
    const merged = buildMergedRows();
    const csv = Papa.unparse(merged);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon_orders_merged_${dateStamp()}_v${_version}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Export Merged PDF ----
  function exportMergedPDF() {
    if (!dataA || !dataB) return;

    const lA = labelA.value || 'Account A';
    const lB = labelB.value || 'Account B';
    const cA = colorA.value || '#FF9900';
    const cB = colorB.value || '#4A90D9';

    const merged = buildMergedRows();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // ---- Page 1: Header + Table ----
    // Dark header bar
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(255, 153, 0);
    doc.rect(0, 28, pageWidth, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('Amazon Order History — Merged Report', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`Generated on ${dateStr}  •  ${lA} + ${lB}  •  v${_version}`, 14, 22);

    // ---- Build table data ----
    const hasCategory = merged.some((r) => r['Category']);
    const hasQty = merged.some((r) => r['Qty']);

    const tableHeaders = ['Account', 'Date', 'Order ID', 'Item'];
    if (hasCategory) tableHeaders.push('Category');
    if (hasQty) tableHeaders.push('Qty');
    tableHeaders.push('Item Price', 'Order Total', 'Status');

    const tableData = merged.map((row) => {
      const r = [
        row['Account'] || '',
        row['Order Date'] || '',
        row['Order ID'] || '',
        truncate(row['Item Name'] || '', 50),
      ];
      if (hasCategory) r.push(row['Category'] || '');
      if (hasQty) r.push(row['Qty'] || '');
      r.push(row['Item Price'] || '', row['Order Total'] || '', row['Status'] || '');
      return r;
    });

    // Column styles
    let colIdx = 0;
    const columnStyles = {};
    columnStyles[colIdx++] = { cellWidth: 25, fontSize: 7 }; // Account
    columnStyles[colIdx++] = { cellWidth: 26 }; // Date
    columnStyles[colIdx++] = { cellWidth: 34 }; // Order ID
    columnStyles[colIdx++] = { cellWidth: 'auto' }; // Item
    if (hasCategory) columnStyles[colIdx++] = { cellWidth: 26, fontSize: 7 };
    if (hasQty) columnStyles[colIdx++] = { cellWidth: 12, halign: 'center' };
    columnStyles[colIdx++] = { cellWidth: 22, halign: 'right' }; // Item Price
    columnStyles[colIdx++] = { cellWidth: 22, halign: 'right', fontStyle: 'bold' }; // Order Total
    columnStyles[colIdx++] = { cellWidth: 28 }; // Status

    // Parse colors for row shading
    const rgbA = hexToRgb(cA);
    const rgbB = hexToRgb(cB);

    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 36,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 3,
        lineColor: [60, 60, 80],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [26, 26, 46],
        textColor: [255, 200, 100],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles,
      didParseCell(data) {
        if (data.section === 'body') {
          const account = data.row.raw[0];
          const isA = account === lA;
          const rgb = isA ? rgbA : rgbB;
          const isEvenRow = data.row.index % 2 === 0;

          // Subtle tint based on account
          const alpha = isEvenRow ? 0.06 : 0.12;
          data.cell.styles.fillColor = [
            Math.round(255 * (1 - alpha) + rgb.r * alpha),
            Math.round(255 * (1 - alpha) + rgb.g * alpha),
            Math.round(255 * (1 - alpha) + rgb.b * alpha),
          ];
          data.cell.styles.textColor = [40, 40, 60];
        }
      },
      margin: { top: 36, bottom: 20, left: 10, right: 10 },
      didDrawPage(data) {
        // Footer on every page
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFillColor(26, 26, 46);
        doc.rect(0, pageH - 12, pageWidth, 12, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 170);
        doc.text('Amazon Order History Exporter — Merged Report', 14, pageH - 4);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          pageWidth - 14,
          pageH - 4,
          { align: 'right' }
        );
      },
    });

    // ---- Yearly Summary Table ----
    const yearlyStats = buildMergedYearlyStats(merged, lA, lB);

    if (yearlyStats.length > 0) {
      doc.addPage();

      // Header
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setFillColor(255, 153, 0);
      doc.rect(0, 18, pageWidth, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('Yearly Summary — Per Account', 14, 12);

      // Summary table headers
      const summaryHeaders = [
        'Year',
        `${lA} Items`,
        `${lA} Spend`,
        `${lB} Items`,
        `${lB} Spend`,
        'Combined Items',
        'Combined Spend',
      ];

      const summaryData = yearlyStats.map((yr) => [
        yr.year,
        yr.aItems.toLocaleString(),
        '$' + yr.aSpend.toFixed(2),
        yr.bItems.toLocaleString(),
        '$' + yr.bSpend.toFixed(2),
        (yr.aItems + yr.bItems).toLocaleString(),
        '$' + (yr.aSpend + yr.bSpend).toFixed(2),
      ]);

      // Grand totals
      const grandA = yearlyStats.reduce((s, y) => s + y.aSpend, 0);
      const grandB = yearlyStats.reduce((s, y) => s + y.bSpend, 0);
      const grandAItems = yearlyStats.reduce((s, y) => s + y.aItems, 0);
      const grandBItems = yearlyStats.reduce((s, y) => s + y.bItems, 0);

      summaryData.push([
        'Grand Total',
        grandAItems.toLocaleString(),
        '$' + grandA.toFixed(2),
        grandBItems.toLocaleString(),
        '$' + grandB.toFixed(2),
        (grandAItems + grandBItems).toLocaleString(),
        '$' + (grandA + grandB).toFixed(2),
      ]);

      doc.autoTable({
        head: [summaryHeaders],
        body: summaryData,
        startY: 26,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 4,
          lineColor: [60, 60, 80],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: [255, 200, 100],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 30 },
          1: { halign: 'right', cellWidth: 30 },
          2: { halign: 'right', cellWidth: 35 },
          3: { halign: 'right', cellWidth: 30 },
          4: { halign: 'right', cellWidth: 35 },
          5: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
          6: { halign: 'right', cellWidth: 40, fontStyle: 'bold' },
        },
        didParseCell(data) {
          if (data.section === 'body') {
            const isLast = data.row.index === summaryData.length - 1;
            if (isLast) {
              data.cell.styles.fillColor = [255, 248, 230];
              data.cell.styles.textColor = [200, 100, 0];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor =
                data.row.index % 2 === 0 ? [248, 248, 255] : [255, 255, 255];
              data.cell.styles.textColor = [40, 40, 60];
            }
          }
        },
      });
    }

    // ---- Stacked Bar Chart ----
    if (yearlyStats.length > 0) {
      const barImg = ChartRenderer.renderStackedBarChart(yearlyStats, {
        labelA: lA,
        labelB: lB,
        colorA: cA,
        colorB: cB,
        width: 800,
        height: 420,
      });

      doc.addPage();
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, pageWidth, 18, 'F');
      doc.setFillColor(255, 153, 0);
      doc.rect(0, 18, pageWidth, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('Spending Analytics — Combined', 14, 12);

      const chartW = pageWidth - 28;
      const chartH = chartW * 0.525;
      doc.addImage(barImg, 'PNG', 14, 26, chartW, chartH);
    }

    // ---- Save ----
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amazon_orders_merged_${dateStamp()}_v${_version}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Build yearly stats per account ----
  function buildMergedYearlyStats(mergedRows, labelA, labelB) {
    const yearMap = {}; // year -> { aItems, aSpend, bItems, bSpend, seenA, seenB }

    for (const row of mergedRows) {
      const yearMatch = (row['Order Date'] || '').match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : 'Unknown';
      const account = row['Account'] || '';

      if (!yearMap[year]) {
        yearMap[year] = {
          year,
          aItems: 0,
          aSpend: 0,
          bItems: 0,
          bSpend: 0,
          seenA: new Set(),
          seenB: new Set(),
        };
      }

      const ys = yearMap[year];
      const isA = account === labelA;
      const seenSet = isA ? ys.seenA : ys.seenB;

      // Count items (by quantity)
      const qty = parseInt(row['Qty']) || 1;
      const itemName = row['Item Name'] || '';
      if (itemName && !itemName.startsWith('(')) {
        if (isA) ys.aItems += qty;
        else ys.bItems += qty;
      }

      // Sum order totals (unique per order per account)
      const orderId = row['Order ID'] || '';
      if (orderId && !seenSet.has(orderId)) {
        seenSet.add(orderId);
        const amt = parseFloat((row['Order Total'] || '').replace(/[~$,]/g, ''));
        if (!isNaN(amt)) {
          if (isA) ys.aSpend += amt;
          else ys.bSpend += amt;
        }
      }
    }

    // Sort years oldest-first (for chart display)
    return Object.values(yearMap)
      .map(({ seenA, seenB, ...rest }) => rest)
      .sort((a, b) => (a.year === 'Unknown' ? 1 : a.year.localeCompare(b.year)));
  }

  // ---- Helpers ----
  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function truncate(str, max) {
    return str.length <= max ? str : str.substring(0, max - 1) + '…';
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 153, b: 0 };
  }
})();
