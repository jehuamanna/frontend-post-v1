import 'webextension-polyfill';

// HTTP Request Engine for Chrome Extension
// Based on the inspiration architecture for bypassing CORS and accessing full response data
// Enhanced with Network Monitoring capabilities for real-time request capture

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

// Network Monitoring Interfaces
interface MonitoredRequest {
  id: string;
  tabId: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  timing: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  size?: number;
  initiator?: string;
}

// Debugger API Network Event Types
interface DebuggerRequest {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
  };
  timestamp: number;
  initiator?: any;
}

interface DebuggerResponse {
  requestId: string;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
  };
  timestamp: number;
}

interface MonitorMessage {
  type: 'START_MONITORING' | 'STOP_MONITORING' | 'REQUEST_CAPTURED' | 'REQUEST_COMPLETED' | 'GET_MONITORING_STATUS' | 'MONITORING_STATUS';
  tabId?: number;
  request?: MonitoredRequest;
  isMonitoring?: boolean;
  fullCapture?: boolean; // Enable full response body capture via Debugger API
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

// Network Monitor Class for real-time request capture
class NetworkMonitor {
  private capturedRequests = new Map<string, MonitoredRequest>();
  private connectedPorts = new Set<chrome.runtime.Port>();
  private isMonitoring = false;
  private monitoredTabIds = new Set<number>();

  init() {
    console.log('🔍 NetworkMonitor initialized');
    this.setupWebRequestListeners();
  }

  private setupWebRequestListeners() {
    // Monitor request start
    chrome.webRequest.onBeforeRequest.addListener(
      this.handleRequestStart.bind(this),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );

    // Monitor request headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
      this.handleRequestHeaders.bind(this),
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    );

    // Monitor response headers (must use onHeadersReceived, not onCompleted)
    chrome.webRequest.onHeadersReceived.addListener(
      this.handleResponseHeaders.bind(this),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    // Monitor response completion
    chrome.webRequest.onCompleted.addListener(
      this.handleRequestComplete.bind(this),
      { urls: ["<all_urls>"] }
    );

    // Monitor request errors
    chrome.webRequest.onErrorOccurred.addListener(
      this.handleRequestError.bind(this),
      { urls: ["<all_urls>"] }
    );
  }

  private shouldIgnoreRequest(details: chrome.webRequest.WebRequestBodyDetails): boolean {
    // Don't monitor if not actively monitoring or tab not in monitored list
    if (!this.isMonitoring || !this.monitoredTabIds.has(details.tabId)) {
      return true;
    }

    // Allow monitoring even for special URLs (empty tabs, chrome:// pages, etc.)
    // This ensures the extension works on new tabs and special pages
    
    // Filter out non-API requests (images, CSS, etc.) but be more permissive
    const ignoredTypes = ['image', 'stylesheet', 'font', 'media'];
    const ignoredExtensions = ['.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf'];
    
    // Check resource type (removed websocket to allow monitoring)
    if (ignoredTypes.includes(details.type)) {
      return true;
    }

    // Check URL extensions (removed .js to allow monitoring JS requests)
    if (ignoredExtensions.some(ext => details.url.toLowerCase().includes(ext))) {
      return true;
    }

    // Allow Chrome extension URLs for better compatibility
    if (details.url.startsWith('chrome-extension://')) {
      return false; // Changed to false to allow monitoring extension requests
    }

    // Allow chrome:// URLs for new tab compatibility
    if (details.url.startsWith('chrome://')) {
      return false; // Allow monitoring chrome:// URLs
    }

    return false;
  }

  private extractRequestBody(requestBody?: chrome.webRequest.WebRequestBody | null): string | undefined {
    if (!requestBody) return undefined;

    try {
      // Handle form data
      if (requestBody.formData) {
        return JSON.stringify(requestBody.formData);
      }

      // Handle raw data
      if (requestBody.raw && requestBody.raw.length > 0) {
        const decoder = new TextDecoder();
        return decoder.decode(requestBody.raw[0].bytes);
      }
    } catch (error) {
      console.warn('Failed to extract request body:', error);
    }

    return undefined;
  }

  private extractHeaders(details: chrome.webRequest.WebRequestHeadersDetails): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (details.requestHeaders) {
      details.requestHeaders.forEach(header => {
        if (header.name && header.value) {
          headers[header.name.toLowerCase()] = header.value;
        }
      });
    }

    return headers;
  }

