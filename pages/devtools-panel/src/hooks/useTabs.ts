import { useState, useCallback, useEffect } from 'react';
import { Tab, HttpRequest, HttpResponse } from '../types';
import { createNewTab } from '../utils/tabUtils';
import { saveTabsToStorage, loadTabsFromStorage } from '../utils/storage';

export const useTabs = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tabs from storage on mount
  useEffect(() => {
    const loadTabs = async () => {
      try {
        const storedTabs = await loadTabsFromStorage();
        if (storedTabs.length > 0) {
          setTabs(storedTabs);
        } else {
          // Initialize with one default tab if no stored tabs
          const defaultTab = createNewTab('New Request', { method: 'GET' });
          defaultTab.isActive = true;
          setTabs([defaultTab]);
        }
      } catch (error) {
        console.error('Failed to load tabs:', error);
        // Fallback to default tab
        const defaultTab = createNewTab('New Request', { method: 'GET' });
        defaultTab.isActive = true;
        setTabs([defaultTab]);
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
    
    setTabs(prevTabs => {
      // Deactivate all existing tabs
      const updatedTabs = prevTabs.map(tab => ({ ...tab, isActive: false }));
      // Add new active tab
      newTab.isActive = true;
      return [...updatedTabs, newTab];
    });
    
    return newTab.id;
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const filteredTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      // Always maintain at least one tab
      if (filteredTabs.length === 0) {
        const defaultTab = createNewTab('New Request', { method: 'GET' });
        defaultTab.isActive = true;
        return [defaultTab];
      }
      
      // If we closed the active tab, activate the first remaining tab
      const wasActive = prevTabs.find(tab => tab.id === tabId)?.isActive;
      if (wasActive) {
        const updatedTabs = filteredTabs.map((tab, index) => ({
          ...tab,
          isActive: index === 0
        }));
        return updatedTabs;
      }
      
      return filteredTabs;
    });
  }, []);

  const switchTab = useCallback((tabId: string) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      }))
    );
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      )
    );
  }, []);

  const updateRequest = useCallback((tabId: string, request: Partial<HttpRequest>) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              data: {
                ...tab.data,
                request: { ...tab.data.request, ...request }
              }
            }
          : tab
      )
    );
  }, []);

  const updateResponse = useCallback((tabId: string, response: HttpResponse | null) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId
          ? {
              ...tab,
              data: {
                ...tab.data,
                response
              }
            }
          : tab
      )
    );
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs(prevTabs => {
      const newTabs = [...prevTabs];
      const draggedTab = newTabs[fromIndex];
      newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, draggedTab);
      return newTabs;
    });
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
  };
};
