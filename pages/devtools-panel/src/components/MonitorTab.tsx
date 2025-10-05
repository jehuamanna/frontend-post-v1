import React, { useState, useEffect, useCallback } from 'react';
import { MonitoredRequest } from '../types';

interface MonitorTabProps {
  onRequestSelect: (request: MonitoredRequest) => void;
  onRequestDoubleClick: (request: MonitoredRequest) => void;
}

const MonitorTab: React.FC<MonitorTabProps> = ({ onRequestSelect, onRequestDoubleClick }): React.JSX.Element => {
  const [requests, setRequests] = useState<MonitoredRequest[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

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
    onRequestSelect(request);
  }, [onRequestSelect]);

  const handleRequestDoubleClick = useCallback((request: MonitoredRequest) => {
    onRequestDoubleClick(request);
  }, [onRequestDoubleClick]);

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status < 300) return 'text-gray-900 font-medium';
    if (status < 400) return 'text-gray-700';
    if (status < 500) return 'text-gray-600';
    return 'text-gray-800';
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

      {/* Request List */}
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
          <div className="divide-y divide-gray-100">
            {requests.map((request) => (
              <div
                key={request.id}
                onClick={() => handleRequestClick(request)}
                onDoubleClick={() => handleRequestDoubleClick(request)}
                className="p-3 hover:bg-gray-50 cursor-pointer border-l-4 border-transparent hover:border-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* Method Badge */}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(request.method)}`}>
                      {request.method}
                    </span>
                    
                    {/* URL */}
                    <span className="text-sm font-mono truncate flex-1" title={request.url}>
                      {formatUrl(request.url)}
                    </span>
                  </div>
                  
                  {/* Status and Timing */}
                  <div className="flex items-center space-x-3 text-xs">
                    <span className={`font-medium ${getStatusColor(request.status)}`}>
                      {request.status || 'Pending'}
                    </span>
                    <span className="text-gray-500">
                      {formatDuration(request.timing.duration)}
                    </span>
                    <span className="text-gray-400">
                      {new Date(request.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                {/* Additional Info */}
                {request.initiator && (
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    From: {request.initiator}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitorTab;
