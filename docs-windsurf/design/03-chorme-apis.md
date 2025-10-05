# Declarative Request API and Web Request API
Please go through the documentation of both APIs and try to implement them in a way that is suitable for our current needs as per our documnets and requirements. Go through the below URLs for more information.

## **🎯 PRIORITY FEATURE: Network Request Monitoring**

### **Core Requirements:**

1. **Monitor Tab Implementation**
   - Add a new "Monitor" tab alongside the existing "Request" and "Response" tabs
   - This tab should be positioned to the left of the Request/Response tabs
   - Monitor tab will display real-time network requests initiated by the website

2. **Real-time Request Capture**
   - Monitor all API network requests made by the current website/tab
   - Capture and list all network requests in the Monitor tab as they happen
   - Display requests in a list/table format with key information (method, URL, status, timing)

3. **Request Details Population**
   - On click of any network request from the Monitor tab
   - Automatically populate all request details in the Request tab:
     - HTTP method, URL, headers, query parameters, request body
   - Automatically populate response details in the Response tab:
     - Status code, response headers, response body, cookies, timing
   - Switch to Request/Response tabs to show the populated data

### **Technical Implementation Approach:**
- Use **Web Request API** for comprehensive request interception
- Implement background script to capture network events
- Real-time communication between background script and DevTools panel
- Store captured requests in extension storage for persistence
- Integrate with existing tab system and state management

---

## **📋 DETAILED IMPLEMENTATION PLAN**

### **Phase 1: Chrome Extension Setup & Permissions**

#### **1.1 Manifest Configuration**
```json
{
  "manifest_version": 3,
  "name": "FrontendPost - HTTP Request Tool",
  "version": "1.0.0",
  "permissions": [
    "webRequest",
    "storage",
    "activeTab",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "devtools_page": "devtools.html"
}
```

#### **1.2 Required Permissions Analysis**
- **`webRequest`**: Core permission for intercepting network requests
- **`storage`**: Store captured requests and extension settings
- **`activeTab`**: Access current tab for request monitoring
- **`tabs`**: Tab management and communication
- **`<all_urls>`**: Monitor requests to any domain

### **Phase 2: Background Script Implementation**

#### **2.1 Network Request Interception**
```typescript
// background.js
interface CapturedRequest {
  requestId: string;
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
}

class NetworkMonitor {
  private capturedRequests = new Map<string, CapturedRequest>();
  
  init() {
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
    
    // Monitor response completion
    chrome.webRequest.onCompleted.addListener(
      this.handleRequestComplete.bind(this),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
    
    // Monitor request errors
    chrome.webRequest.onErrorOccurred.addListener(
      this.handleRequestError.bind(this),
      { urls: ["<all_urls>"] }
    );
  }
}
```

#### **2.2 Request Filtering & Processing**
```typescript
handleRequestStart(details: chrome.webRequest.WebRequestBodyDetails) {
  // Filter out non-API requests (images, CSS, etc.)
  if (this.shouldIgnoreRequest(details)) return;
  
  const request: CapturedRequest = {
    requestId: details.requestId,
    tabId: details.tabId,
    method: details.method,
    url: details.url,
    headers: {},
    body: this.extractRequestBody(details.requestBody),
    timestamp: details.timeStamp,
    timing: { startTime: details.timeStamp }
  };
  
  this.capturedRequests.set(details.requestId, request);
  this.notifyDevTools(details.tabId, 'requestStarted', request);
}

private shouldIgnoreRequest(details: chrome.webRequest.WebRequestBodyDetails): boolean {
  const ignoredTypes = ['image', 'stylesheet', 'font', 'media'];
  const ignoredExtensions = ['.css', '.js', '.png', '.jpg', '.gif', '.ico'];
  
  return ignoredTypes.includes(details.type) || 
         ignoredExtensions.some(ext => details.url.includes(ext));
}
```

### **Phase 3: DevTools Panel Integration**

