import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useCallback } from 'react';
import { useTabs } from './hooks/useTabs';
import { TabBar } from './components/TabBar';
import { RequestForm } from './components/RequestForm';
import { ResponseView } from './components/ResponseView';
import { FetchCurlModal } from './components/FetchCurlModal';
import MonitorTab from './components/MonitorTab';
import { chromeHttpClient } from './utils/chromeHttpClient';
import { HttpRequest, HttpResponse, MonitoredRequest } from './types';

// Utility functions for generating curl/fetch commands
const generateCurlCommand = (request: HttpRequest): string => {
  const { url, method, headers, body, params } = request;
  
  // Build full URL with query parameters
  let fullUrl = url;
  if (params && Object.keys(params).length > 0) {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (key.trim() && value) {
        urlObj.searchParams.set(key, value);
      }
    });
    fullUrl = urlObj.toString();
  }
  
  let curlCommand = `curl -X ${method.toUpperCase()} "${fullUrl}"`;
  
  // Add headers
  if (headers && Object.keys(headers).length > 0) {
    Object.entries(headers).forEach(([key, value]) => {
      if (key.trim() && value) {
        curlCommand += ` \\\n  -H "${key}: ${value}"`;
      }
    });
  }
  
  // Add body for methods that support it
  const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (methodsWithBody.includes(method.toUpperCase()) && body && body.trim()) {
    curlCommand += ` \\\n  -d '${body.replace(/'/g, "'\\''")}''`;
  }
  
  return curlCommand;
};

const generateFetchCommand = (request: HttpRequest): string => {
  const { url, method, headers, body, params } = request;
  
  // Build full URL with query parameters
  let fullUrl = url;
  if (params && Object.keys(params).length > 0) {
    const urlObj = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      if (key.trim() && value) {
        urlObj.searchParams.set(key, value);
      }
    });
    fullUrl = urlObj.toString();
  }
  
  let fetchCommand = `fetch('${fullUrl}'`;
  
  // Build options object
  const options: string[] = [];
  
  if (method.toUpperCase() !== 'GET') {
    options.push(`method: '${method.toUpperCase()}'`);
  }
  
  // Add headers
  if (headers && Object.keys(headers).length > 0) {
    const headerEntries = Object.entries(headers)
      .filter(([key, value]) => key.trim() && value)
      .map(([key, value]) => `    '${key}': '${value}'`)
      .join(',\n');
    
    if (headerEntries) {
      options.push(`headers: {\n${headerEntries}\n  }`);
    }
  }
  
  // Add body for methods that support it
  const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (methodsWithBody.includes(method.toUpperCase()) && body && body.trim()) {
    try {
      // Try to parse as JSON for proper formatting
      JSON.parse(body);
      options.push(`body: JSON.stringify(${body})`);
    } catch {
      // If not JSON, treat as string
      options.push(`body: '${body.replace(/'/g, "\\'")}'`);
    }
  }
  
  if (options.length > 0) {
    fetchCommand += `, {\n  ${options.join(',\n  ')}\n}`;
  }
  
  fetchCommand += ')';
  return fetchCommand;
};

// Copy to clipboard utility
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr);
      return false;
    }
  }
};

