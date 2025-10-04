import React, { useState } from 'react';
import { Tab } from '../types';
import { getMethodColor, truncateTabName, formatTabName } from '../utils/tabUtils';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabReorder?: (fromIndex: number, toIndex: number) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabReorder,
}) => {
  const [draggedTab, setDraggedTab] = useState<number | null>(null);
  const [dragOverTab, setDragOverTab] = useState<number | null>(null);
  
  return (
    <div className="flex items-center border-b border-gray-300 px-2 py-1.5 bg-gray-100">
      <div 
        className="flex space-x-1 overflow-x-auto relative"
        style={{ contain: 'layout' }}
        onDragOver={(e) => {
          // Only allow drops within the tab container
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          // Prevent drops outside of individual tabs
          e.preventDefault();
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const displayName = truncateTabName(formatTabName(tab.name, tab.data.request.method));
          const methodColorClass = getMethodColor(tab.data.request.method);
          
          return (
            <div
              key={tab.id}
              draggable={onTabReorder ? true : false}
              className={`group relative flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors ${
                onTabReorder ? 'cursor-move' : 'cursor-pointer'
              } ${
                isActive
                  ? 'bg-white border border-gray-300 shadow-sm font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-white hover:border-gray-300 border border-transparent'
              } ${
                draggedTab === index ? 'opacity-50' : ''
              } ${
                dragOverTab === index && draggedTab !== index ? 'border-l-4 border-blue-500' : ''
              }`}
              onClick={() => onTabClick(tab.id)}
              onDragStart={(e) => {
                if (!onTabReorder) return;
                setDraggedTab(index);
                e.dataTransfer.effectAllowed = 'move';
                
                // Create a transparent 1x1 pixel drag image to hide the default ghost
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.globalAlpha = 0;
                  ctx.fillRect(0, 0, 1, 1);
                }
                e.dataTransfer.setDragImage(canvas, 0, 0);
                e.dataTransfer.setData('text/plain', '');
              }}
              onDragOver={(e) => {
                if (!onTabReorder) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverTab(index);
              }}
              onDragLeave={(e) => {
                // Only clear drag over if we're actually leaving the tab area
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;
                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                  setDragOverTab(null);
                }
              }}
              onDrop={(e) => {
                if (!onTabReorder) return;
                e.preventDefault();
                if (draggedTab === null || draggedTab === index) return;
                
                onTabReorder(draggedTab, index);
                setDraggedTab(null);
                setDragOverTab(null);
              }}
              onDragEnd={() => {
                setDraggedTab(null);
                setDragOverTab(null);
              }}
            >
              {/* Status indicator */}
              <div className="flex items-center gap-2">
                {tab.isLoading && (
                  <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                )}
                {!tab.isLoading && tab.data.response && (
                  <div className={`w-2 h-2 rounded-full ${
                    tab.data.response.status >= 200 && tab.data.response.status < 300
                      ? 'bg-green-500'
                      : tab.data.response.status >= 400
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                  }`} />
                )}
                {!tab.isLoading && !tab.data.response && tab.lastError && (
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                )}
                {!tab.isLoading && !tab.data.response && !tab.lastError && (
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                )}
              </div>

              {/* Tab name */}
              <span className="truncate">{tab.name}</span>

              {/* HTTP method badge */}
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${methodColorClass}`}>
                {tab.data.request.method}
              </span>
              
              {/* Drag handle */}
              {onTabReorder && (
                <span className="ml-1 text-xs text-gray-400">⋮⋮</span>
              )}

              {/* Close button */}
              {tabs.length > 1 && (
                <button
                  className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Add new tab button */}
      <button
        className="ml-3 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        onClick={onNewTab}
      >
        +
      </button>
    </div>
  );
};
