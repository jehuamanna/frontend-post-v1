# This in only a inspiration for the fetch request engine.
This used to work in my other projects.  Take this as an inspiration and try to implement it in a way that is suitable for our current needs as per our documnets and requirements.

# Architecture

## Overview

This architecture leverages Chrome Extension APIs to create a powerful HTTP request execution system that bypasses traditional web security restrictions. The system enables full access to response headers, cookies, and body content that would normally be restricted in browser environments.

## Core Architecture Pattern

### Two-Tier Communication Model

The architecture uses a **background script + devtools panel** pattern:

1. **DevTools Panel (Frontend)** - User interface running in devtools context
2. **Background Service Worker** - HTTP execution engine with elevated privileges

**Communication Flow:**
```
DevTools Panel → Chrome Runtime Port → Background Script → HTTP Request → External API
     ↑                                                                            ↓
Response Processing ← Chrome Runtime Port ← Response Collection ← HTTP Response
```
## Chrome Extension Permissions Model

### Required Permissions

```json
{
  "permissions": ["storage", "activeTab", "cookies"],
  "host_permissions": ["https://*/*", "http://*/*"]
}
```
**Permission Breakdown:**
- **`cookies`** - Access Chrome's cookie storage API
- **`activeTab`** - Access current tab context
- **`storage`** - Extension data persistence
- **`host_permissions`** - Cross-origin request authorization

### Security Context Elevation

Chrome extensions run in a **privileged security context** that bypasses:
- **CORS (Cross-Origin Resource Sharing)** restrictions
- **Same-origin policy** limitations
- **Cookie access restrictions** from JavaScript
- **Header visibility constraints**

## Inter-Context Communication System

### Chrome Runtime Port API

**Establishing Connection:**
```typescript
// DevTools Panel Context
const port = chrome.runtime.connect({ name: 'devtools-panel' });

// Background Script Context
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'devtools-panel') {
    // Handle connection
  }
});
```
### Message-Based Request/Response Protocol

**Request Message Structure:**
```typescript
interface FetchRequest {
  type: 'EXECUTE_FETCH';
  url: string;
  options: RequestInit;
  requestId: string; // Unique identifier for request matching
}
```
**Response Message Structure:**
```typescript
interface FetchResponse {
  type: 'FETCH_RESULT' | 'FETCH_ERROR';
  result?: {
    body: string;
    headers: Record<string, string | string[]>;
    cookies: string[];
    statusCode: number;
  };
  error?: string;
  requestId: string;
}
```
### Asynchronous Request Handling

