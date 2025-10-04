import { useReducer, useCallback, useEffect, useState } from 'react';
import { Tab, HttpRequest, HttpResponse } from '../types';
import { createNewTab } from '../utils/tabUtils';
import { saveTabsToStorage, loadTabsFromStorage } from '../utils/storage';

// Action types for the reducer
type TabAction = 
  | { type: 'LOAD_TABS'; payload: Tab[] }
  | { type: 'CREATE_TAB'; payload: { name?: string; request?: Partial<HttpRequest> } }
  | { type: 'CLOSE_TAB'; payload: { tabId: string } }
  | { type: 'SWITCH_TAB'; payload: { tabId: string } }
  | { type: 'UPDATE_TAB'; payload: { tabId: string; updates: Partial<Tab> } }
  | { type: 'UPDATE_REQUEST'; payload: { tabId: string; request: Partial<HttpRequest> } }
  | { type: 'UPDATE_RESPONSE'; payload: { tabId: string; response: HttpResponse | null } }
  | { type: 'REORDER_TABS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'CLEAR_REQUEST'; payload: { tabId: string } };

// Tabs reducer function
const tabsReducer = (state: Tab[], action: TabAction): Tab[] => {
  switch (action.type) {
    case 'LOAD_TABS':
      return action.payload;
      
    case 'CREATE_TAB': {
      const newTab = createNewTab(action.payload.name, action.payload.request);
      newTab.isActive = true;
      return [
        ...state.map(tab => ({ ...tab, isActive: false })),
        newTab
      ];
    }
    
    case 'CLOSE_TAB': {
      const filteredTabs = state.filter(tab => tab.id !== action.payload.tabId);
      
      // Always maintain at least one tab
      if (filteredTabs.length === 0) {
        const defaultTab = createNewTab('New Request', { method: 'GET' });
        defaultTab.isActive = true;
        return [defaultTab];
      }
      
      // If we closed the active tab, activate the first remaining tab
      const wasActive = state.find(tab => tab.id === action.payload.tabId)?.isActive;
      if (wasActive) {
        return filteredTabs.map((tab, index) => ({
          ...tab,
          isActive: index === 0
        }));
      }
      
      return filteredTabs;
    }
    
    case 'SWITCH_TAB':
      return state.map(tab => ({
        ...tab,
        isActive: tab.id === action.payload.tabId
      }));
      
    case 'UPDATE_TAB':
      return state.map(tab =>
        tab.id === action.payload.tabId 
          ? { ...tab, ...action.payload.updates } 
          : tab
      );
      
    case 'UPDATE_REQUEST':
      return state.map(tab =>
        tab.id === action.payload.tabId
          ? {
              ...tab,
              data: {
                ...tab.data,
                request: {
                  url: action.payload.request.url ?? tab.data.request.url,
                  method: action.payload.request.method ?? tab.data.request.method,
                  body: action.payload.request.body ?? tab.data.request.body,
                  // Always create new object references - simple and reliable
                  headers: { ...(action.payload.request.headers ?? tab.data.request.headers) },
                  params: { ...(action.payload.request.params ?? tab.data.request.params) },
                }
              }
            }
          : tab
      );
      
    case 'UPDATE_RESPONSE':
      return state.map(tab =>
        tab.id === action.payload.tabId
          ? {
              ...tab,
              data: {
                ...tab.data,
                response: action.payload.response
              }
            }
          : tab
      );
      
    case 'REORDER_TABS': {
      const newTabs = [...state];
      const draggedTab = newTabs[action.payload.fromIndex];
      newTabs.splice(action.payload.fromIndex, 1);
      newTabs.splice(action.payload.toIndex, 0, draggedTab);
      return newTabs;
    }
    
    case 'CLEAR_REQUEST':
      return state.map(tab =>
        tab.id === action.payload.tabId
          ? {
              ...tab,
              name: 'New Request GET',
              data: {
                ...tab.data,
                request: {
                  url: '',
                  method: 'GET' as const,
                  headers: {},
                  body: '',
                  params: {}
                },
                rawCommand: '',
                commandType: undefined
              }
            }
          : tab
      );
      
    default:
      return state;
  }
};

interface TabsState {
  tabs: Tab[];
  isLoaded: boolean;
}

export const useTabs = () => {
  const [state, dispatch] = useReducer(tabsReducer, []);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const tabs = state;

  // Load tabs from storage on mount
  useEffect(() => {
    const loadTabs = async () => {
      try {
        const storedTabs = await loadTabsFromStorage();
        if (storedTabs.length > 0) {
          dispatch({ type: 'LOAD_TABS', payload: storedTabs });
        } else {
          // Initialize with one default tab if no stored tabs
          dispatch({ type: 'CREATE_TAB', payload: { name: 'New Request', request: { method: 'GET' } } });
        }
      } catch (error) {
        console.error('Failed to load tabs:', error);
        // Fallback to default tab
        dispatch({ type: 'CREATE_TAB', payload: { name: 'New Request', request: { method: 'GET' } } });
      } finally {
        setIsLoaded(true);
      }
    };

    loadTabs();
  }, []);
  const activeTab = tabs.find(tab => tab.isActive);
  const activeTabId = activeTab?.id || '';

  const createTab = useCallback((name?: string, request?: Partial<HttpRequest>): string => {
    const newTab = createNewTab(name, request);
    dispatch({ type: 'CREATE_TAB', payload: { name, request } });
    return newTab.id;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', payload: { tabId } });
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    dispatch({ type: 'UPDATE_TAB', payload: { tabId, updates } });
  }, []);

  const updateRequest = useCallback((tabId: string, request: Partial<HttpRequest>) => {
    dispatch({ type: 'UPDATE_REQUEST', payload: { tabId, request } });
  }, []);

  const clearRequest = useCallback((tabId: string) => {
    dispatch({ type: 'CLEAR_REQUEST', payload: { tabId } });
  }, []);

  const updateResponse = useCallback((tabId: string, response: HttpResponse | null) => {
    dispatch({ type: 'UPDATE_RESPONSE', payload: { tabId, response } });
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_TABS', payload: { fromIndex, toIndex } });
  }, []);

  const switchTab = useCallback((tabId: string) => {
    dispatch({ type: 'SWITCH_TAB', payload: { tabId } });
  }, []);

  // Auto-save functionality (debounced)
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete

    const timeoutId = setTimeout(() => {
      saveTabsToStorage(tabs);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [tabs, isLoaded]);

  return {
    tabs,
    activeTab,
    activeTabId,
    isLoaded,
    createTab,
    closeTab,
    switchTab,
    updateTab,
    updateRequest,
    updateResponse,
    reorderTabs,
    clearRequest,
  };
};
