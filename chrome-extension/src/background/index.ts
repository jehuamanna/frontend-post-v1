import 'webextension-polyfill';

// HTTP Request Engine for Chrome Extension
// Based on the inspiration architecture for bypassing CORS and accessing full response data

interface FetchRequest {
  type: 'EXECUTE_FETCH';
  url: string;
  options: RequestInit;
  requestId: string;
}

interface FetchResponse {
  type: 'FETCH_RESULT' | 'FETCH_ERROR';
  result?: {
    body: string;
    headers: Record<string, string>;
    cookies: string[];
    status: number;
    statusText: string;
    size: number;
    time: number;
    url: string;
    ok: boolean;
    contentType?: string;
  };
  error?: string;
  requestId: string;
}

// Store for tracking pending requests
const pendingRequests = new Map<string, {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}>();

// Preprocess request options (handle object bodies, auto-add headers)
const preprocessOptions = (options: RequestInit): RequestInit => {
  const processedOptions = { ...options };
  
  // Handle object bodies - auto-serialize to JSON
  if (processedOptions.body && typeof processedOptions.body === 'object' && 
      !(processedOptions.body instanceof FormData) && 
      !(processedOptions.body instanceof Blob)) {
    processedOptions.body = JSON.stringify(processedOptions.body);
    
    // Auto-add Content-Type header if not present
    if (!processedOptions.headers) processedOptions.headers = {};
    const headers = processedOptions.headers as Record<string, string>;
    
    const hasContentType = Object.keys(headers).some(key => 
      key.toLowerCase() === 'content-type'
    );
    
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  return processedOptions;
};

// Get cookies for URL using Chrome Cookies API (bypasses HttpOnly restrictions)
const getCookiesForUrl = async (urlString: string): Promise<string[]> => {
  try {
    const url = new URL(urlString);
    
    // Use Chrome's cookies API for comprehensive cookie access
    const cookies = await chrome.cookies.getAll({ 
      domain: url.hostname 
    });
    
    return cookies.map(cookie => 
      `${cookie.name}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}${
        cookie.secure ? '; Secure' : ''
      }${
        cookie.httpOnly ? '; HttpOnly' : ''
      }`
    );
  } catch (error) {
    console.warn('Failed to get cookies:', error);
    return [];
  }
};

// Process response body with content-type awareness
const processResponseBody = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type');
  
  try {
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    } else {
      return await response.text();
    }
  } catch (error) {
    console.warn('Failed to process response body:', error);
    return await response.text();
  }
};

// Collect response headers
const collectResponseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  
  return headers;
};

// Core fetch execution with Chrome Extension privileges
const executeFetch = async (url: string, options: RequestInit): Promise<FetchResponse['result']> => {
  const startTime = Date.now();
  
  try {
    // 1. Preprocess request options
    const processedOptions = preprocessOptions(options);
    
    console.log(`🚀 Executing fetch: ${options.method || 'GET'} ${url}`);
    
    // 2. Execute HTTP request (bypasses CORS due to Chrome Extension privileges)
    const response = await fetch(url, processedOptions);
    
    // 3. Collect response data
    const headers = collectResponseHeaders(response);
    const body = await processResponseBody(response);
    const cookies = await getCookiesForUrl(url);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      body,
      headers,
      cookies,
      status: response.status,
      statusText: response.statusText,
      size: new Blob([body]).size,
      time: duration,
      url: response.url,
      ok: response.ok,
      contentType: response.headers.get('content-type') || undefined
    };
    
    console.log(`✅ Request completed: ${response.status} ${response.statusText} (${duration}ms)`);
    
    return result;
  } catch (error) {
    console.error(`❌ Request failed:`, error);
    throw error;
  }
};

// Handle fetch request messages from DevTools panel
const handleFetchRequest = async (message: FetchRequest, port: chrome.runtime.Port) => {
  const { url, options, requestId } = message;
  
  try {
    const result = await executeFetch(url, options);
    
    // Send success response
    port.postMessage({
      type: 'FETCH_RESULT',
      result,
      requestId
    } as FetchResponse);
    
  } catch (error) {
    // Send error response
    port.postMessage({
      type: 'FETCH_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId
    } as FetchResponse);
  }
};

// Set up port communication with DevTools panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    console.log('🔗 DevTools panel connected');
    
    port.onMessage.addListener((message: FetchRequest) => {
      if (message.type === 'EXECUTE_FETCH') {
        handleFetchRequest(message, port);
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('🔌 DevTools panel disconnected');
    });
  }
});

console.log('🚀 HTTP Request Engine Background Script loaded');
console.log('Ready to execute HTTP requests with Chrome Extension privileges');
