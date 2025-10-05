import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MonitoredRequest } from '../types';

interface MonitorTabProps {
  onRequestSelect: (request: MonitoredRequest) => void;
  onRequestDoubleClick: (request: MonitoredRequest) => void;
}

type SortField = 'method' | 'url' | 'status' | 'duration' | 'timestamp';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const MonitorTab: React.FC<MonitorTabProps> = ({ onRequestSelect, onRequestDoubleClick }): React.JSX.Element => {
  const [requests, setRequests] = useState<MonitoredRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'timestamp', direction: 'desc' });
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Cleanup click timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  // Initialize Chrome runtime connection with auto-reconnect
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;
    let currentPort: chrome.runtime.Port | null = null;

    const connectToBackground = () => {
      try {
        console.log('🔌 Attempting to connect to background script...');
        const runtimePort = chrome.runtime.connect({ name: 'devtools-panel' });
        currentPort = runtimePort;
        setPort(runtimePort);

        runtimePort.onMessage.addListener((message) => {
          if (message.type === 'REQUEST_CAPTURED') {
            setRequests(prev => [message.request, ...prev.slice(0, 99)]); // Keep last 100 requests
          } else if (message.type === 'REQUEST_COMPLETED') {
            setRequests(prev => prev.map(req => 
              req.id === message.request.id ? message.request : req
            ));
          } else if (message.type === 'MONITORING_STATUS') {
            // Sync monitoring state with background script
            setIsMonitoring(message.isMonitoring);
            console.log('📡 Synced monitoring state:', message.isMonitoring);
          }
        });

        runtimePort.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          console.log('Monitor port disconnected:', error?.message || 'Clean disconnect');
          setPort(null);
          setIsMonitoring(false);
          currentPort = null;

          // Auto-reconnect after 2 seconds if not a clean shutdown
          if (!error?.message?.includes('Extension context invalidated')) {
            console.log('🔄 Scheduling reconnection in 2 seconds...');
            reconnectTimer = setTimeout(() => {
              connectToBackground();
            }, 2000);
          }
        });

        console.log('✅ Successfully connected to background script');
        
        // Request current monitoring status to sync UI state
        setTimeout(async () => {
          try {
            const tabId = await getCurrentTabId();
            runtimePort.postMessage({ 
              type: 'GET_MONITORING_STATUS', 
              tabId 
            });
          } catch (error) {
            console.warn('Failed to request monitoring status:', error);
          }
        }, 100); // Small delay to ensure connection is fully established
      } catch (error) {
        console.error('Failed to connect to background script:', error);
        // Retry connection after 5 seconds
        reconnectTimer = setTimeout(() => {
          connectToBackground();
        }, 5000);
      }
    };

    // Initial connection
    connectToBackground();

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (currentPort) {
        currentPort.disconnect();
      }
    };
  }, []);

  const getCurrentTabId = useCallback(async (): Promise<number> => {
    return new Promise((resolve) => {
      const tabId = chrome.devtools.inspectedWindow.tabId;
      resolve(tabId || 0);
    });
  }, []);

  const handleStartMonitoring = useCallback(async () => {
    if (!port) return;

    try {
      const tabId = await getCurrentTabId();
      port.postMessage({ 
        type: 'START_MONITORING', 
        tabId 
      });
      setIsMonitoring(true);
      console.log('Started monitoring tab:', tabId);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  }, [port, getCurrentTabId]);

  const handleStopMonitoring = useCallback(async () => {
    if (!port) return;

    try {
      const tabId = await getCurrentTabId();
      port.postMessage({ 
        type: 'STOP_MONITORING', 
        tabId 
      });
      setIsMonitoring(false);
      console.log('Stopped monitoring tab:', tabId);
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  }, [port, getCurrentTabId]);

  const handleClearRequests = useCallback(() => {
    setRequests([]);
  }, []);

  const handleRequestClick = useCallback((request: MonitoredRequest) => {
    // Clear any existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
      // This is a double-click, call the double-click handler
      console.log('🖱️ Double-click detected, creating new tab for:', request.url);
      onRequestDoubleClick(request);
      return;
    }

    // Set a timer for single-click detection
    const timer = setTimeout(() => {
      console.log('🖱️ Single-click detected, populating current tab for:', request.url);
      onRequestSelect(request);
      setClickTimer(null);
    }, 250); // 250ms delay to detect double-click

    setClickTimer(timer);
  }, [onRequestSelect, onRequestDoubleClick, clickTimer]);

  const handleRequestDoubleClick = useCallback((request: MonitoredRequest) => {
    // This is handled by the click handler now
    // Just prevent default to avoid any browser double-click behavior
  }, []);

  // Sorting functionality
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Sorted requests
  const sortedRequests = useMemo(() => {
    const sorted = [...requests].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortConfig.field) {
        case 'method':
          aValue = a.method;
          bValue = b.method;
          break;
        case 'url':
          aValue = a.url.toLowerCase();
          bValue = b.url.toLowerCase();
          break;
        case 'status':
          aValue = a.status || 0;
          bValue = b.status || 0;
          break;
        case 'duration':
          aValue = a.timing.duration || 0;
          bValue = b.timing.duration || 0;
          break;
        case 'timestamp':
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [requests, sortConfig]);

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500 bg-gray-100 px-2 py-1 rounded text-xs';
    if (status < 300) return 'text-gray-900 bg-gray-200 px-2 py-1 rounded font-medium text-xs'; // Success - light gray
    if (status < 400) return 'text-gray-700 bg-gray-200 px-2 py-1 rounded text-xs'; // Redirect - medium gray  
    if (status < 500) return 'text-gray-600 bg-gray-300 px-2 py-1 rounded text-xs'; // Client error - darker gray
    return 'text-gray-800 bg-gray-400 px-2 py-1 rounded font-medium text-xs'; // Server error - darkest gray
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-white text-gray-900 border border-gray-300';
      case 'POST': return 'bg-gray-900 text-white';
      case 'PUT': return 'bg-gray-700 text-white';
      case 'DELETE': return 'bg-gray-500 text-white';
      case 'PATCH': return 'bg-gray-600 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.pathname}${urlObj.search}`;
    } catch {
      return url;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    if (duration < 1000) return `${Math.round(duration)}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Monitor Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-gray-50">
        <div className="flex items-center space-x-3">
          <button
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            disabled={!port}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              isMonitoring 
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                : 'bg-gray-900 text-white hover:bg-black'
            } ${!port ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitor
          </button>
          
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-gray-900' : 'bg-gray-400'}`} />
            <span>{isMonitoring ? 'Monitoring' : 'Stopped'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleClearRequests}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Request Table */}
      <div className="flex-1 overflow-auto">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-sm text-center">
              {!port ? (
                <div>
                  <div className="font-medium text-gray-700 mb-2">Monitor Tab Loaded</div>
                  <div>Connecting to background script...</div>
                </div>
              ) : isMonitoring ? (
                <div>
                  <div className="font-medium text-gray-700 mb-2">Monitoring Active</div>
                  <div>Waiting for network requests...</div>
                  <div className="text-xs mt-2 text-gray-400">Browse the website to see requests appear here</div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-gray-700 mb-2">Monitor Ready</div>
                  <div>Click "Start Monitor" to capture network requests</div>
                  <div className="text-xs mt-2 text-gray-400">Requests from the current tab will appear here</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full text-xs">
              {/* Table Header */}
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th 
                    onClick={() => handleSort('method')}
                    className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Method</span>
                      {sortConfig.field === 'method' && (
                        <span className="text-gray-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('url')}
                    className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>URL</span>
                      {sortConfig.field === 'url' && (
                        <span className="text-gray-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none w-20"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                      {sortConfig.field === 'status' && (
                        <span className="text-gray-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('duration')}
                    className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none w-20"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Time</span>
                      {sortConfig.field === 'duration' && (
                        <span className="text-gray-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('timestamp')}
                    className="px-3 py-2 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors select-none w-24"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Timestamp</span>
                      {sortConfig.field === 'timestamp' && (
                        <span className="text-gray-500">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              
              {/* Table Body */}
              <tbody className="divide-y divide-gray-100">
                {sortedRequests.map((request) => (
                  <tr
                    key={request.id}
                    onClick={() => handleRequestClick(request)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Method */}
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(request.method)}`}>
                        {request.method}
                      </span>
                    </td>
                    
                    {/* URL */}
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs truncate max-w-xs" title={request.url}>
                        {formatUrl(request.url)}
                      </div>
                      {request.initiator && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {request.initiator}
                        </div>
                      )}
                    </td>
                    
                    {/* Status */}
                    <td className="px-3 py-2">
                      <span className={getStatusColor(request.status)}>
                        {request.status || 'Pending'}
                      </span>
                    </td>
                    
                    {/* Duration */}
                    <td className="px-3 py-2 text-gray-600">
                      {formatDuration(request.timing.duration)}
                    </td>
                    
                    {/* Timestamp */}
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitorTab;