#### **3.1 Monitor Tab Component**
```typescript
// components/MonitorTab.tsx
interface MonitoredRequest {
  id: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  timestamp: number;
  size?: number;
}

const MonitorTab: React.FC = () => {
  const [requests, setRequests] = useState<MonitoredRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  useEffect(() => {
    // Listen for captured requests from background script
    const port = chrome.runtime.connect({ name: 'devtools-monitor' });
    
    port.onMessage.addListener((message) => {
      if (message.type === 'requestCaptured') {
        setRequests(prev => [message.request, ...prev]);
      }
    });
    
    return () => port.disconnect();
  }, []);
  
  const handleRequestClick = (request: MonitoredRequest) => {
    // Populate Request/Response tabs with clicked request data
    populateRequestTabs(request);
    // Switch to Request tab
    switchToTab('request');
  };
  
  return (
    <div className="monitor-tab">
      <div className="monitor-controls">
        <button onClick={() => setIsMonitoring(!isMonitoring)}>
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </button>
        <button onClick={() => setRequests([])}>Clear</button>
      </div>
      
      <div className="requests-list">
        {requests.map(request => (
          <RequestRow 
            key={request.id} 
            request={request} 
            onClick={() => handleRequestClick(request)}
          />
        ))}
      </div>
    </div>
  );
};
```

#### **3.2 Request Row Component**
```typescript
const RequestRow: React.FC<{ request: MonitoredRequest; onClick: () => void }> = ({ 
  request, 
  onClick 
}) => {
  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status < 300) return 'text-green-600';
    if (status < 400) return 'text-blue-600';
    if (status < 500) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div 
      className="request-row cursor-pointer hover:bg-gray-50 p-2 border-b"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className={`method-badge ${request.method.toLowerCase()}`}>
            {request.method}
          </span>
          <span className="url truncate">{request.url}</span>
        </div>
        
        <div className="flex items-center space-x-3 text-sm">
          <span className={getStatusColor(request.status)}>
            {request.status || 'Pending'}
          </span>
          <span className="text-gray-500">
            {request.duration ? `${request.duration}ms` : '-'}
          </span>
          <span className="text-gray-400">
            {new Date(request.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};
```

### **Phase 4: Tab System Integration**

#### **4.1 Enhanced Tab Management**
```typescript
// Update existing useTabs hook to include Monitor tab
type TabType = 'monitor' | 'request' | 'response';

interface TabState {
  activeContentTab: TabType;
  monitoredRequests: MonitoredRequest[];
  // ... existing tab state
}

const tabsReducer = (state: TabState, action: TabAction): TabState => {
  switch (action.type) {
    case 'SWITCH_CONTENT_TAB':
      return { ...state, activeContentTab: action.tabType };
    
    case 'ADD_MONITORED_REQUEST':
      return {
        ...state,
        monitoredRequests: [action.request, ...state.monitoredRequests]
      };
    
    case 'POPULATE_FROM_MONITOR':
      return {
        ...state,
        activeTab: state.activeTab,
        tabs: state.tabs.map(tab => 
          tab.id === state.activeTab 
            ? { ...tab, request: action.requestData, response: action.responseData }
            : tab
        ),
        activeContentTab: 'request'
      };
    
    // ... existing cases
  }
};
```

#### **4.2 Content Tab Navigation**
```typescript
const ContentTabs: React.FC = () => {
  const { state, dispatch } = useTabs();
  
  const tabs = [
    { id: 'monitor', label: 'Monitor', icon: '📡' },
    { id: 'request', label: 'Request', icon: '📤' },
    { id: 'response', label: 'Response', icon: '📥' }
  ];
  
  return (
    <div className="content-tabs">
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${state.activeContentTab === tab.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SWITCH_CONTENT_TAB', tabType: tab.id })}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      
      <div className="tab-content">
        {state.activeContentTab === 'monitor' && <MonitorTab />}
        {state.activeContentTab === 'request' && <RequestForm />}
        {state.activeContentTab === 'response' && <ResponseView />}
      </div>
    </div>
  );
};
```