**Promise-Based Request Tracking:**
```typescript
const pendingRequests = new Map<string, {
  resolve: (value: FetchResult) => void;
  reject: (reason: Error) => void;
}>();

// Generate unique request ID
const requestId = `${url}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Create promise for async response handling
const requestPromise = new Promise<FetchResult>((resolve, reject) => {
  pendingRequests.set(requestId, { resolve, reject });
  
  // Send request to background
  port.postMessage({
    type: 'EXECUTE_FETCH',
    url,
    options,
    requestId
  });
  
  // Timeout handling
  setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
      reject(new Error('Request timeout'));
    }
  }, 30000);
});
```

## HTTP Request Execution Engine

### Background Script Fetch Implementation

**Core Fetch Function:**
```typescript
const executeFetch = async (url: string, options: RequestInit): Promise<FetchResult> => {
  // 1. Request preprocessing
  const processedOptions = preprocessOptions(options);
  
  // 2. Execute HTTP request
  const response = await fetch(url, processedOptions);
  
  // 3. Extract response data
  const result = await extractResponseData(response, url);
  
  return result;
};
```

### Request Preprocessing

**Automatic Body Serialization:**
```typescript
const preprocessOptions = (options: RequestInit): RequestInit => {
  // Handle object bodies
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
    
    // Auto-add Content-Type header
    if (!options.headers) options.headers = {};
    const headers = options.headers as Record<string, string>;
    
    if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  return options;
};
```

## Response Data Collection System

### Multi-Source Header Collection

**Standard Response Headers:**
```typescript
const collectResponseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  
  return headers;
};
```

**Chrome Cookies API Integration:**
```typescript
const getCookiesForUrl = async (urlString: string): Promise<string[]> => {
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
};
```

### Enhanced Cookie Handling

**Why Chrome Cookies API:**
- **Browser security** restricts JavaScript access to `Set-Cookie` headers
- **HttpOnly cookies** are invisible to standard JavaScript
- **Chrome cookies API** provides complete cookie visibility
- **Domain-specific retrieval** for targeted cookie collection

**Cookie Collection Process:**
```typescript
const enhancedCookieCollection = async (response: Response, url: string) => {
  const cookies: string[] = [];
  
  // 1. Attempt to get Set-Cookie from response headers
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    cookies.push(setCookieHeader);
  }
  
  // 2. Use Chrome API for comprehensive cookie access
  const siteCookies = await getCookiesForUrl(url);
  if (siteCookies.length > 0) {
    cookies.push(...siteCookies);
  }
  
  return cookies;
};
```

## Response Body Processing

### Content-Type Aware Processing

**JSON Response Handling:**
```typescript
const processResponseBody = async (response: Response): Promise<string> => {
  const contentType = response.headers.get('content-type');
  
  if (contentType && contentType.includes('application/json')) {
    const json = await response.json();
    return JSON.stringify(json, null, 2);
  } else {
    return await response.text();
  }
};
```

### Recursive JSON String Parsing

**Nested JSON Detection and Parsing:**
```typescript
const recursivelyParseJsonStrings = (obj: any): any => {
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    
    // Detect JSON-like strings
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return recursivelyParseJsonStrings(parsed); // Recursive parsing
      } catch {
        return obj; // Return original if parsing fails
      }
    }
    
    // Handle escaped JSON strings
    if (trimmed.includes('\\"')) {
      try {
        const unescaped = JSON.parse(`"${trimmed}"`);
        if (typeof unescaped === 'string') {
          const parsed = JSON.parse(unescaped);
          return recursivelyParseJsonStrings(parsed);
        }
      } catch {
        // Fallback to original
      }
    }
    
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => recursivelyParseJsonStrings(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = recursivelyParseJsonStrings(value);
    }
    return result;
  }
  
  return obj;
};
```

**Use Case Example:**
```json
// API Response with nested JSON strings
{
  "status": "success",
  "data": "{\"user\":\"John\",\"profile\":\"{\\\"age\\\":30,\\\"city\\\":\\\"NYC\\\"}\"}"
}

// After recursive parsing
{
  "status": "success",
  "data": {
    "user": "John",
    "profile": {
      "age": 30,
      "city": "NYC"
    }
  }
}
```

## Error Handling and Resilience

### Connection Management

**Port Disconnection Handling:**
```typescript
port.onDisconnect.addListener(() => {
  // Clean up pending requests
  pendingRequests.forEach(request => {
    request.reject(new Error('Port disconnected'));
  });
  pendingRequests.clear();
  
  // Reset connection state
  portRef.current = null;
});
```

### Request Timeout Management

**Automatic Timeout with Cleanup:**
```typescript
const executeWithTimeout = (requestId: string, timeoutMs: number = 30000) => {
  setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      const request = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      request?.reject(new Error('Request timed out'));
    }
  }, timeoutMs);
};
```

### CORS and Network Error Handling

**Detailed Error Classification:**
```typescript
const handleFetchError = (error: Error): string => {
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return `Network Error: ${error.message}\n\nPossible causes:\n` +
           '• CORS policy restrictions\n' +
           '• Network connectivity issues\n' +
           '• Invalid URL or unreachable server\n' +
           '• Missing required headers';
  }
  
  return `Fetch Error: ${error.message}`;
};
```

## Performance Optimizations

### Connection Pooling

**Lazy Connection Establishment:**
```typescript
const ensureConnection = (): Promise<chrome.runtime.Port> => {
  return new Promise((resolve, reject) => {
    if (existingPort && !existingPort.disconnected) {
      resolve(existingPort);
      return;
    }
    
    // Establish new connection only when needed
    const port = chrome.runtime.connect({ name: 'devtools-panel' });
    setupPortHandlers(port);
    resolve(port);
  });
};
```

### Request Batching

**Concurrent Request Support:**
```typescript
// Multiple requests can be processed simultaneously
const batchRequests = async (requests: FetchRequest[]) => {
  const promises = requests.map(request => 
    executeFetch(request.url, request.options)
  );
  
  return Promise.allSettled(promises);
};
```

## Security Considerations

### Input Validation

**URL and Options Sanitization:**
```typescript
const validateRequest = (url: string, options: RequestInit): boolean => {
  // URL validation
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // Options validation
  if (options.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
    return false;
  }
  
  return true;
};
```

### Content Security Policy Compliance

**Extension CSP Configuration:**
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }
}
```

