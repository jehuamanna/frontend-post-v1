// Enhanced content script for maximum compatibility including new tabs
console.log('🔧 Frontend Post content script loaded on:', window.location.href);
console.log('🔧 Page details:', {
  url: window.location.href,
  origin: window.location.origin,
  protocol: window.location.protocol,
  hostname: window.location.hostname,
  isNewTab: window.location.href.includes('newtab') || window.location.href.includes('chrome-search')
});

// Inject extension marker for detection
if (typeof window !== 'undefined') {
  (window as any).__FRONTEND_POST_EXTENSION__ = {
    version: '1.0.0',
    loaded: true,
    timestamp: Date.now(),
    url: window.location.href
  };
}

// Enhanced message handling for DevTools communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Content script received message:', message);
  
  switch (message.type) {
    case 'PING':
      sendResponse({ 
        status: 'active', 
        url: window.location.href,
        title: document.title,
        ready: document.readyState
      });
      break;
    case 'GET_PAGE_INFO':
      sendResponse({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        userAgent: navigator.userAgent
      });
      break;
    default:
      sendResponse({ status: 'unknown_message_type' });
  }
  
  return true; // Keep message channel open for async responses
});

// Force extension availability signal for DevTools
try {
  // Signal to background script that content script is ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    url: window.location.href,
    timestamp: Date.now()
  }).catch(() => {
    // Ignore errors if background script isn't ready yet
  });
} catch (e) {
  console.log('Background script not ready yet');
}

// Export empty object to satisfy module requirements
export {};
