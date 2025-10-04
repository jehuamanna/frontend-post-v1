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

// Clean JSON string by removing problematic whitespace and validating
const cleanJsonString = (jsonString: string): string => {
  try {
    // First, trim the string
    let cleaned = jsonString.trim();
    
    // Check if it looks like JSON
    if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      // Not JSON, return as-is
      return jsonString;
    }
    
    // Try to parse and re-stringify to normalize formatting
    const parsed = JSON.parse(cleaned);
    const normalized = JSON.stringify(parsed);
    
    console.log('🔍 JSON validation successful:', {
      original: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
      normalized: normalized.substring(0, 100) + (normalized.length > 100 ? '...' : '')
    });
    
    return normalized;
    
  } catch (error) {
    console.warn('⚠️ JSON validation failed, attempting aggressive cleanup:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      original: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : '')
    });
    
    // Aggressive JSON cleanup for common formatting issues
    let aggressiveCleaned = jsonString
      .trim() // Remove leading/trailing whitespace
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n\s*/g, '') // Remove newlines and following spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
      .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
      .replace(/(\w+):/g, '"$1":') // Add quotes around unquoted property names: title: -> "title":
      .replace(/'/g, '"'); // Replace single quotes with double quotes (do this AFTER property names)
    
    // Try parsing the aggressively cleaned version
    try {
      const parsed = JSON.parse(aggressiveCleaned);
      const normalized = JSON.stringify(parsed);
      
      console.log('✅ Aggressive cleanup successful:', {
        original: jsonString.substring(0, 100) + (jsonString.length > 100 ? '...' : ''),
        cleaned: aggressiveCleaned.substring(0, 100) + (aggressiveCleaned.length > 100 ? '...' : ''),
        normalized: normalized.substring(0, 100) + (normalized.length > 100 ? '...' : '')
      });
      
      return normalized;
      
    } catch (secondError) {
      console.error('❌ Aggressive cleanup also failed:', {
        error: secondError instanceof Error ? secondError.message : 'Unknown error',
        cleaned: aggressiveCleaned.substring(0, 100) + (aggressiveCleaned.length > 100 ? '...' : '')
      });
      
      // Return the basic cleaned version as last resort
      return aggressiveCleaned;
    }
  }
};

// Preprocess request options (handle object bodies, auto-add headers)
const preprocessOptions = (options: RequestInit): RequestInit => {
  const processedOptions = { ...options };
  
  console.log('🔧 Preprocessing request options:', {
    bodyType: typeof processedOptions.body,
    bodyValue: processedOptions.body,
    headers: processedOptions.headers
  });
  
  // Handle object bodies - auto-serialize to JSON
  // Only serialize if it's a plain object (not already a string, FormData, or Blob)
  if (processedOptions.body && 
      typeof processedOptions.body === 'object' && 
      processedOptions.body.constructor === Object && // Only plain objects
      !(processedOptions.body instanceof FormData) && 
      !(processedOptions.body instanceof Blob)) {
    
    console.log('📦 Serializing object body to JSON');
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
  } else if (processedOptions.body && typeof processedOptions.body === 'string') {
    console.log('📝 Body is already a string, cleaning whitespace and validating JSON...');
    
    // Clean and validate JSON strings
    const cleanedBody = cleanJsonString(processedOptions.body);
    if (cleanedBody !== processedOptions.body) {
      console.log('🧹 Cleaned JSON string:', {
        original: processedOptions.body,
        cleaned: cleanedBody
      });
      processedOptions.body = cleanedBody;
    }
  }
  
  console.log('✅ Processed options:', {
    bodyType: typeof processedOptions.body,
    bodyValue: processedOptions.body,
    headers: processedOptions.headers
  });
  
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
  console.log('🔌 Incoming connection attempt:', port.name);
  
  if (port.name === 'devtools-panel') {
    console.log('✅ DevTools panel connected successfully');
    
    port.onMessage.addListener((message: FetchRequest) => {
      console.log('📨 Received message from DevTools:', message.type, message.requestId);
      
      if (message.type === 'EXECUTE_FETCH') {
        console.log(`🎯 Processing fetch request: ${message.options.method || 'GET'} ${message.url}`);
        handleFetchRequest(message, port);
      } else {
        console.warn('⚠️ Unknown message type:', message.type);
      }
    });
    
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('🔌 DevTools panel disconnected:', error?.message || 'Clean disconnect');
    });
  } else {
    console.warn('⚠️ Unknown port connection:', port.name);
  }
});

console.log('🚀 HTTP Request Engine Background Script loaded');
console.log('Ready to execute HTTP requests with Chrome Extension privileges');
