// Signal that this is a valid web page for DevTools extensions
console.log('🚀 Frontend Post New Tab loaded - DevTools extension available');

// Add extension detection marker
window.__FRONTEND_POST_NEWTAB__ = {
  version: '1.0.0',
  loaded: true,
  timestamp: Date.now(),
  devToolsReady: true
};

// Keyboard shortcut to open DevTools
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    // DevTools will open automatically, show a hint
    console.log('💡 Opening DevTools - Look for "Frontend Post" tab!');
  }
});
