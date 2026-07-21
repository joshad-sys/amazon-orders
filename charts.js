// ============================================
// Amazon Order History Exporter — Chart Renderer
// Canvas-based chart rendering for PDF embedding
// Uses 2x resolution for crisp PDF output
// ============================================

const ChartRenderer = {
  // Scale factor for HiDPI / crisp PDF rendering
  SCALE: 2,

  // ---- Render a doughnut/pie chart to a canvas and return base64 ----
  renderPieChart(categoryStats, options = {}) {
    const {
      width = 700,
      height = 440,
      title = 'Spending by Category',
    } = options;

    const S = this.SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = width * S;
    canvas.height = height * S;
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#1A1A2E';
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 30);

    // Calculate total
    const total = categoryStats.reduce((sum, cat) => sum + cat.totalSpend, 0);
    if (total === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px Helvetica, Arial, sans-serif';
      ctx.fillText('No spending data available', width / 2, height / 2);
      return canvas.toDataURL('image/png');
    }

    // Chart dimensions — chart on the left, legend on the right
    const centerX = width * 0.3;
    const centerY = height / 2 + 15;
    const outerRadius = Math.min(width * 0.22, (height - 80) / 2);
    const innerRadius = outerRadius * 0.55;

    // Draw slices
    let startAngle = -Math.PI / 2;
    for (const cat of categoryStats) {
      if (cat.totalSpend === 0) continue;
      const sliceAngle = (cat.totalSpend / total) * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(
        centerX + innerRadius * Math.cos(startAngle),
        centerY + innerRadius * Math.sin(startAngle)
      );
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();

      // White border between slices
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Percentage label (only for slices > 6%)
      const pct = (cat.totalSpend / total) * 100;
      if (pct > 6) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = (outerRadius + innerRadius) / 2;
        const labelX = centerX + labelRadius * Math.cos(midAngle);
        const labelY = centerY + labelRadius * Math.sin(midAngle);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${pct.toFixed(0)}%`, labelX, labelY);
      }

      startAngle += sliceAngle;
    }

    // Center label — clarify this is item prices, not order totals
    ctx.fillStyle = '#1A1A2E';
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '$' + total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      centerX, centerY - 8
    );
    ctx.fillStyle = '#888';
    ctx.font = '10px Helvetica, Arial, sans-serif';
    ctx.fillText('item prices', centerX, centerY + 10);
    ctx.font = '9px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#AAA';
    ctx.fillText('(excl. tax & shipping)', centerX, centerY + 22);

    // Legend — right side, up to 14 entries
    const legendX = width * 0.56;
    let legendY = 55;
    const lineHeight = 26;
    const maxLegendItems = Math.floor((height - 70) / lineHeight);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const displayCats = categoryStats.slice(0, maxLegendItems);
    for (const cat of displayCats) {
      if (cat.totalSpend === 0) continue;
      if (legendY > height - 20) break;

      // Color swatch
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(legendX, legendY - 6, 12, 12, 2);
      ctx.fill();

      // Category name
      ctx.fillStyle = '#333';
      ctx.font = '12px Helvetica, Arial, sans-serif';
      const label = cat.name.length > 22 ? cat.name.substring(0, 20) + '…' : cat.name;
      ctx.fillText(label, legendX + 18, legendY);

      // Amount + percentage
      const pct = ((cat.totalSpend / total) * 100).toFixed(1);
      ctx.fillStyle = '#888';
      ctx.font = '11px Helvetica, Arial, sans-serif';
      ctx.fillText(
        `$${cat.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`,
        legendX + 18,
        legendY + 14
      );

      legendY += lineHeight;
    }

    return canvas.toDataURL('image/png');
  },

  // ---- Render a bar chart to a canvas and return base64 ----
  renderBarChart(yearStats, options = {}) {
    const {
      width = 800,
      height = 400,
      title = 'Yearly Spending Overview',
    } = options;

    const S = this.SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = width * S;
    canvas.height = height * S;
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#1A1A2E';
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 30);

    const years = yearStats.years || [];
    if (years.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px Helvetica, Arial, sans-serif';
      ctx.fillText('No yearly data available', width / 2, height / 2);
      return canvas.toDataURL('image/png');
    }

    // Sort oldest → newest
    const sortedYears = [...years].reverse();
    const numBars = sortedYears.length;

    // Chart area — extra bottom margin for rotated labels
    const needsRotation = numBars > 10;
    const margin = {
      top: 50,
      right: 30,
      bottom: needsRotation ? 70 : 50,
      left: 65,
    };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Find max for Y axis
    const maxSpend = Math.max(...sortedYears.map((y) => y.orderTotal));
    const yMax = this._niceMax(maxSpend);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= gridLines; i++) {
      const y = margin.top + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();

      // Y-axis label
      const value = (yMax * i) / gridLines;
      ctx.fillStyle = '#888';
      ctx.font = '11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + this._formatShortNumber(value), margin.left - 8, y);
    }
    ctx.setLineDash([]);

    // Bars
    const barSpacing = chartW / numBars;
    const barWidth = Math.min(35, barSpacing * 0.65);

    for (let i = 0; i < numBars; i++) {
      const yr = sortedYears[i];
      const barH = yMax > 0 ? (yr.orderTotal / yMax) * chartH : 0;
      const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const y = margin.top + chartH - barH;

      // Bar gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + barH);
      gradient.addColorStop(0, '#FF9900');
      gradient.addColorStop(1, '#E68A00');
      ctx.fillStyle = gradient;

      // Rounded top corners
      ctx.beginPath();
      const r = Math.min(3, barWidth / 4);
      if (barH > r) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barWidth - r, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
        ctx.lineTo(x + barWidth, y + barH);
        ctx.lineTo(x, y + barH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      } else {
        ctx.rect(x, y, barWidth, barH);
      }
      ctx.closePath();
      ctx.fill();

      // Value label — only show if bars aren't too close together
      if (barH > 15 && barSpacing > 25) {
        ctx.fillStyle = '#333';
        ctx.font = `bold ${barSpacing > 35 ? 10 : 8}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          '$' + this._formatShortNumber(yr.orderTotal),
          x + barWidth / 2,
          y - 3
        );
      }

      // Year label
      ctx.fillStyle = '#555';
      ctx.font = `${barSpacing > 35 ? 11 : 9}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (needsRotation) {
        // Rotate year labels 45° to avoid overlap
        ctx.save();
        const lx = x + barWidth / 2;
        const ly = margin.top + chartH + 6;
        ctx.translate(lx, ly);
        ctx.rotate(Math.PI / 5); // ~36 degrees
        ctx.textAlign = 'left';
        ctx.fillText(yr.year, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(yr.year, x + barWidth / 2, margin.top + chartH + 6);
      }
    }

    // Y-axis title
    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#888';
    ctx.font = '11px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Order Totals', 0, 0);
    ctx.restore();

    return canvas.toDataURL('image/png');
  },

  // ---- Render a stacked bar chart for merged data ----
  renderStackedBarChart(yearlyStats, options = {}) {
    const {
      width = 800,
      height = 420,
      labelA = 'Account A',
      labelB = 'Account B',
      colorA = '#FF9900',
      colorB = '#4A90D9',
    } = options;

    const S = this.SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = width * S;
    canvas.height = height * S;
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#1A1A2E';
    ctx.font = 'bold 20px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Combined Yearly Spending', width / 2, 28);

    if (yearlyStats.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px Helvetica, Arial, sans-serif';
      ctx.fillText('No data', width / 2, height / 2);
      return canvas.toDataURL('image/png');
    }

    const numBars = yearlyStats.length;
    const needsRotation = numBars > 10;

    // Chart area
    const margin = {
      top: 55,
      right: 30,
      bottom: needsRotation ? 70 : 50,
      left: 65,
    };
    const chartW = width - margin.left - margin.right;
    const chartH = height - margin.top - margin.bottom;

    // Y-axis max = max combined spend
    const maxCombined = Math.max(
      ...yearlyStats.map((y) => y.aSpend + y.bSpend)
    );
    const yMax = this._niceMax(maxCombined);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);

    for (let i = 0; i <= gridLines; i++) {
      const y = margin.top + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();

      const value = (yMax * i) / gridLines;
      ctx.fillStyle = '#888';
      ctx.font = '11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('$' + this._formatShortNumber(value), margin.left - 8, y);
    }
    ctx.setLineDash([]);

    // Bars
    const barSpacing = chartW / numBars;
    const barWidth = Math.min(35, barSpacing * 0.65);

    for (let i = 0; i < numBars; i++) {
      const yr = yearlyStats[i];
      const combined = yr.aSpend + yr.bSpend;
      const totalH = yMax > 0 ? (combined / yMax) * chartH : 0;
      const hA = yMax > 0 ? (yr.aSpend / yMax) * chartH : 0;
      const hB = totalH - hA;

      const x = margin.left + i * barSpacing + (barSpacing - barWidth) / 2;
      const yBottom = margin.top + chartH;

      // Bottom segment: Account A
      if (hA > 0) {
        ctx.fillStyle = colorA;
        ctx.beginPath();
        if (hB === 0) {
          // Top corners rounded when A is the only/top segment
          const r = Math.min(3, barWidth / 4);
          const yTop = yBottom - hA;
          ctx.moveTo(x + r, yTop);
          ctx.lineTo(x + barWidth - r, yTop);
          ctx.quadraticCurveTo(x + barWidth, yTop, x + barWidth, yTop + r);
          ctx.lineTo(x + barWidth, yBottom);
          ctx.lineTo(x, yBottom);
          ctx.lineTo(x, yTop + r);
          ctx.quadraticCurveTo(x, yTop, x + r, yTop);
        } else {
          ctx.rect(x, yBottom - hA, barWidth, hA);
        }
        ctx.fill();
      }

      // Top segment: Account B
      if (hB > 0) {
        ctx.fillStyle = colorB;
        ctx.beginPath();
        const yTop = yBottom - totalH;
        const r = Math.min(3, barWidth / 4);
        ctx.moveTo(x + r, yTop);
        ctx.lineTo(x + barWidth - r, yTop);
        ctx.quadraticCurveTo(x + barWidth, yTop, x + barWidth, yTop + r);
        ctx.lineTo(x + barWidth, yTop + hB);
        ctx.lineTo(x, yTop + hB);
        ctx.lineTo(x, yTop + r);
        ctx.quadraticCurveTo(x, yTop, x + r, yTop);
        ctx.fill();
      }

      // Value label
      if (totalH > 15 && barSpacing > 25) {
        ctx.fillStyle = '#333';
        ctx.font = `bold ${barSpacing > 35 ? 10 : 8}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
          '$' + this._formatShortNumber(combined),
          x + barWidth / 2,
          margin.top + chartH - totalH - 3
        );
      }

      // Year label
      ctx.fillStyle = '#555';
      ctx.font = `${barSpacing > 35 ? 11 : 9}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (needsRotation) {
        ctx.save();
        const lx = x + barWidth / 2;
        const ly = margin.top + chartH + 6;
        ctx.translate(lx, ly);
        ctx.rotate(Math.PI / 5);
        ctx.textAlign = 'left';
        ctx.fillText(yr.year, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(yr.year, x + barWidth / 2, margin.top + chartH + 6);
      }
    }

    // Y-axis title
    ctx.save();
    ctx.translate(14, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#888';
    ctx.font = '11px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Order Totals', 0, 0);
    ctx.restore();

    // Legend (top right)
    const legendX = width - 180;
    const legendY = 14;

    // Account A swatch
    ctx.fillStyle = colorA;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY - 5, 14, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = '12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelA, legendX + 20, legendY + 2);

    // Account B swatch
    ctx.fillStyle = colorB;
    ctx.beginPath();
    ctx.roundRect(legendX + 90, legendY - 5, 14, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillText(labelB, legendX + 110, legendY + 2);

    return canvas.toDataURL('image/png');
  },

  // ---- Helper: Round up to a nice number for Y-axis ----
  _niceMax(value) {
    if (value <= 0) return 100;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;

    if (normalized <= 1) return magnitude;
    if (normalized <= 2) return 2 * magnitude;
    if (normalized <= 5) return 5 * magnitude;
    return 10 * magnitude;
  },

  // ---- Helper: Format large numbers compactly ----
  _formatShortNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 10000) return (num / 1000).toFixed(0) + 'K';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  },
};