## Debugging and Monitoring

### Comprehensive Logging System

**Request/Response Tracking:**
```typescript
const logRequest = (requestId: string, url: string, options: RequestInit) => {
  console.log(`🚀 [${requestId}] Executing fetch:`, { url, options });
};

const logResponse = (requestId: string, result: FetchResult) => {
  console.log(`✅ [${requestId}] Response received:`, {
    statusCode: result.statusCode,
    headerCount: Object.keys(result.headers).length,
    cookieCount: result.cookies.length,
    bodyLength: result.body.length
  });
};
```

### Error Tracking

**Detailed Error Context:**
```typescript
const logError = (requestId: string, error: Error, context: any) => {
  console.error(`❌ [${requestId}] Request failed:`, {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};
```

## Workarounds, Caveats, and Gotchas

### Chrome Extension Limitations

#### **Set-Cookie Header Visibility**
**Problem**: Browser security prevents JavaScript from accessing `Set-Cookie` response headers directly.

**Workaround**: Use Chrome's `cookies` API as a fallback:
```typescript
// Standard approach fails silently
const setCookie = response.headers.get('set-cookie'); // Often returns null

// Workaround: Use Chrome Cookies API
const cookies = await chrome.cookies.getAll({ domain: url.hostname });
```

**Caveat**: Chrome Cookies API only shows cookies that were actually set by the browser, not raw `Set-Cookie` header values.

#### **HttpOnly Cookie Access**
**Problem**: HttpOnly cookies are invisible to JavaScript but visible to Chrome's internal APIs.

**Solution**: Chrome Cookies API can access HttpOnly cookies that standard JavaScript cannot:
```typescript
const cookies = await chrome.cookies.getAll({ domain: url.hostname });
// This includes HttpOnly cookies that document.cookie cannot access
```

#### **Cross-Origin Request Timing**
**Gotcha**: Extension requests bypass CORS but may have different timing characteristics than regular web requests.

**Consideration**: 
- Extension requests don't trigger preflight OPTIONS requests
- May complete faster than equivalent web requests
- Network timing may differ from browser DevTools Network tab

### JSON Parsing Edge Cases

#### **Double-Encoded JSON Strings**
**Corner Case**: APIs sometimes return JSON strings within JSON strings multiple levels deep.

**Example Problem**:
```json
{
  "data": "{\"nested\":\"{\\\"value\\\":\\\"test\\\"}\"}"
}
```

**Recursive Parsing Solution**:
```typescript
// Handles multiple levels of JSON string encoding
const recursivelyParseJsonStrings = (obj: any): any => {
  // Must handle escaped quotes: \", \\", \\\", etc.
  if (trimmed.includes('\\"')) {
    try {
      // First unescape the string
      const unescaped = JSON.parse(`"${trimmed}"`);
      // Then parse the unescaped content
      const parsed = JSON.parse(unescaped);
      return recursivelyParseJsonStrings(parsed); // Recurse again
    } catch {
      return obj; // Fallback to original
    }
  }
};
```

