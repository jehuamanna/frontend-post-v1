import '@src/Panel.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import CodeEditor from './components/CodeEditor';

const Panel = () => {
  return (
    <div className="h-screen w-screen max-h-screen max-w-screen flex flex-col">
      <div className="flex flex-col rounded-lg border border-gray-200 shadow-sm flex-1 min-h-0">
        {/* Top Bar: Tabs */}
        <div className="flex items-center border-b border-gray-200 px-2 py-1">
          <div className="flex space-x-1 overflow-x-auto">

          </div>
          <button onClick={() => { }} className="ml-1 rounded-lg border px-3 py-1 text-sm">
            +
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 px-2 py-2 border-b border-gray-200">
          <button onClick={() => { }} className="whitespace-nowrap">
            Clear
          </button>
          <button onClick={() => { }} className="whitespace-nowrap">
            Execute
          </button>
        </div>

        {/* Editors Area */}
        <div className="flex-1 min-h-0 p-3">
          <div className="grid grid-cols-2 gap-3 h-full">
            {/* Left monaco editor */}
            <div className="flex flex-col h-full min-h-0">
              <div className="mb-2 text-sm font-medium text-gray-700">Request</div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={'const jehu = "p";'}
                  onChange={() => { }}
                  language={'javascript'}
                  onCtrlEnter={() => { }}
                  height="100%"
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
            {/* Right monaco editor */}
            <div className="flex flex-col h-full min-h-0">
              <div className="mb-2 text-sm font-medium text-gray-700">Response</div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={'console.log(jehu);'}
                  onChange={() => {

                  }}
                  language={'javascript'}
                  readOnly={true}
                  height="100%"
                  className="flex-1 min-h-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-gray-200 px-3 text-xs text-gray-500 flex items-center justify-between">
          <span>FrontendPost - Jehu</span>

          <span
            className={`px-2 py-0.5 rounded border font-medium ${(() => {
              const code = 200;
              if (!isFinite(code)) return 'bg-gray-50 text-gray-600 border-gray-200';
              if (code >= 200 && code < 300) return 'bg-green-100 text-green-700 border-green-300';
              if (code >= 300 && code < 400) return 'bg-blue-100 text-blue-700 border-blue-300';
              if (code >= 400 && code < 500) return 'bg-amber-100 text-amber-700 border-amber-300';
              if (code >= 500) return 'bg-red-100 text-red-700 border-red-300';
              return 'bg-gray-50 text-gray-600 border-gray-200';
            })()}`}
            title="HTTP response status code"
          >
            203
          </span>
        </div>
      </div>
    </div>
  );
};



export default withErrorBoundary(withSuspense(Panel, <LoadingSpinner />), ErrorDisplay);
