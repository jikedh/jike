import { HardDrive, Plus, SquareDashedMousePointer } from "lucide-react";
import { useCallback, useState } from "react";
import { initializeAssetStorage } from "service/assetStorage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { AssetLibraryDialog } from "../Canvas/components/AssetLibraryDialog";

export default function AssetsPage() {
  const assetStoragePath = useChatSettingsStore(
    (state) => state.assetStoragePath,
  );
  const setAssetStoragePath = useChatSettingsStore(
    (state) => state.setAssetStoragePath,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [choosingPath, setChoosingPath] = useState(false);

  const handleSelectPath = useCallback(async () => {
    if (!window.storage || choosingPath) return;

    setChoosingPath(true);
    try {
      const selectedPath = await window.storage.selectDirectory();
      if (!selectedPath) return;

      setAssetStoragePath(selectedPath);
      await initializeAssetStorage(selectedPath);
      setRefreshKey((current) => current + 1);
      toast.success("资产存储路径已设置");
    } catch (error) {
      console.error("[AssetsPage] select asset path failed", error);
      toast.error("设置资产存储路径失败");
    } finally {
      setChoosingPath(false);
    }
  }, [choosingPath, setAssetStoragePath]);

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-[#09090b] text-white">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/5 px-6">
        <div className="flex items-center">
          <SquareDashedMousePointer className="w-5 h-5 mr-3 text-[#B43FEB]" />
          <h1 className="text-lg font-medium">资源管理</h1>
        </div>
      </header>

      {assetStoragePath ? (
        <main className="min-h-0 flex-1 px-8 py-6">
          <div className="h-full overflow-hidden rounded-xl border border-white/10 bg-[#111113]">
            <AssetLibraryDialog
              open
              variant="page"
              basePath={assetStoragePath}
              projectId={null}
              nodes={[]}
              refreshKey={refreshKey}
              onClose={() => undefined}
            />
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 items-center justify-center px-8 py-6">
          <div className="flex w-[min(520px,100%)] flex-col items-center rounded-xl border border-white/10 bg-[#111113] px-8 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
              <Plus size={22} />
            </div>
            <h2 className="mt-5 text-lg font-medium">选择资产存储路径</h2>
            <p className="mt-3 text-sm leading-6 text-white/48">
              资产库会在该目录下保存导入的资产文件夹和索引文件。设置后可按角色、场景、道具、音效分类管理、插入、删除和下载资产。
            </p>
            <Button
              className="mt-6"
              size="sm"
              variant="blue"
              onClick={handleSelectPath}
              disabled={choosingPath}
            >
              <HardDrive size={14} />
              {choosingPath ? "选择中" : "选择存储路径"}
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