#### **Malformed JSON Detection**
**Gotcha**: Not all strings that look like JSON are valid JSON.

**Safe Parsing Pattern**:
```typescript
const safeJsonParse = (str: string): any => {
  const trimmed = str.trim();
  
  // Basic heuristics - but not foolproof
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}')) && 
      !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return str;
  }
  
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Log for debugging but don't throw
    console.warn('JSON parse failed for string that looked like JSON:', trimmed.substring(0, 100));
    return str;
  }
};
```

### Request Body Serialization Gotchas

#### **Object vs FormData Handling**
**Problem**: Different body types require different serialization approaches.

**Workaround**:
```typescript
const preprocessRequestBody = (body: any, headers: Record<string, string>) => {
  if (!body) return body;
  
  // Don't stringify FormData, Blob, or already-string bodies
  if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
    return body;
  }
  
  // Only stringify plain objects
  if (typeof body === 'object' && body.constructor === Object) {
    // Auto-add Content-Type only if not already present
    const hasContentType = Object.keys(headers).some(key => 
      key.toLowerCase() === 'content-type'
    );
    
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return JSON.stringify(body);
  }
  
  return body;
};
```

#### **Content-Type Header Conflicts**
**Gotcha**: Automatically adding `Content-Type: application/json` can conflict with existing headers.

**Case-Insensitive Header Check**:
```typescript
const hasContentTypeHeader = (headers: Record<string, string>): boolean => {
  return Object.keys(headers).some(key => 
    key.toLowerCase() === 'content-type'
  );
};
```

### Port Communication Pitfalls

#### **Port Disconnection Race Conditions**
**Problem**: Port can disconnect while requests are in flight, causing hanging promises.

**Robust Cleanup Pattern**:
```typescript
port.onDisconnect.addListener(() => {
  console.warn('Port disconnected, cleaning up pending requests');
  
  // Reject ALL pending requests with descriptive error
  pendingRequests.forEach((request, requestId) => {
    request.reject(new Error(`Port disconnected during request ${requestId}`));
  });
  
  // Clear the map to prevent memory leaks
  pendingRequests.clear();
  
  // Reset port reference
  portRef.current = null;
});
```

#### **Message Size Limitations**
**Gotcha**: Chrome has limits on message size passed through ports (~64MB in practice).

**Large Response Handling**:
```typescript
const handleLargeResponse = (response: string): string => {
  const MAX_MESSAGE_SIZE = 50 * 1024 * 1024; // 50MB safety margin
  
  if (response.length > MAX_MESSAGE_SIZE) {
    return JSON.stringify({
      error: 'Response too large for Chrome message passing',
      size: response.length,
      truncated: response.substring(0, 1000) + '...[TRUNCATED]'
    });
  }
  
  return response;
};
```

### Extension Lifecycle Issues

#### **Service Worker Hibernation**
**Problem**: Background service workers can hibernate, losing in-memory state.

**Persistent State Pattern**:
```typescript
// Store pending requests in chrome.storage for persistence
const storePendingRequest = async (requestId: string, requestData: any) => {
  const pending = await chrome.storage.local.get('pendingRequests') || {};
  pending[requestId] = {
    ...requestData,
    timestamp: Date.now()
  };
  await chrome.storage.local.set({ pendingRequests: pending });
};

// Restore on service worker wake-up
chrome.runtime.onStartup.addListener(async () => {
  const { pendingRequests = {} } = await chrome.storage.local.get('pendingRequests');
  
  // Clean up stale requests (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  const cleanRequests = Object.fromEntries(
    Object.entries(pendingRequests).filter(([_, data]: [string, any]) => 
      data.timestamp > fiveMinutesAgo
    )
  );
  
  await chrome.storage.local.set({ pendingRequests: cleanRequests });
});
```

#### **Extension Update/Reload Scenarios**
**Gotcha**: Extension reloads break all active port connections.