  private handleRequestStart(details: chrome.webRequest.WebRequestBodyDetails) {
    if (this.shouldIgnoreRequest(details)) return;

    const request: MonitoredRequest = {
      id: details.requestId,
      tabId: details.tabId,
      method: details.method,
      url: details.url,
      headers: {},
      body: this.extractRequestBody(details.requestBody),
      timestamp: details.timeStamp,
      timing: { startTime: details.timeStamp },
      initiator: details.initiator
    };

    this.capturedRequests.set(details.requestId, request);
    this.notifyDevTools('REQUEST_CAPTURED', request);

    console.log(`📡 Captured request: ${details.method} ${details.url}`);
  }

  private handleRequestHeaders(details: chrome.webRequest.WebRequestHeadersDetails) {
    const request = this.capturedRequests.get(details.requestId);
    if (!request) return;

    request.headers = this.extractHeaders(details);
    this.capturedRequests.set(details.requestId, request);
  }

  private handleResponseHeaders(details: chrome.webRequest.WebResponseHeadersDetails) {
    const request = this.capturedRequests.get(details.requestId);
    if (!request) return;

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    if (details.responseHeaders) {
      details.responseHeaders.forEach(header => {
        if (header.name && header.value) {
          responseHeaders[header.name.toLowerCase()] = header.value;
        }
      });
    }

    request.responseHeaders = responseHeaders;
    request.status = details.statusCode;
    
    // Note: Response body is NOT available in Chrome's webRequest API
    // This is a known Chrome limitation - webRequest API only provides headers and metadata
    // To capture response bodies, we would need:
    // 1. Chrome Debugger API (requires debugger permission, complex setup)
    // 2. Network interception at service worker level (not applicable for DevTools)
    // 3. Re-fetching the request (could have side effects, not recommended)
    // 
    // For now, monitored requests will show:
    // ✅ Request data (URL, method, headers, body)
    // ✅ Response headers and status code
    // ❌ Response body (limitation of Chrome webRequest API)
    
    request.responseBody = '[Response body not available - Chrome webRequest API limitation]';
    
    this.capturedRequests.set(details.requestId, request);
    
    console.log(`📥 Response headers captured: ${details.statusCode} ${request.method} ${request.url}`);
  }

  private handleRequestComplete(details: chrome.webRequest.WebResponseDetails) {
    const request = this.capturedRequests.get(details.requestId);
    if (!request) return;

    // Update request with response data
    request.status = details.statusCode;
    request.timing.endTime = details.timeStamp;
    request.timing.duration = details.timeStamp - request.timing.startTime;

    // Note: responseHeaders are available in onHeadersReceived event, not onCompleted
    // We'll handle response headers in a separate listener if needed

    this.capturedRequests.set(details.requestId, request);
    this.notifyDevTools('REQUEST_COMPLETED', request);

    console.log(`✅ Request completed: ${details.statusCode} ${request.method} ${request.url} (${request.timing.duration}ms)`);
  }

  private handleRequestError(details: any) {
    const request = this.capturedRequests.get(details.requestId);
    if (!request) return;

    request.timing.endTime = details.timeStamp;
    request.timing.duration = details.timeStamp - request.timing.startTime;
    request.status = 0; // Error status

    this.capturedRequests.set(details.requestId, request);
    this.notifyDevTools('REQUEST_COMPLETED', request);

    console.log(`❌ Request error: ${request.method} ${request.url} - ${details.error}`);
  }

  private notifyDevTools(type: MonitorMessage['type'], request: MonitoredRequest) {
    const message: MonitorMessage = { type, request };
    
    this.connectedPorts.forEach(port => {
      try {
        port.postMessage(message);
      } catch (error) {
        console.warn('Failed to send message to DevTools:', error);
        this.connectedPorts.delete(port);
      }
    });
  }

  addPort(port: chrome.runtime.Port) {
    this.connectedPorts.add(port);
    console.log(`📱 DevTools port connected. Total ports: ${this.connectedPorts.size}`);
  }

  removePort(port: chrome.runtime.Port) {
    this.connectedPorts.delete(port);
    console.log(`📱 DevTools port disconnected. Total ports: ${this.connectedPorts.size}`);
  }

  startMonitoring(tabId: number) {
    this.monitoredTabIds.add(tabId);
    this.isMonitoring = true;
    console.log(`🔍 Started monitoring tab ${tabId}. Monitored tabs: ${Array.from(this.monitoredTabIds)}`);
  }

  stopMonitoring(tabId: number) {
    this.monitoredTabIds.delete(tabId);
    if (this.monitoredTabIds.size === 0) {
      this.isMonitoring = false;
    }
    console.log(`⏹️ Stopped monitoring tab ${tabId}. Monitored tabs: ${Array.from(this.monitoredTabIds)}`);
  }

