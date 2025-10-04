import { readFileSync } from 'node:fs';
import type { ManifestType } from '@extension/shared';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

/**
 * Minimal manifest for a DevTools-only extension:
 * - No content_scripts
 * - No popup/action
 * - No options page or new tab override
 * - Only storage + debugger permissions
 * - DevTools panel defined by devtools_page
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  browser_specific_settings: {
    gecko: {
      id: 'example@example.com',
      strict_min_version: '109.0',
    },
  },
  version: packageJson.version,
  description: '__MSG_extensionDescription__',

  // Needed so you can capture/replay arbitrary requests
  host_permissions: ['<all_urls>'],

  // Keep only what's required + cookies for enhanced response data
  permissions: ['storage', 'debugger', 'cookies'],

  // Background script (optional but useful if you plan to attach debugger, etc.)
  background: {
    service_worker: 'background.js',
    type: 'module',
  },

  // This is the heart of a DevTools extension
  devtools_page: 'devtools/index.html',

  // Icons still useful for extension listing
  icons: {
    '128': 'icon-128.png',
  },

  // Only keep this if your devtools page needs to load bundled assets directly
  web_accessible_resources: [
    {
      resources: ['*.js', '*.css', '*.svg', 'icon-128.png'],
      matches: ['*://*/*'],
    },
  ],
} satisfies ManifestType;

export default manifest;
