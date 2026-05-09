import type { AssetRecord } from "service/assetStorage";
import { getAssetFileUrl, getAssetStoragePath } from "service/assetStorage";
import type { AllNodeType } from "shared/types/flow";

const countMatches = (value: unknown, candidates: Set<string>): number => {
  if (typeof value === "string") {
    return candidates.has(value) ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countMatches(item, candidates), 0);
  }

  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (sum, item) => sum + countMatches(item, candidates),
      0,
    );
  }

  return 0;
};

export const countAssetReferencesInCanvas = (
  asset: AssetRecord,
  nodes: AllNodeType[],
) => {
  const assetStoragePath = getAssetStoragePath();
  const candidates = new Set(
    [
      asset.fileUrl,
      asset.originalFile,
      asset.coverUrl,
      asset.coverFile,
      getAssetFileUrl(assetStoragePath, asset.fileUrl),
      asset.coverUrl ? getAssetFileUrl(assetStoragePath, asset.coverUrl) : "",
    ].filter(Boolean),
  );

  return nodes.reduce(
    (sum, node) => sum + countMatches(node.data, candidates),
    0,
  );
};
