import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useCallback } from 'react';

const Panel = () => {
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  const handleTabClick = useCallback((tab: 'request' | 'response') => {
    setActiveTab(tab);
  }, []);
  return (
    <div className="h-screen w-screen max-h-screen max-w-screen flex flex-col bg-white">
      {/* Top layer for tabs */}
      <div className="flex items-center border-b border-gray-300 px-3 py-2 bg-gray-100">
        <div className="flex space-x-2 overflow-x-auto">
          <button className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors">
            Request 1
          </button>
          <button className="px-4 py-2 text-sm text-gray-600 hover:bg-white hover:border-gray-300 border border-transparent rounded-md transition-colors">
            Request 2
          </button>
          <button className="px-4 py-2 text-sm text-gray-600 hover:bg-white hover:border-gray-300 border border-transparent rounded-md transition-colors">
            Request 3
          </button>
        </div>
        <button className="ml-3 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm">
          +
        </button>
      </div>

      {/* Second layer for action bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-300 bg-white">
        <button className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-black transition-colors font-medium shadow-sm">
          Add Fetch
        </button>
        <button className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors font-medium shadow-sm">
          Add cURL
        </button>
        <div className="flex-1"></div>
        <button className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium text-gray-700 bg-white shadow-sm">
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
            onClick={() => handleTabClick('request')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'request'
                ? 'bg-white border-b-2 border-gray-900 text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Request
          </button>
          <button
            onClick={() => handleTabClick('response')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'response'
                ? 'bg-white border-b-2 border-gray-900 text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
          >
            Response
          </button>
        </div>

        {/* Request tab content */}
        <div className={`flex-1 min-h-0 p-6 bg-white ${activeTab !== 'request' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col space-y-6">
            {/* URL Input */}
            <div className="flex gap-3">
              <select className="px-4 py-3 border border-gray-300 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
                <option>PATCH</option>
              </select>
              <input
                type="text"
                placeholder="https://api.example.com/users"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>

            {/* Headers and Body sections */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Headers section */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Headers</h3>
                <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        placeholder="Content-Type"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      <input
                        placeholder="application/json"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        placeholder="Authorization"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                      <input
                        placeholder="Bearer token..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                      />
                    </div>
                    <button className="text-xs text-gray-600 hover:text-gray-900 font-medium">+ Add Header</button>
                  </div>
                </div>
              </div>

              {/* Body section */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Body</h3>
                <div className="flex-1 min-h-0 border border-gray-300 rounded-md shadow-sm">
                  <textarea
                    className="w-full h-full p-4 text-sm font-mono resize-none border-0 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
                    placeholder='{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Response tab content */}
        <div className={`flex-1 min-h-0 p-6 bg-white ${activeTab !== 'response' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col space-y-6">
            {/* Response status */}
            <div className="flex items-center gap-6">
              <span className="px-3 py-2 bg-green-50 text-green-800 border border-green-200 rounded-md text-sm font-semibold shadow-sm">
                200 OK
              </span>
              <span className="text-sm text-gray-700 font-medium">Response time: 245ms</span>
              <span className="text-sm text-gray-700 font-medium">Size: 1.2KB</span>
            </div>

            {/* Response sections */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-6">
              {/* Body */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Body</h3>
                <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                  <pre className="text-sm font-mono text-gray-800 leading-relaxed">
                    {`{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-01T00:00:00Z"
}`}
                  </pre>
                </div>
              </div>

              {/* Headers */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Headers</h3>
                <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold text-gray-900">content-type:</span> <span className="text-gray-700">application/json</span></div>
                    <div><span className="font-semibold text-gray-900">server:</span> <span className="text-gray-700">nginx/1.18.0</span></div>
                    <div><span className="font-semibold text-gray-900">date:</span> <span className="text-gray-700">Mon, 01 Jan 2024 00:00:00 GMT</span></div>
                  </div>
                </div>
              </div>

              {/* Cookies */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Cookies</h3>
                <div className="flex-1 min-h-0 border border-gray-300 rounded-md p-4 bg-gray-50 overflow-auto shadow-sm">
                  <div className="space-y-2 text-sm">
                    <div><span className="font-semibold text-gray-900">session_id:</span> <span className="text-gray-700">abc123...</span></div>
                    <div><span className="font-semibold text-gray-900">csrf_token:</span> <span className="text-gray-700">xyz789...</span></div>
                  </div>
                </div>
              </div>
            </div>
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
    </div>
  );
};



export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
