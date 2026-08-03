const assetVersion = import.meta.env.PUBLIC_ASSET_VERSION?.trim();

export function versionedAssetPath(path: string): string {
  return assetVersion ? `${path}?v=${encodeURIComponent(assetVersion)}` : path;
}
