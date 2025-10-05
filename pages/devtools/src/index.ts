// Simple and reliable DevTools panel creation
console.log('🚀 Frontend Post DevTools Extension Loading...');

// Create panel immediately without complex error handling
chrome.devtools.panels.create(
  'Frontend Post', 
  '/icon-34.png', 
  '/devtools-panel/index.html',
  (panel) => {
    console.log('✅ Frontend Post panel created successfully');
    
    if (panel) {
      panel.onShown.addListener(() => {
        console.log('📱 Frontend Post panel shown');
      });
      
      panel.onHidden.addListener(() => {
        console.log('📱 Frontend Post panel hidden');
      });
    }
  }
);

// Enhanced inspected window info logging
console.log('🔍 Inspected Window Info:', {
  tabId: chrome.devtools.inspectedWindow.tabId,
  evalAvailable: typeof chrome.devtools.inspectedWindow.eval === 'function'
});

// Try to detect content script presence
chrome.devtools.inspectedWindow.eval(
  `window.__FRONTEND_POST_EXTENSION__`,
  (result, isException) => {
    if (result) {
      console.log('✅ Content script detected:', result);
    } else if (isException) {
      console.log('⚠️ Limited page access - this is normal for chrome:// pages');
    } else {
      console.log('⚠️ Content script not detected yet');
    }
  }
);
