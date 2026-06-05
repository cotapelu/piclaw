/**
 * Extension Configuration
 *
 * Cấu hình extensions cho AgentSessionServices
 */

import extensionsAggregator from './extensions/index.js';

/**
 * Trả về extension factories cho resourceLoaderOptions
 */
export function getExtensionFactories() {
  return [extensionsAggregator];
}

/**
 * Trả về resourceLoaderOptions hoàn chỉnh
 */
export function getResourceLoaderOptions() {
  return {
    extensionFactories: getExtensionFactories(),
  };
}
