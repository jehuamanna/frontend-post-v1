import { Tab } from '../types';

const STORAGE_KEY = 'frontendpost_tabs';

export const saveTabsToStorage = async (tabs: Tab[]): Promise<void> => {
  try {
    // In a Chrome extension, we would use chrome.storage.local
    // For now, using localStorage as fallback
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: tabs });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    }
  } catch (error) {
    console.error('Failed to save tabs to storage:', error);
  }
};

export const loadTabsFromStorage = async (): Promise<Tab[]> => {
  try {
    // In a Chrome extension, we would use chrome.storage.local
    // For now, using localStorage as fallback
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      return result[STORAGE_KEY] || [];
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
  } catch (error) {
    console.error('Failed to load tabs from storage:', error);
    return [];
  }
};

export const clearTabsFromStorage = async (): Promise<void> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove([STORAGE_KEY]);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to clear tabs from storage:', error);
  }
};