**Graceful Degradation**:
```typescript
const handleExtensionReload = () => {
  // Detect extension context invalidation
  try {
    chrome.runtime.getManifest();
  } catch (error) {
    // Extension context is invalid
    return {
      body: 'Extension was reloaded. Please refresh the page and try again.',
      headers: {},
      cookies: [],
      statusCode: null
    };
  }
};
```

### Network and Timing Issues

#### **Request Timeout Edge Cases**
**Problem**: Some requests may take longer than expected, but aren't actually failed.

**Configurable Timeout Pattern**:
```typescript
const executeWithConfigurableTimeout = (
  requestId: string, 
  url: string, 
  timeoutMs: number = 30000
) => {
  // Different timeouts for different URL patterns
  const getTimeoutForUrl = (url: string): number => {
    if (url.includes('upload') || url.includes('file')) {
      return 120000; // 2 minutes for uploads
    }
    if (url.includes('report') || url.includes('export')) {
      return 60000; // 1 minute for reports
    }
    return timeoutMs; // Default timeout
  };
  
  const actualTimeout = getTimeoutForUrl(url);
  
  setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      const request = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      request?.reject(new Error(`Request timed out after ${actualTimeout}ms`));
    }
  }, actualTimeout);
};
```

#### **Concurrent Request Limits**
**Gotcha**: Chrome has limits on concurrent requests per domain (~6-8 typically).

**Request Queuing Strategy**:
```typescript
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private active = 0;
  private readonly maxConcurrent = 6;
  
  async add<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.active++;
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.active--;
          this.processQueue();
        }
      });
      
      this.processQueue();
    });
  }
  
  private processQueue() {
    while (this.queue.length > 0 && this.active < this.maxConcurrent) {
      const nextRequest = this.queue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }
}
```

### Security and Privacy Considerations

#### **Credential Leakage Prevention**
**Gotcha**: Extension requests include cookies automatically, which might leak credentials.

**Selective Cookie Handling**:
```typescript
const sanitizeRequestForLogging = (url: string, options: RequestInit) => {
  const sanitized = { ...options };
  
  // Remove sensitive headers from logs
  if (sanitized.headers) {
    const headers = { ...sanitized.headers as Record<string, string> };
    delete headers['authorization'];
    delete headers['cookie'];
    delete headers['x-api-key'];
    sanitized.headers = headers;
  }
  
  return { url, options: sanitized };
};
```

#### **Host Permission Scope**
**Caveat**: Wildcard host permissions (`https://*/*`) are powerful but may raise security concerns.

**Granular Permission Strategy**:
```json
{
  "host_permissions": [
    "https://api.example.com/*",
    "https://service.company.com/*"
  ],
  "optional_host_permissions": [
    "https://*/*"
  ]
}
```

### Development and Debugging Gotchas

#### **DevTools Context Differences**
**Problem**: Code running in DevTools panel has different capabilities than content scripts or background scripts.

**Context-Aware Debugging**:
```typescript
const getExecutionContext = (): string => {
  if (typeof chrome !== 'undefined' && chrome.devtools) {
    return 'devtools';
  }
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    return 'extension';
  }
  if (typeof window !== 'undefined' && window.location) {
    return 'web';
  }
  return 'unknown';
};

console.log(`Execution context: ${getExecutionContext()}`);
```

#### **Extension Reload Detection**
**Gotcha**: During development, extension reloads can leave orphaned connections.

**Connection Health Check**:
```typescript
const isPortHealthy = (port: chrome.runtime.Port): boolean => {
  try {
    // Try to access port properties
    return port && !port.disconnected && !!port.name;
  } catch (error) {
    return false;
  }
};

// Periodic health check
setInterval(() => {
  if (portRef.current && !isPortHealthy(portRef.current)) {
    console.warn('Port became unhealthy, resetting connection');
    portRef.current = null;
  }
}, 5000);
```

This architecture provides a robust, secure, and performant system for executing HTTP requests with full response data access through Chrome Extension APIs, while accounting for the various limitations and edge cases inherent in the Chrome Extension environment.


