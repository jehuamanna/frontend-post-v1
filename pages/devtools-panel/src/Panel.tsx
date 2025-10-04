import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import CodeEditor from './components/CodeEditor';
import { useState, useCallback } from 'react';

const Panel = () => {
  const [request, setRequest] = useState('const jehu = "p";');
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');
  
  const onChangeRequest = useCallback((val: string) => {
    setRequest(val);
  }, []);
  
  const [response, setResponse] = useState(`{
  "message": "Hello World",
  "status": "success", 
  "data": {
    "user": "jehu",
    "timestamp": "2024-01-01T00:00:00Z",
    "details": {
      "id": 12345,
      "name": "Test User",
      "email": "test@example.com",
      "preferences": {
        "theme": "dark",
        "notifications": true,
        "language": "en"
      }
    },
    "items": [
      {"id": 1, "name": "Item 1", "value": 100},
      {"id": 2, "name": "Item 2", "value": 200},
      {"id": 3, "name": "Item 3", "value": 300},
      {"id": 4, "name": "Item 4", "value": 400},
      {"id": 5, "name": "Item 5", "value": 500}
    ],
    "metadata": {
      "version": "1.0.0",
      "created": "2024-01-01T00:00:00Z",
      "updated": "2024-01-01T12:00:00Z",
      "tags": ["api", "response", "json", "test"]
    }
  }
}`);
  
  const onChangeResponse = useCallback((val: string) => {
    setResponse(val);
  }, []);

  const handleTabClick = useCallback((tab: 'request' | 'response') => {
    setActiveTab(tab);
  }, []);
  return (
    <div className="h-screen w-screen max-h-screen max-w-screen flex flex-col">
      {/* Top layer for tabs */}
      <div className="flex items-center border-b border-gray-200 px-2 py-1 bg-gray-50">
        <div className="flex space-x-1 overflow-x-auto">
          <button className="px-3 py-1 text-sm bg-white border rounded">Request 1</button>
          <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Request 2</button>
          <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded">Request 3</button>
        </div>
        <button className="ml-1 rounded-lg border px-3 py-1 text-sm hover:bg-gray-100">+</button>
      </div>

      {/* Second layer for action bar */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200 bg-white">
        <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          Add Fetch
        </button>
        <button className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600">
          Add cURL
        </button>
        <div className="flex-1"></div>
        <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
          Clear
        </button>
        <button className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600">
          Execute
        </button>
      </div>

      {/* Third layer - Request and Response tabs */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => handleTabClick('request')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'request' 
                ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Request
          </button>
          <button 
            onClick={() => handleTabClick('response')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'response' 
                ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Response
          </button>
        </div>

        {/* Request tab content */}
        <div className={`flex-1 min-h-0 p-4 bg-white ${activeTab !== 'request' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col space-y-4">
            {/* URL Input */}
            <div className="flex gap-2">
              <select className="px-3 py-2 border rounded text-sm font-medium">
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>DELETE</option>
              </select>
              <input 
                type="text" 
                placeholder="https://api.example.com/users"
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
            </div>

            {/* Headers and Body sections */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
              {/* Headers section */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Headers</h3>
                <div className="flex-1 min-h-0 border rounded p-3 bg-gray-50">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input placeholder="Content-Type" className="flex-1 px-2 py-1 border rounded text-xs" />
                      <input placeholder="application/json" className="flex-1 px-2 py-1 border rounded text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <input placeholder="Authorization" className="flex-1 px-2 py-1 border rounded text-xs" />
                      <input placeholder="Bearer token..." className="flex-1 px-2 py-1 border rounded text-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Body section */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Body</h3>
                <div className="flex-1 min-h-0 border rounded">
                  <textarea 
                    className="w-full h-full p-3 text-sm font-mono resize-none border-0 rounded"
                    placeholder='{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Response tab content */}
        <div className={`flex-1 min-h-0 p-4 bg-white ${activeTab !== 'response' ? 'hidden' : ''}`}>
          <div className="h-full flex flex-col space-y-4">
            {/* Response status */}
            <div className="flex items-center gap-4">
              <span className="px-2 py-1 bg-green-100 text-green-700 border border-green-300 rounded text-sm font-medium">
                200 OK
              </span>
              <span className="text-sm text-gray-600">Response time: 245ms</span>
              <span className="text-sm text-gray-600">Size: 1.2KB</span>
            </div>

            {/* Response sections */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">
              {/* Body */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Body</h3>
                <div className="flex-1 min-h-0 border rounded p-3 bg-gray-50 overflow-auto">
                  <pre className="text-xs font-mono text-gray-800">
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
                <h3 className="text-sm font-medium text-gray-700 mb-2">Headers</h3>
                <div className="flex-1 min-h-0 border rounded p-3 bg-gray-50 overflow-auto">
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">content-type:</span> application/json</div>
                    <div><span className="font-medium">server:</span> nginx/1.18.0</div>
                    <div><span className="font-medium">date:</span> Mon, 01 Jan 2024 00:00:00 GMT</div>
                  </div>
                </div>
              </div>

              {/* Cookies */}
              <div className="flex flex-col min-h-0">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Cookies</h3>
                <div className="flex-1 min-h-0 border rounded p-3 bg-gray-50 overflow-auto">
                  <div className="space-y-1 text-xs">
                    <div><span className="font-medium">session_id:</span> abc123...</div>
                    <div><span className="font-medium">csrf_token:</span> xyz789...</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom layer for footer */}
      <div className="h-8 border-t border-gray-200 px-3 text-xs text-gray-500 flex items-center justify-between bg-gray-50">
        <span>FrontendPost - API Testing Tool</span>
        <span className="px-2 py-0.5 rounded border font-medium bg-green-100 text-green-700 border-green-300">
          Ready
        </span>
      </div>
    </div>
  );
};



export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