  getRequest(requestId: string): MonitoredRequest | undefined {
    return this.capturedRequests.get(requestId);
  }

  isTabBeingMonitored(tabId: number): boolean {
    return this.monitoredTabIds.has(tabId);
  }

  sendMonitoringStatus(port: chrome.runtime.Port, tabId: number) {
    const isMonitoring = this.isTabBeingMonitored(tabId);
    try {
      port.postMessage({
        type: 'MONITORING_STATUS',
        isMonitoring,
        tabId
      });
      console.log(`📡 Sent monitoring status for tab ${tabId}: ${isMonitoring}`);
    } catch (error) {
      console.warn('Failed to send monitoring status:', error);
    }
  }
}

// Debugger-based Network Monitor for capturing full response bodies
class DebuggerNetworkMonitor {
  private attachedTabs = new Set<number>();
  private capturedRequests = new Map<string, MonitoredRequest>();
  private connectedPorts = new Set<chrome.runtime.Port>();

  init() {
    // Listen for debugger events
    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this));
    chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this));
    console.log('🐛 Debugger Network Monitor initialized');
  }

  async attachToTab(tabId: number) {
    if (this.attachedTabs.has(tabId)) {
      console.log(`🐛 Already attached to tab ${tabId}`);
      return;
    }

    try {
      // Attach debugger with version 1.3 (supports Network domain)
      await chrome.debugger.attach({ tabId }, '1.3');
      
      // Enable Network domain to capture network events
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      
      this.attachedTabs.add(tabId);
      console.log(`🐛 Debugger attached to tab ${tabId}`);
    } catch (error) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, error);
      throw error;
    }
  }

  async detachFromTab(tabId: number) {
    if (!this.attachedTabs.has(tabId)) {
      return;
    }

    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTabs.delete(tabId);
      console.log(`🐛 Debugger detached from tab ${tabId}`);
    } catch (error) {
      console.warn(`Failed to detach debugger from tab ${tabId}:`, error);
    }
  }

  private handleDebuggerEvent(source: chrome.debugger.Debuggee, method: string, params?: any) {
    if (!source.tabId) return;

    switch (method) {
      case 'Network.requestWillBeSent':
        this.handleRequestWillBeSent(source.tabId, params);
        break;
      case 'Network.responseReceived':
        this.handleResponseReceived(source.tabId, params);
        break;
      case 'Network.loadingFinished':
        this.handleLoadingFinished(source.tabId, params);
        break;
      case 'Network.loadingFailed':
        this.handleLoadingFailed(source.tabId, params);
        break;
    }
  }

  private handleRequestWillBeSent(tabId: number, params: any) {
    const { requestId, request, timestamp, initiator } = params;

    const monitoredRequest: MonitoredRequest = {
      id: requestId,
      tabId,
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      body: request.postData,
      timestamp: timestamp * 1000, // Convert to milliseconds
      timing: { startTime: timestamp * 1000 },
      initiator: initiator?.type
    };

    this.capturedRequests.set(requestId, monitoredRequest);
    this.notifyDevTools('REQUEST_CAPTURED', monitoredRequest);

    console.log(`🐛 Request captured: ${request.method} ${request.url}`);
  }

  private handleResponseReceived(tabId: number, params: any) {
    const { requestId, response, timestamp } = params;
    const request = this.capturedRequests.get(requestId);
    if (!request) return;

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        responseHeaders[key.toLowerCase()] = String(value);
      });
    }

    request.status = response.status;
    request.responseHeaders = responseHeaders;
    request.timing.endTime = timestamp * 1000;
    request.timing.duration = (timestamp * 1000) - request.timing.startTime;

    this.capturedRequests.set(requestId, request);

    console.log(`🐛 Response received: ${response.status} ${request.method} ${request.url}`);
  }

  private async handleLoadingFinished(tabId: number, params: any) {
    const { requestId } = params;
    const request = this.capturedRequests.get(requestId);
    if (!request) return;

    try {
      // Get response body using Debugger API
      const result = await chrome.debugger.sendCommand(
        { tabId },
        'Network.getResponseBody',
        { requestId }
      ) as { body?: string; base64Encoded?: boolean };

      if (result && result.body) {
        // Decode base64 if needed
        request.responseBody = result.base64Encoded 
          ? atob(result.body)
          : result.body;
      }

      this.capturedRequests.set(requestId, request);
      this.notifyDevTools('REQUEST_COMPLETED', request);

      console.log(`🐛 Response body captured: ${request.method} ${request.url} (${request.responseBody?.length || 0} bytes)`);
    } catch (error) {
      console.warn(`Failed to get response body for ${request.url}:`, error);
      // Still notify with what we have
      request.responseBody = '[Failed to capture response body]';
      this.notifyDevTools('REQUEST_COMPLETED', request);
    }
  }

  private handleLoadingFailed(tabId: number, params: any) {
    const { requestId, errorText } = params;
    const request = this.capturedRequests.get(requestId);
    if (!request) return;

    request.status = 0;
    request.responseBody = `[Request failed: ${errorText}]`;

    this.capturedRequests.set(requestId, request);
    this.notifyDevTools('REQUEST_COMPLETED', request);

    console.log(`🐛 Request failed: ${request.method} ${request.url} - ${errorText}`);
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string) {
    if (source.tabId) {
      this.attachedTabs.delete(source.tabId);
      console.log(`🐛 Debugger detached from tab ${source.tabId}: ${reason}`);
    }
  }

  private notifyDevTools(type: MonitorMessage['type'], request: MonitoredRequest) {
    const message: MonitorMessage = { type, request };
    
    this.connectedPorts.forEach(port => {
      try {
        port.postMessage(message);
      } catch (error) {
        console.warn('Failed to send message to DevTools:', error);
        this.connectedPorts.delete(port);
      }
    });
  }

  addPort(port: chrome.runtime.Port) {
    this.connectedPorts.add(port);
  }

  removePort(port: chrome.runtime.Port) {
    this.connectedPorts.delete(port);
  }

  isAttached(tabId: number): boolean {
    return this.attachedTabs.has(tabId);
  }
}