### **Phase 5: Communication Architecture**

#### **5.1 Background ↔ DevTools Communication**
```typescript
// DevTools Panel Communication
class DevToolsConnector {
  private port: chrome.runtime.Port;
  
  constructor() {
    this.port = chrome.runtime.connect({ name: 'devtools-panel' });
    this.setupMessageHandlers();
  }
  
  private setupMessageHandlers() {
    this.port.onMessage.addListener((message) => {
      switch (message.type) {
        case 'requestCaptured':
          this.handleRequestCaptured(message.data);
          break;
        case 'requestCompleted':
          this.handleRequestCompleted(message.data);
          break;
      }
    });
  }
  
  startMonitoring(tabId: number) {
    this.port.postMessage({ 
      type: 'startMonitoring', 
      tabId 
    });
  }
  
  stopMonitoring(tabId: number) {
    this.port.postMessage({ 
      type: 'stopMonitoring', 
      tabId 
    });
  }
}
```

### **Phase 6: Data Processing & Storage**

#### **6.1 Request Data Processing**
```typescript
class RequestProcessor {
  static processRequest(details: chrome.webRequest.WebRequestBodyDetails): ProcessedRequest {
    return {
      id: details.requestId,
      method: details.method,
      url: details.url,
      headers: this.extractHeaders(details),
      queryParams: this.extractQueryParams(details.url),
      body: this.extractBody(details.requestBody),
      timestamp: details.timeStamp,
      tabId: details.tabId
    };
  }
  
  static extractQueryParams(url: string): Record<string, string> {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }
  
  static extractBody(requestBody?: chrome.webRequest.UploadData[]): string | undefined {
    if (!requestBody || requestBody.length === 0) return undefined;
    
    // Handle form data
    if (requestBody[0].formData) {
      return JSON.stringify(requestBody[0].formData);
    }
    
    // Handle raw data
    if (requestBody[0].raw) {
      const decoder = new TextDecoder();
      return decoder.decode(requestBody[0].raw);
    }
    
    return undefined;
  }
}
```

### **Phase 7: UI Enhancements**

#### **7.1 Monitor Tab Styling**
```css
/* Monitor Tab Styles */
.monitor-tab {
  @apply h-full flex flex-col;
}

.monitor-controls {
  @apply flex items-center justify-between p-3 border-b bg-gray-50;
}

.requests-list {
  @apply flex-1 overflow-auto;
}

.request-row {
  @apply border-l-4 border-transparent hover:border-blue-400 transition-colors;
}

.method-badge {
  @apply px-2 py-1 rounded text-xs font-medium;
}

.method-badge.get { @apply bg-green-100 text-green-800; }
.method-badge.post { @apply bg-blue-100 text-blue-800; }
.method-badge.put { @apply bg-yellow-100 text-yellow-800; }
.method-badge.delete { @apply bg-red-100 text-red-800; }
```

---

## **🎯 IMPLEMENTATION ROADMAP**

### **Sprint 1: Foundation (1-2 days)**
1. ✅ Update manifest.json with required permissions
2. ✅ Create background service worker
3. ✅ Implement basic webRequest event listeners
4. ✅ Setup DevTools ↔ Background communication

### **Sprint 2: Monitor Tab (1-2 days)**
1. ✅ Create MonitorTab component
2. ✅ Implement request list UI
3. ✅ Add request filtering and processing
4. ✅ Integrate with existing tab system

### **Sprint 3: Request Population (1 day)**
1. ✅ Implement click-to-populate functionality
2. ✅ Update useTabs reducer for monitor integration
3. ✅ Add automatic tab switching
4. ✅ Test end-to-end workflow

### **Sprint 4: Polish & Optimization (1 day)**
1. ✅ Add request filtering options
2. ✅ Implement search and sorting
3. ✅ Performance optimization for large request lists
4. ✅ Error handling and edge cases

---

## Declarative Request API
https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest

## Web Request API
https://developer.chrome.com/docs/extensions/reference/api/webRequest


