// ============================================
// Amazon Order History Exporter — Options Page Logic
// Category editor with auto-save
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // ---- Version Label ----
  try {
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) versionLabel.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) { /* ignore */ }

  const categoryList = document.getElementById('categoryList');
  const btnAddCategory = document.getElementById('btnAddCategory');
  const btnResetDefaults = document.getElementById('btnResetDefaults');
  const saveIndicator = document.getElementById('saveIndicator');

  // ---- Merge Reports Link ----
  const btnMerge = document.getElementById('btnMerge');
  if (btnMerge) {
    btnMerge.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('merge.html') });
    });
  }

  let categories = [];
  let saveTimeout = null;

  // ---- Load categories ----
  categories = await CategoryEngine.getCategories();
  renderCategories();

  // ---- Add Category ----
  btnAddCategory.addEventListener('click', () => {
    const newCat = {
      name: 'New Category',
      color: '#' + Math.floor(Math.random() * 0xCCCCCC + 0x333333).toString(16),
      keywords: [],
    };
    categories.push(newCat);
    renderCategories();
    autoSave();

    // Expand and focus the new category
    const cards = categoryList.querySelectorAll('.category-card');
    const lastCard = cards[cards.length - 1];
    if (lastCard) {
      lastCard.classList.add('expanded');
      const nameInput = lastCard.querySelector('.category-name input');
      if (nameInput) {
        nameInput.select();
        nameInput.focus();
      }
    }
  });

  // ---- Reset to Defaults ----
  btnResetDefaults.addEventListener('click', async () => {
    if (confirm('Reset all categories to defaults? Your custom categories will be lost.')) {
      await CategoryEngine.resetToDefaults();
      categories = [...CategoryEngine.DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        keywords: [...c.keywords],
      }))];
      renderCategories();
      showSaved();
    }
  });

  // ---- Render all categories ----
  function renderCategories() {
    categoryList.innerHTML = '';

    categories.forEach((cat, index) => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.index = index;

      card.innerHTML = `
        <div class="category-header">
          <div class="color-swatch" style="background: ${cat.color}">
            <input type="color" value="${cat.color}" title="Change color">
          </div>
          <div class="category-name">
            <input type="text" value="${escapeHtml(cat.name)}" placeholder="Category name">
          </div>
          <span class="keyword-count">${cat.keywords.length} keywords</span>
          <svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <button class="delete-category" title="Delete category">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <div class="category-body">
          <div class="keywords-label">Keywords</div>
          <div class="keywords-container">
            ${cat.keywords.map((kw, ki) => `
              <span class="keyword-chip" data-ki="${ki}">
                ${escapeHtml(kw)}
                <button class="remove-keyword" title="Remove keyword">&times;</button>
              </span>
            `).join('')}
          </div>
          <div class="add-keyword-row">
            <input type="text" placeholder="Add keyword (press Enter or comma-separate multiple)">
            <button>Add</button>
          </div>
        </div>
      `;

      // ---- Event: Toggle expand ----
      const header = card.querySelector('.category-header');
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking inputs or buttons
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.delete-category')) return;
        card.classList.toggle('expanded');
      });

      // ---- Event: Color change ----
      const colorInput = card.querySelector('input[type="color"]');
      colorInput.addEventListener('input', (e) => {
        cat.color = e.target.value;
        card.querySelector('.color-swatch').style.background = e.target.value;
        autoSave();
      });
      colorInput.addEventListener('click', (e) => e.stopPropagation());

      // ---- Event: Name change ----
      const nameInput = card.querySelector('.category-name input');
      nameInput.addEventListener('input', (e) => {
        cat.name = e.target.value;
        autoSave();
      });
      nameInput.addEventListener('click', (e) => e.stopPropagation());

      // ---- Event: Delete category ----
      const deleteBtn = card.querySelector('.delete-category');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (categories.length <= 1) {
          alert('You must have at least one category.');
          return;
        }
        if (confirm(`Delete category "${cat.name}"?`)) {
          categories.splice(index, 1);
          renderCategories();
          autoSave();
        }
      });

      // ---- Event: Remove keyword ----
      card.querySelectorAll('.remove-keyword').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chip = btn.closest('.keyword-chip');
          const ki = parseInt(chip.dataset.ki);
          cat.keywords.splice(ki, 1);
          renderCategories();
          autoSave();
        });
      });

      // ---- Event: Add keyword ----
      const addInput = card.querySelector('.add-keyword-row input');
      const addBtn = card.querySelector('.add-keyword-row button');

      function addKeywords() {
        const value = addInput.value.trim();
        if (!value) return;

        // Support comma-separated keywords
        const newKeywords = value.split(',')
          .map((k) => k.trim().toLowerCase())
          .filter((k) => k && !cat.keywords.includes(k));

        if (newKeywords.length > 0) {
          cat.keywords.push(...newKeywords);
          renderCategories();
          autoSave();

          // Re-expand the card and focus the input
          const updatedCard = categoryList.querySelector(`[data-index="${index}"]`);
          if (updatedCard) {
            updatedCard.classList.add('expanded');
            const input = updatedCard.querySelector('.add-keyword-row input');
            if (input) input.focus();
          }
        }
      }

      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addKeywords();
        }
      });
      addBtn.addEventListener('click', addKeywords);

      categoryList.appendChild(card);
    });
  }

  // ---- Auto-save with debounce ----
  function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await CategoryEngine.saveCategories(categories);
      showSaved();
    }, 500);
  }

  function showSaved() {
    saveIndicator.classList.remove('hidden');
    setTimeout(() => {
      saveIndicator.classList.add('hidden');
    }, 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
