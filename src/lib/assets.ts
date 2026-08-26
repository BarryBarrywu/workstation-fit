const assetVersion = import.meta.env.PUBLIC_ASSET_VERSION?.trim();
const isToyEdition = import.meta.env.PUBLIC_SITE_EDITION === 'toy';

export function versionedAssetPath(path: string): string {
  const deploymentPath = isToyEdition ? path.replace(/^\//, './') : path;
  return assetVersion ? `${deploymentPath}?v=${encodeURIComponent(assetVersion)}` : deploymentPath;
}
