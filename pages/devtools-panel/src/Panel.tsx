import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useCallback } from 'react';
import { useTabs } from './hooks/useTabs';
import { TabBar } from './components/TabBar';
import { RequestForm } from './components/RequestForm';
import { ResponseView } from './components/ResponseView';
import { FetchCurlModal } from './components/FetchCurlModal';
import { HttpRequest, HttpResponse } from './types';
import { chromeHttpClient } from './utils/chromeHttpClient';

const Panel = () => {
  const [activeContentTab, setActiveContentTab] = useState<'request' | 'response'>('request');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    initialValue?: string;
  }>({ isOpen: false });
  const [clearCounter, setClearCounter] = useState(0);

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

  const handleContentTabClick = useCallback((tab: 'request' | 'response') => {
    setActiveContentTab(tab);
  }, []);

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
  }, [activeTabId, activeTab, updateTab, updateRequest]);

  const handleClear = useCallback(() => {
    if (activeTabId) {
      // Use the dedicated clearRequest action from reducer
      clearRequest(activeTabId);
      
      // Force component re-render by incrementing clear counter
      setClearCounter(prev => prev + 1);
    }
  }, [activeTabId, clearRequest]);

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
      // Execute the HTTP request using Chrome Extension client
      const response = await executeRequestWithChromeClient(request);
      
      // Update response in tab
      updateResponse(activeTabId, response);
      
      // Switch to response tab to show results
      setActiveContentTab('response');
      
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
        <div className="flex-1"></div>
        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white"
        >
          Clear
        </button>
        <button 
          onClick={handleExecute}
          disabled={!activeTab?.data.request.url || activeTab?.isLoading}
          className={`px-3 py-1.5 text-xs rounded transition-colors font-medium ${
            !activeTab?.data.request.url || activeTab?.isLoading
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-black'
          }`}
        >
          {activeTab?.isLoading ? 'Executing...' : 'Execute'}
        </button>
      </div>

      {/* Third layer - Request and Response tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-300 bg-white">
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
        <span className="font-medium">FrontendPost - API Testing Tool</span>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-800 border border-green-200">
          Ready
        </span>
      </div>

      {/* Fetch/cURL Modal */}
      <FetchCurlModal
        isOpen={modalState.isOpen}
        initialValue={modalState.initialValue}
        onClose={handleModalClose}
        onSave={handleModalSave}
      />
    </div>
  );
};



export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