const Panel = () => {
  const [activeContentTab, setActiveContentTab] = useState<'monitor' | 'request' | 'response'>('monitor');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    initialValue?: string;
  }>({ isOpen: false });
  const [monitorRequestCounts, setMonitorRequestCounts] = useState<{ filtered: number; total: number }>({ filtered: 0, total: 0 });
  const [clearCounter, setClearCounter] = useState(0);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  const {
    tabs,
    activeTab,
    activeTabId,
    isLoaded,
    createTab,
    closeTab,
    switchTab,
    updateRequest,
    updateResponse,
    updateTab,
    reorderTabs,
    clearRequest,
  } = useTabs();

  const handleContentTabClick = useCallback((tab: 'monitor' | 'request' | 'response') => {
    setActiveContentTab(tab);
  }, []);

  const handleMonitoredRequestSelect = useCallback((monitoredRequest: MonitoredRequest) => {
    if (!activeTabId) return;

    // Convert MonitoredRequest to HttpRequest format
    const httpRequest: Partial<HttpRequest> = {
      url: monitoredRequest.url,
      method: monitoredRequest.method as HttpRequest['method'],
      headers: monitoredRequest.headers || {},
      body: monitoredRequest.body || '',
      params: {} // Extract from URL if needed
    };

    // Extract query parameters from URL
    try {
      const url = new URL(monitoredRequest.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      httpRequest.params = params;
    } catch (error) {
      console.warn('Failed to parse URL for query params:', error);
    }

    // Update the current tab with the monitored request data
    updateRequest(activeTabId, httpRequest);

    // Populate response data if available from monitored request
    if (monitoredRequest.status && monitoredRequest.responseHeaders) {
      const httpResponse: HttpResponse = {
        status: monitoredRequest.status,
        statusText: `${monitoredRequest.status}`,
        headers: monitoredRequest.responseHeaders,
        body: monitoredRequest.responseBody || '',
        size: monitoredRequest.size || 0,
        time: monitoredRequest.timing.duration || 0,
        url: monitoredRequest.url,
        ok: monitoredRequest.status >= 200 && monitoredRequest.status < 300,
        cookies: [], // TODO: Extract from responseHeaders if needed
        duration: monitoredRequest.timing.duration
      };
      updateResponse(activeTabId, httpResponse);
    } else {
      // Only clear response if no response data available
      updateResponse(activeTabId, null);
    }

    // Update tab name based on the request
    try {
      const url = new URL(monitoredRequest.url);
      const endpoint = url.pathname.split('/').pop() || 'API';
      updateTab(activeTabId, {
        name: `${endpoint} ${monitoredRequest.method}`
      });
    } catch (error) {
      updateTab(activeTabId, {
        name: `${monitoredRequest.method} Request`
      });
    }

    // Switch to Request tab to show the populated data
    setActiveContentTab('request');
  }, [activeTabId, updateRequest, updateResponse, updateTab]);

  const handleMonitorRequestCountChange = useCallback((filtered: number, total: number) => {
    setMonitorRequestCounts({ filtered, total });
  }, []);

  const handleMonitoredRequestDoubleClick = useCallback((monitoredRequest: MonitoredRequest) => {
    // Convert MonitoredRequest to HttpRequest format
    const httpRequest: Partial<HttpRequest> = {
      url: monitoredRequest.url,
      method: monitoredRequest.method as HttpRequest['method'],
      headers: monitoredRequest.headers || {},
      body: monitoredRequest.body || '',
      params: {} // Extract from URL if needed
    };

    // Extract query parameters from URL
    try {
      const url = new URL(monitoredRequest.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      httpRequest.params = params;
    } catch (error) {
      console.warn('Failed to parse URL for query params:', error);
    }

    // Create tab name based on the request
    let tabName: string;
    try {
      const url = new URL(monitoredRequest.url);
      const endpoint = url.pathname.split('/').pop() || 'API';
      tabName = `${endpoint} ${monitoredRequest.method}`;
    } catch (error) {
      tabName = `${monitoredRequest.method} Request`;
    }

    // Create a new tab with the monitored request data
    const newTabId = createTab(tabName, httpRequest);

    // If we have response data, update the new tab with response too
    if (monitoredRequest.status && monitoredRequest.responseHeaders) {
      const httpResponse: HttpResponse = {
        status: monitoredRequest.status,
        statusText: `${monitoredRequest.status}`,
        headers: monitoredRequest.responseHeaders,
        body: monitoredRequest.responseBody || '',
        size: monitoredRequest.size || 0,
        time: monitoredRequest.timing.duration || 0,
        url: monitoredRequest.url,
        ok: monitoredRequest.status >= 200 && monitoredRequest.status < 300,
        cookies: [],
        duration: monitoredRequest.timing.duration
      };
      updateResponse(newTabId, httpResponse);
    }

    // Note: Don't switch tabs on double-click - let user stay on Monitor tab to continue monitoring
    // setActiveContentTab('request'); // Removed to keep focus on Monitor tab
  }, [createTab, updateResponse]);

  const handleNewTab = useCallback(() => {
    createTab();
  }, [createTab]);

  const handleRequestChange = useCallback((updates: any) => {
    if (activeTabId) {
      updateRequest(activeTabId, updates);
    }
  }, [activeTabId, updateRequest]);

  const handleRequestCommand = useCallback(() => {
    setModalState({ isOpen: true, initialValue: activeTab?.data.rawCommand || '' });
  }, [activeTab]);

  const handleModalClose = useCallback(() => {
    setModalState({ isOpen: false });
  }, []);

  const handleModalSave = useCallback((rawCommand: string, parsedRequest?: Partial<HttpRequest>, commandType?: 'fetch' | 'curl') => {
    if (activeTabId) {
      // Update the raw command and detected type
      updateTab(activeTabId, {
        data: {
          ...activeTab!.data,
          rawCommand,
          commandType
        }
      });

      // If we successfully parsed the request, update the request data
      if (parsedRequest) {
        updateRequest(activeTabId, parsedRequest);

        // Update tab name if URL is available
        if (parsedRequest.url) {
          const urlParts = parsedRequest.url.split('/');
          const endpoint = urlParts[urlParts.length - 1] || 'API';
          const method = parsedRequest.method || 'GET';
          updateTab(activeTabId, {
            name: `${endpoint} ${method}`
          });
        }
      }
    }
    // Note: Modal should only close on explicit user action (click away, close button)
    // Not on auto-save during typing/pasting
  }, [activeTabId, activeTab, updateTab, updateRequest]);

  const handleClear = useCallback(() => {
    if (activeTabId) {
      // Use the dedicated clearRequest action from reducer
      clearRequest(activeTabId);
      
      // Force component re-render by incrementing clear counter
      setClearCounter(prev => prev + 1);
    }
  }, [activeTabId, clearRequest]);

  // Copy handlers for curl/fetch commands
  const handleCopyCurl = useCallback(async () => {
    if (activeTab?.data.request) {
      const curlCommand = generateCurlCommand(activeTab.data.request);
      const success = await copyToClipboard(curlCommand);
      setCopyFeedback(success ? 'cURL copied!' : 'Copy failed');
      
      // Clear feedback after 2 seconds
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [activeTab]);

  const handleCopyFetch = useCallback(async () => {
    if (activeTab?.data.request) {
      const fetchCommand = generateFetchCommand(activeTab.data.request);
      const success = await copyToClipboard(fetchCommand);
      setCopyFeedback(success ? 'Fetch copied!' : 'Copy failed');
      
      // Clear feedback after 2 seconds
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  }, [activeTab]);

  // Cancel current request
  const handleCancelRequest = useCallback(() => {
    if (currentRequestId) {
      const success = chromeHttpClient.cancelRequest(currentRequestId);
      if (success) {
        setCopyFeedback('Request cancelled');
        setTimeout(() => setCopyFeedback(null), 2000);
      }
      setCurrentRequestId(null);
    }
  }, [currentRequestId]);

  // Convert HttpRequest to Chrome Extension format and execute
  const executeRequestWithChromeClient = useCallback(async (request: HttpRequest): Promise<HttpResponse> => {
    console.log('🔄 Converting request for Chrome Extension client:', {
      url: request.url,
      method: request.method,
      bodyType: typeof request.body,
      bodyValue: request.body,
      headers: request.headers,
      params: request.params
    });

    // Build full URL with query parameters
    const url = new URL(request.url);
    if (request.params) {
      Object.entries(request.params).forEach(([key, value]) => {
        if (key.trim() && value !== undefined) {
          url.searchParams.set(key, value);
        }
      });
    }

    // Prepare headers
    const headers: Record<string, string> = {};
    if (request.headers) {
      Object.entries(request.headers).forEach(([key, value]) => {
        if (key.trim() && value !== undefined) {
          headers[key.trim()] = value;
        }
      });
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    };

    // Add body for methods that support it
    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (methodsWithBody.includes(request.method.toUpperCase()) && request.body) {
      console.log('📦 Adding body to request:', {
        bodyType: typeof request.body,
        bodyValue: request.body,
        bodyLength: request.body.length
      });
      
      // Clean the body if it's a string (remove extra whitespace/newlines)
      let cleanedBody = request.body;
      if (typeof request.body === 'string') {
        cleanedBody = request.body.trim();
        if (cleanedBody !== request.body) {
          console.log('🧹 Cleaned body whitespace:', {
            original: request.body,
            cleaned: cleanedBody
          });
        }
      }
      
      fetchOptions.body = cleanedBody;
    }

    console.log('📋 Final fetch options:', fetchOptions);

    // Execute request through Chrome Extension client
    const result = await chromeHttpClient.fetch(url.toString(), fetchOptions);

    // Convert result to HttpResponse format
    return {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
      body: result.body,
      size: result.size,
      time: result.time,
      url: result.url,
      ok: result.ok,
      cookies: result.cookies,
      contentType: result.contentType,
      duration: result.time, // Alias for compatibility
    };
  }, []);

  const handleExecute = useCallback(async () => {
    if (!activeTab || !activeTabId) return;
    
    const request = activeTab.data.request;
    
    // Validate request
    if (!request.url?.trim()) {
      updateResponse(activeTabId, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        body: 'URL is required',
        size: 0,
        time: 0,
        url: '',
        ok: false,
        error: 'URL is required',
        cookies: [],
      });
      setActiveContentTab('response');
      return;
    }

    // Set loading state
    updateTab(activeTabId, { isLoading: true, lastError: undefined });
    
    try {
      // Generate request ID for tracking
      const requestId = `${request.url}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setCurrentRequestId(requestId);
      
      // Execute the HTTP request using Chrome Extension client
      const response = await executeRequestWithChromeClient(request);
      
      // Update response in tab
      updateResponse(activeTabId, response);
      
      // Switch to response tab to show results
      setActiveContentTab('response');
      
      // Clear current request ID
      setCurrentRequestId(null);
      
    } catch (error) {
      // Handle execution errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateTab(activeTabId, { 
        lastError: errorMessage,
        isLoading: false 
      });
      
      updateResponse(activeTabId, {
        status: 0,
        statusText: 'Request Failed',
        headers: {},
        body: errorMessage,
        size: 0,
        time: 0,
        url: request.url,
        ok: false,
        error: errorMessage,
        cookies: [],
      });
      
      setActiveContentTab('response');
      
      // Clear current request ID
      setCurrentRequestId(null);
    } finally {
      // Clear loading state
      updateTab(activeTabId, { isLoading: false });
    }
  }, [activeTab, activeTabId, updateResponse, updateTab, setActiveContentTab]);

  // Show loading state while tabs are being loaded
  if (!isLoaded) {
    return (
      <div className="h-screen w-screen max-h-screen max-w-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen max-h-screen max-w-screen flex flex-col bg-white">
      {/* Top layer for tabs */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={switchTab}
        onTabClose={closeTab}
        onNewTab={handleNewTab}
        onTabReorder={reorderTabs}
      />

      {/* Second layer for action bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-300 bg-white">
        <button
          onClick={handleRequestCommand}
          className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-black transition-colors font-medium"
        >
          Request Command
        </button>
        
        {/* Copy buttons for modified request */}
        {activeTab?.data.request.url && (
          <>
            <button
              onClick={handleCopyCurl}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white"
              title="Copy as cURL command"
            >
              Copy cURL
            </button>
            <button
              onClick={handleCopyFetch}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white"
              title="Copy as fetch command"
            >
              Copy Fetch
            </button>
          </>
        )}
        
        <div className="flex-1"></div>
        
        {/* Execute/Cancel toggle button for specific tab */}
        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white"
          title="Clear all request data (URL, headers, body, params)"
        >
          Clear All
        </button>
        {activeTab?.isLoading && currentRequestId ? (
          <button
            onClick={handleCancelRequest}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white"
            title="Cancel current request"
          >
            Cancel
          </button>
        ) : (
          <button 
            onClick={handleExecute}
            disabled={!activeTab?.data.request.url}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium ${
              !activeTab?.data.request.url
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-gray-900 text-white hover:bg-black'
            }`}
          >
            Execute
          </button>
        )}
      </div>

      {/* Third layer - Request and Response tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-300 bg-white">
          <button
            onClick={() => handleContentTabClick('monitor')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeContentTab === 'monitor'
              ? 'bg-white border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Monitor
          </button>
          <button
            onClick={() => handleContentTabClick('request')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeContentTab === 'request'
              ? 'bg-white border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Request
          </button>
          <button
            onClick={() => handleContentTabClick('response')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeContentTab === 'response'
              ? 'bg-white border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Response
          </button>
        </div>

        {/* Monitor tab content */}
        <div className={`flex-1 min-h-0 overflow-auto ${activeContentTab !== 'monitor' ? 'hidden' : ''}`}>
          <MonitorTab 
            onRequestSelect={handleMonitoredRequestSelect} 
            onRequestDoubleClick={handleMonitoredRequestDoubleClick}
            onRequestCountChange={handleMonitorRequestCountChange}
          />
        </div>

        {/* Request tab content */}
        <div className={`flex-1 min-h-0 overflow-auto ${activeContentTab !== 'request' ? 'hidden' : ''}`}>
          <div className="p-3 bg-white h-full">
            {activeTab && (
              <RequestForm
                key={`${activeTabId}-${clearCounter}`}
                request={activeTab.data.request}
                onRequestChange={handleRequestChange}
              />
            )}
          </div>
        </div>

        {/* Response tab content */}
        <div className={`flex-1 min-h-0 overflow-auto ${activeContentTab !== 'response' ? 'hidden' : ''}`}>
          <div className="p-3 bg-white h-full">
            {activeTab && (
              <ResponseView
                response={activeTab.data.response}
                isLoading={activeTab.isLoading}
                error={activeTab.lastError}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom layer for footer */}
      <div className="h-8 border-t border-gray-300 px-3 text-xs text-gray-600 flex items-center justify-between bg-gray-100">
        <div className="flex items-center space-x-4">
          {activeContentTab === 'monitor' && (
            <span className="font-medium">
              {monitorRequestCounts.filtered} of {monitorRequestCounts.total} request{monitorRequestCounts.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-800 border border-gray-200">
          Ready
        </span>
      </div>

      {/* Copy Feedback */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 bg-gray-100 border border-gray-400 text-gray-700 px-4 py-2 rounded-md shadow-lg z-50">
          {copyFeedback}
        </div>
      )}

      {/* Request Command Modal */}
      {modalState.isOpen && (
        <FetchCurlModal
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
          initialValue={modalState.initialValue || ''}
        />
      )}
    </div>
  );
};



export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
