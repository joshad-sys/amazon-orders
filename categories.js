// ============================================
// Amazon Order History Exporter — Category Engine
// Keyword-based item categorization
// ============================================

const CategoryEngine = {
  // ---- Default Categories ----
  // Each category has a name, color (for charts), and keyword list
  // Keywords are matched case-insensitively against item names
  // Longer keyword matches score higher (more specific)
  DEFAULT_CATEGORIES: [
    {
      name: 'Electronics & Computers',
      color: '#4A90D9',
      keywords: [
        'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'usb', 'hdmi',
        'cable', 'charger', 'adapter', 'battery', 'ssd', 'ram', 'ddr5', 'ddr4',
        'gpu', 'cpu', 'processor', 'motherboard', 'router', 'modem', 'wifi',
        'bluetooth', 'speaker', 'headphone', 'earbuds', 'microphone', 'webcam',
        'tablet', 'phone case', 'screen protector', 'power bank', 'surge protector',
        'hard drive', 'flash drive', 'memory card', 'sd card', 'displayport',
        'thunderbolt', 'ethernet', 'dimm', 'so-dimm', 'nvme', 'hub', 'dongle',
        'g.skill', 'corsair', 'logitech', 'anker', 'samsung', 'kingston',
      ],
    },
    {
      name: 'Smart Home',
      color: '#50C878',
      keywords: [
        'thermostat', 'alexa', 'echo dot', 'smart plug', 'smart bulb',
        'smart switch', 'smart lock', 'ring doorbell', 'nest', 'hue',
        'security camera', 'motion sensor', 'zigbee', 'z-wave', 'programmable',
        'wi-fi thermostat', 'home automation', 'smart display', 'honeywell home',
      ],
    },
    {
      name: 'Home & Kitchen',
      color: '#F5A623',
      keywords: [
        'kitchen', 'cookware', 'bakeware', 'utensil', 'pan', 'pot', 'knife',
        'cutting board', 'towel', 'bedding', 'sheet', 'pillow', 'mattress',
        'blanket', 'comforter', 'curtain', 'rug', 'basket', 'organizer',
        'storage bin', 'shelf', 'hook', 'hanger', 'iron', 'steamer',
        'vacuum', 'mop', 'broom', 'sponge', 'cleaning', 'detergent',
        'candle', 'diffuser', 'air freshener', 'light bulb', 'lamp',
        'shower', 'bath', 'toilet', 'faucet', 'sink', 'futon', 'furniture',
        'chair', 'table', 'encasement', 'duvet', 'shower curtain',
        'showershroom', 'drain', 'plunger',
      ],
    },
    {
      name: 'Tools & Hardware',
      color: '#E74C3C',
      keywords: [
        'tool', 'screwdriver', 'drill', 'wrench', 'plier', 'hammer', 'saw',
        'tape measure', 'level', 'socket', 'drill bit', 'bolt', 'nut',
        'screw', 'nail', 'anchor', 'epoxy', 'adhesive', 'sandpaper',
        'paint', 'roller', 'caulk', 'sealant', 'pipe', 'fitting', 'valve',
        'sillcock', 'klein', 'dewalt', 'milwaukee', 'makita', 'ryobi',
        'bosch', 'craftsman', 'stanley', 'channel lock', 'clamp',
        'multimeter', 'stud finder', 'wire stripper',
      ],
    },
    {
      name: 'Garden & Outdoor',
      color: '#27AE60',
      keywords: [
        'garden', 'plant', 'seed', 'soil', 'fertilizer', 'planter', 'hose',
        'sprinkler', 'mower', 'trimmer', 'rake', 'shovel', 'wheelbarrow',
        'mulch', 'weed', 'weeder', 'pest', 'insecticide', 'outdoor',
        'patio', 'deck', 'grill', 'bbq', 'fire pit', 'umbrella', 'gazebo',
        'fence', 'solar light', 'landscape', 'lawn', 'hedge', 'pruner',
        'compost', 'raised bed', 'trellis', 'bird feeder', 'crack weeder',
      ],
    },
    {
      name: 'Sports & Fitness',
      color: '#9B59B6',
      keywords: [
        'sport', 'fitness', 'exercise', 'workout', 'gym', 'weight',
        'dumbbell', 'kettlebell', 'yoga', 'resistance band', 'jump rope',
        'bike', 'bicycle', 'cycling', 'running', 'ball', 'basketball',
        'football', 'soccer', 'baseball', 'tennis', 'golf', 'swim',
        'pickleball', 'paddle', 'racket', 'badminton', 'cornhole',
        'camping', 'tent', 'sleeping bag', 'hiking', 'backpack',
        'water bottle', 'fishing', 'kayak', 'tube', 'self-sealing',
        'scorpion', 'franklin sports', 'pop-a-shot',
      ],
    },
    {
      name: 'Toys & Games',
      color: '#E67E22',
      keywords: [
        'toy', 'game', 'puzzle', 'lego', 'board game', 'card game',
        'action figure', 'doll', 'stuffed animal', 'plush', 'remote control',
        'rc car', 'drone', 'nerf', 'play', 'children', 'hoop', 'light up',
        'dance exercise', 'bounce', 'trampoline', 'swing', 'slide',
        'building blocks', 'craft kit',
      ],
    },
    {
      name: 'Health & Personal Care',
      color: '#1ABC9C',
      keywords: [
        'health', 'vitamin', 'supplement', 'medicine', 'first aid', 'bandage',
        'thermometer', 'blood pressure', 'sunscreen', 'lotion', 'moisturizer',
        'shampoo', 'conditioner', 'body wash', 'toothbrush', 'toothpaste',
        'floss', 'deodorant', 'razor', 'contact lens', 'saline', 'eye drop',
        'mask', 'sanitizer', 'wipe', 'preservative-free', 'purilens',
        'antiseptic', 'ibuprofen', 'acetaminophen', 'allergy',
      ],
    },
    {
      name: 'Clothing & Accessories',
      color: '#3498DB',
      keywords: [
        'shirt', 'pants', 'jeans', 'shorts', 'dress', 'skirt', 'jacket',
        'coat', 'sweater', 'hoodie', 'socks', 'underwear', 'hat', 'cap',
        'scarf', 'glove', 'belt', 'wallet', 'purse', 'watch', 'jewelry',
        'sunglasses', 'shoes', 'boots', 'sandals', 'slippers', 'clogs',
        'sneakers', 'amoji', 'crocs',
      ],
    },
    {
      name: 'Food & Grocery',
      color: '#F39C12',
      keywords: [
        'food', 'snack', 'coffee', 'tea', 'water', 'juice', 'soda', 'candy',
        'chocolate', 'protein bar', 'cereal', 'pasta', 'rice', 'sauce',
        'spice', 'seasoning', 'oil', 'vinegar', 'organic', 'whole foods',
        'grocery', 'pantry', 'frozen', 'gummy', 'chips', 'nuts', 'dried fruit',
        'bread', 'bagel', 'milk', 'cheese', 'yogurt', 'butter', 'cream',
        'egg', 'chicken', 'beef', 'pork', 'salmon', 'shrimp', 'tofu',
        'fruit', 'vegetable', 'produce', 'lettuce', 'tomato', 'apple',
        'banana', 'avocado', 'berry', 'blueberry', 'strawberry', 'grape',
        'orange', 'lemon', 'lime', 'onion', 'potato', 'broccoli', 'carrot',
        'flour', 'sugar', 'baking', 'honey', 'maple syrup', 'jam', 'jelly',
        'ketchup', 'mustard', 'mayonnaise', 'dressing', 'marinade',
        'soup', 'broth', 'canned', 'beans', 'lentil', 'oat', 'granola',
        'cracker', 'cookie', 'popcorn', 'pretzel', 'trail mix',
        'sparkling water', 'kombucha', 'almond milk', 'oat milk', 'soy milk',
        'whole foods market', 'wfm', '365 everyday', '365 by whole foods',
      ],
    },
    {
      name: 'Pet Supplies',
      color: '#E91E63',
      keywords: [
        'pet', 'dog', 'cat', 'fish', 'bird', 'leash', 'collar', 'harness',
        'treat', 'kibble', 'food bowl', 'litter', 'cage', 'aquarium', 'chew toy',
        'squeaky', 'flea', 'tick', 'pet bed', 'crate', 'scratching post',
      ],
    },
    {
      name: 'Books & Media',
      color: '#795548',
      keywords: [
        'book', 'novel', 'textbook', 'guide', 'manual', 'dvd', 'blu-ray',
        'vinyl', 'record', 'cd', 'kindle', 'audiobook', 'magazine', 'comic',
        'manga', 'minilab', 'arturia', 'musical instrument', 'midi',
        'synthesizer', 'guitar', 'piano', 'ukulele', 'microphone stand',
      ],
    },
    {
      name: 'Office & School',
      color: '#607D8B',
      keywords: [
        'office', 'pen', 'pencil', 'marker', 'notebook', 'binder', 'folder',
        'paper', 'stapler', 'tape dispenser', 'scissors', 'calculator',
        'whiteboard', 'calendar', 'planner', 'label maker', 'envelope',
        'stamp', 'printer paper', 'ink cartridge', 'toner',
      ],
    },
    {
      name: 'Automotive',
      color: '#FF5722',
      keywords: [
        'car', 'auto', 'vehicle', 'tire', 'motor oil', 'brake', 'wiper',
        'headlight', 'dash cam', 'seat cover', 'floor mat', 'jump starter',
        'car wash', 'wax', 'polish', 'obd', 'gps mount', 'phone mount',
        'air compressor', 'jack', 'lug wrench',
      ],
    },
  ],

  // ---- Get categories from storage (or use defaults) ----
  async getCategories() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('categories', (result) => {
        resolve(result.categories || this.DEFAULT_CATEGORIES);
      });
    });
  },

  // ---- Save categories to storage ----
  async saveCategories(categories) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ categories }, resolve);
    });
  },

  // ---- Reset to defaults ----
  async resetToDefaults() {
    return this.saveCategories(this.DEFAULT_CATEGORIES);
  },

  // ---- Initialize defaults if not set ----
  async initDefaults() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('categories', (result) => {
        if (!result.categories) {
          chrome.storage.sync.set({ categories: this.DEFAULT_CATEGORIES }, resolve);
        } else {
          resolve();
        }
      });
    });
  },

  // ---- Categorize a single item name ----
  categorize(itemName, categories) {
    if (!itemName || itemName.startsWith('(')) return 'Other';

    const lower = itemName.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const cat of categories) {
      let score = 0;
      for (const keyword of cat.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          // Longer keyword matches are more specific → higher score
          score += keyword.length;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = cat;
      }
    }

    return bestMatch ? bestMatch.name : 'Other';
  },

  // ---- Categorize all items in all orders ----
  categorizeOrders(orders, categories) {
    for (const order of orders) {
      for (const item of (order.items || [])) {
        item.category = this.categorize(item.name, categories);
      }
    }
    return orders;
  },

  // ---- Get color for a category name ----
  getColor(categoryName, categories) {
    const cat = categories.find((c) => c.name === categoryName);
    return cat ? cat.color : '#999999';
  },

  // ---- Build category statistics for charts ----
  buildCategoryStats(orders, categories) {
    const stats = {}; // category name → { count, totalSpend }

    for (const order of orders) {
      for (const item of (order.items || [])) {
        const cat = item.category || 'Other';
        const qty = item.quantity || 1;
        if (!stats[cat]) {
          stats[cat] = { count: 0, totalSpend: 0 };
        }
        stats[cat].count += qty;
        if (item.price) {
          const amt = parseFloat(item.price.replace(/[~$,]/g, ''));
          if (!isNaN(amt)) stats[cat].totalSpend += amt * qty;
        }
      }
    }

    // Sort by spend (descending)
    const sorted = Object.entries(stats)
      .map(([name, data]) => ({
        name,
        color: this.getColor(name, categories),
        count: data.count,
        totalSpend: data.totalSpend,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend);

    return sorted;
  },
};