// Initialize both monitors
const networkMonitor = new NetworkMonitor();
networkMonitor.init();

const debuggerMonitor = new DebuggerNetworkMonitor();
debuggerMonitor.init();

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
    
    // Add port to both monitors
    networkMonitor.addPort(port);
    debuggerMonitor.addPort(port);
    
    port.onMessage.addListener(async (message: FetchRequest | MonitorMessage) => {
      console.log('📨 Received message from DevTools:', message.type);
      
      if (message.type === 'EXECUTE_FETCH') {
        const fetchMessage = message as FetchRequest;
        console.log(`🎯 Processing fetch request: ${fetchMessage.options.method || 'GET'} ${fetchMessage.url}`);
        handleFetchRequest(fetchMessage, port);
      } else if (message.type === 'START_MONITORING') {
        const monitorMessage = message as MonitorMessage;
        if (monitorMessage.tabId) {
          // Check if user wants full capture mode (Debugger API)
          if (monitorMessage.fullCapture) {
            // Use Debugger API for full response body capture
            try {
              await debuggerMonitor.attachToTab(monitorMessage.tabId);
              console.log(`🐛 Started FULL CAPTURE monitoring for tab ${monitorMessage.tabId} (Debugger API)`);
            } catch (error) {
              console.error('Failed to attach debugger, falling back to webRequest:', error);
              // Fallback to webRequest-based monitoring
              networkMonitor.startMonitoring(monitorMessage.tabId);
            }
          } else {
            // Use standard webRequest API (headers/status only, no response body)
            networkMonitor.startMonitoring(monitorMessage.tabId);
            console.log(`📡 Started STANDARD monitoring for tab ${monitorMessage.tabId} (webRequest API)`);
          }
        }
      } else if (message.type === 'STOP_MONITORING') {
        const monitorMessage = message as MonitorMessage;
        if (monitorMessage.tabId) {
          // Detach debugger
          await debuggerMonitor.detachFromTab(monitorMessage.tabId);
          networkMonitor.stopMonitoring(monitorMessage.tabId);
        }
      } else if (message.type === 'GET_MONITORING_STATUS') {
        const monitorMessage = message as MonitorMessage;
        if (monitorMessage.tabId) {
          const isMonitoring = debuggerMonitor.isAttached(monitorMessage.tabId) || 
                              networkMonitor.isTabBeingMonitored(monitorMessage.tabId);
          try {
            port.postMessage({
              type: 'MONITORING_STATUS',
              isMonitoring,
              tabId: monitorMessage.tabId
            });
          } catch (error) {
            console.warn('Failed to send monitoring status:', error);
          }
        }
      } else {
        console.warn('⚠️ Unknown message type:', message.type);
      }
    });
    
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('🔌 DevTools panel disconnected:', error?.message || 'Clean disconnect');
      
      // Remove port from both monitors
      networkMonitor.removePort(port);
      debuggerMonitor.removePort(port);
    });
  } else {
    console.warn('⚠️ Unknown port connection:', port.name);
  }
});

console.log('🚀 HTTP Request Engine Background Script loaded');
console.log('Ready to execute HTTP requests with Chrome Extension privileges');
