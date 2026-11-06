/**
 * Product identity. Kept in one place so the application name can be
 * changed without touching UI code or build configuration.
 */
export const PRODUCT = {
  name: 'OpenWhiteboard Studio',
  shortName: 'OpenWhiteboard',
  slug: 'openwhiteboard-studio',
  version: '0.1.0',
  license: 'MIT',
  projectExtension: 'owsproj',
  projectFileFilterName: 'OpenWhiteboard Project',
  assetScheme: 'ows-asset',
  libraryScheme: 'ows-library'
} as const

export type ProductInfo = typeof PRODUCT
