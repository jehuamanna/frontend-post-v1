// Connection Test Utility for debugging Chrome Extension communication
// Use this in browser console to test the connection

export const testConnection = () => {
  console.log('🧪 Starting connection test...');
  
  // Check if we're in extension context
  if (!chrome || !chrome.runtime) {
    console.error('❌ Chrome runtime not available - not in extension context');
    return;
  }
  
  console.log('✅ Chrome runtime available');
  console.log('Extension ID:', chrome.runtime.id);
  
  try {
    // Try to connect to background script
    const port = chrome.runtime.connect({ name: 'devtools-panel' });
    console.log('✅ Port connection established:', port.name);
    
    // Set up listeners
    port.onMessage.addListener((message) => {
      console.log('📨 Test message received:', message);
    });
    
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('🔌 Test port disconnected:', error?.message || 'Clean disconnect');
    });
    
    // Send test message
    const testMessage = {
      type: 'TEST_CONNECTION',
      timestamp: Date.now()
    };
    
    console.log('📤 Sending test message:', testMessage);
    port.postMessage(testMessage);
    
    // Clean up after 5 seconds
    setTimeout(() => {
      console.log('🧹 Cleaning up test connection...');
      port.disconnect();
    }, 5000);
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  }
};

// Auto-run test when imported
if (typeof window !== 'undefined') {
  (window as any).testConnection = testConnection;
  console.log('🧪 Connection test utility loaded. Run testConnection() to test.');
}
