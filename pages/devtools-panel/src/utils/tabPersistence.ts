// Tab Position Persistence Utility
// Stores and retrieves tab order preferences for Request and Response sections

interface TabOrder {
  id: string;
  label: string;
}

interface TabPositions {
  request: TabOrder[];
  response: TabOrder[];
}

const STORAGE_KEY = 'tab-positions';

// Default tab orders
const DEFAULT_TAB_POSITIONS: TabPositions = {
  request: [
    { id: 'headers', label: 'Headers' },
    { id: 'params', label: 'Query Parameters' },
    { id: 'body', label: 'Body' }
  ],
  response: [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
    { id: 'cookies', label: 'Cookies' }
  ]
};

// Get stored tab positions or return defaults
export const getStoredTabPositions = (): TabPositions => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Validate structure and ensure all required tabs are present
      if (parsed.request && parsed.response && 
          Array.isArray(parsed.request) && Array.isArray(parsed.response)) {
        
        // Ensure all default tabs are present (in case new tabs were added)
        const requestTabs = ensureAllTabsPresent(parsed.request, DEFAULT_TAB_POSITIONS.request);
        const responseTabs = ensureAllTabsPresent(parsed.response, DEFAULT_TAB_POSITIONS.response);
        
        return {
          request: requestTabs,
          response: responseTabs
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load stored tab positions:', error);
  }
  
  return DEFAULT_TAB_POSITIONS;
};

// Ensure all required tabs are present in the stored order
const ensureAllTabsPresent = (storedTabs: TabOrder[], defaultTabs: TabOrder[]): TabOrder[] => {
  const storedIds = new Set(storedTabs.map(tab => tab.id));
  const result = [...storedTabs];
  
  // Add any missing tabs at the end
  defaultTabs.forEach(defaultTab => {
    if (!storedIds.has(defaultTab.id)) {
      result.push(defaultTab);
    }
  });
  
  // Remove any tabs that no longer exist in defaults
  return result.filter(tab => 
    defaultTabs.some(defaultTab => defaultTab.id === tab.id)
  );
};

// Store tab positions
export const storeTabPositions = (positions: TabPositions): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.warn('Failed to store tab positions:', error);
  }
};

// Get specific section tab order
export const getRequestTabOrder = (): TabOrder[] => {
  return getStoredTabPositions().request;
};

export const getResponseTabOrder = (): TabOrder[] => {
  return getStoredTabPositions().response;
};

// Update specific section tab order
export const updateRequestTabOrder = (newOrder: TabOrder[]): void => {
  const current = getStoredTabPositions();
  storeTabPositions({
    ...current,
    request: newOrder
  });
};

export const updateResponseTabOrder = (newOrder: TabOrder[]): void => {
  const current = getStoredTabPositions();
  storeTabPositions({
    ...current,
    response: newOrder
  });
};

// Reset to defaults
export const resetTabPositions = (): void => {
  storeTabPositions(DEFAULT_TAB_POSITIONS);
};

// Export types for use in components
export type { TabOrder, TabPositions };
