import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useCallback } from 'react';
import { useTabs } from './hooks/useTabs';
import { TabBar } from './components/TabBar';
import { RequestForm } from './components/RequestForm';
import { ResponseView } from './components/ResponseView';
import { FetchCurlModal } from './components/FetchCurlModal';
import { HttpRequest } from './types';

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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-300 bg-white">
        <button
          onClick={handleRequestCommand}
          className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black transition-colors font-medium shadow-sm"
        >
          Request Command
        </button>
        <div className="flex-1"></div>
        <button
          onClick={handleClear}
          className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white shadow-sm"
        >
          Clear
        </button>
        <button className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black transition-colors font-medium shadow-sm">
          Execute
        </button>
      </div>

      {/* Third layer - Request and Response tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-300 bg-gray-50">
          <button
            onClick={() => handleContentTabClick('request')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeContentTab === 'request'
              ? 'bg-white border-b-2 border-gray-900 text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Request
          </button>
          <button
            onClick={() => handleContentTabClick('response')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeContentTab === 'response'
              ? 'bg-white border-b-2 border-gray-900 text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Response
          </button>
        </div>

        {/* Request tab content */}
        <div className={`flex-1 min-h-0 overflow-auto ${activeContentTab !== 'request' ? 'hidden' : ''}`}>
          <div className="p-6 bg-white h-full">
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
          <div className="p-6 bg-white h-full">
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
      <div className="h-10 border-t border-gray-300 px-4 text-sm text-gray-600 flex items-center justify-between bg-gray-100">
        <span className="font-medium">FrontendPost - API Testing Tool</span>
        <span className="px-3 py-1 rounded-md border font-medium bg-green-50 text-green-800 border-green-200 shadow-sm">
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
