import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import ConvertView from "./components/ConvertView";
import Settings from "./components/Settings";
import BatchView from "./components/BatchView";
import type { ConvertResult } from "./lib/tauri-commands";
import { detectAndConvert, scanFolder } from "./lib/tauri-commands";

type View = "loading" | "convert" | "settings" | "done" | "idle" | "batch";
type UpdateBanner =
  | null
  | { state: "available"; version: string; update: Update }
  | { state: "downloading"; percent: number; update: Update }
  | { state: "ready" };

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [batchPaths, setBatchPaths] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<UpdateBanner>(null);

  const processFile = useCallback(async (path: string) => {
    setView("loading");
    setError(null);
    try {
      const convertResult = await detectAndConvert(path);
      setResult(convertResult);

      if (convertResult.auto_converted) {
        setView("done");
        setTimeout(async () => {
          await getCurrentWindow().close();
        }, 1500);
      } else {
        setView("convert");
      }
    } catch (e) {
      setError(String(e));
      setView("idle");
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileArg = urlParams.get("file");

    if (fileArg) {
      setFilePath(fileArg);
      processFile(fileArg);
    } else {
      setView("idle");
    }

    // Background auto-update check (silent, no error shown)
    check().then((update) => {
      if (update) {
        setUpdateBanner({ state: "available", version: update.version, update });
      }
    }).catch(() => { /* ignore - offline or no release yet */ });
  }, [processFile]);

  async function handleBannerUpdate() {
    if (!updateBanner || updateBanner.state !== "available") return;
    const update = updateBanner.update;
    setUpdateBanner({ state: "downloading", percent: 0, update });
    try {
      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          setUpdateBanner({ state: "downloading", percent, update });
        }
      });
      setUpdateBanner({ state: "ready" });
    } catch {
      setUpdateBanner(null);
    }
  }

  // Tauri v2 drag-and-drop event listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function setupDragDrop() {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;

          if (paths.length > 1) {
            setBatchPaths(paths);
            setView("batch");
          } else {
            setFilePath(paths[0]);
            processFile(paths[0]);
          }
        }
      });
    }

    setupDragDrop();

    return () => {
      unlisten?.();
    };
  }, [processFile]);

  async function handleSelectFile() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "対応ファイル",
            extensions: ["csv", "tsv", "txt", "dat", "log", "xml", "xsl", "xslt", "json", "htm", "html", "xls", "xlsx", "xlsm", "xlsb", "doc", "docx", "docm", "ppt", "pptx", "pptm", "pdf"],
          },
          { name: "すべてのファイル", extensions: ["*"] },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length > 1) {
        setBatchPaths(paths);
        setView("batch");
      } else {
        setFilePath(paths[0]);
        processFile(paths[0]);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSelectFolder() {
    try {
      const selected = await open({ directory: true });
      if (selected) {
        const paths = await scanFolder(selected as string);
        if (paths.length > 0) {
          setBatchPaths(paths);
          setView("batch");
        } else {
          setError("テキストファイルが見つかりませんでした");
        }
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function closeWindow() {
    await getCurrentWindow().close();
  }

  // Loading view
  if (view === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="w-10 h-10 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 text-sm">エンコード判定中...</div>
      </div>
    );
  }

  // Auto-converted success
  if (view === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="text-4xl text-green-400">&#10003;</div>
        <div className="text-base font-medium">
          {result?.is_binary ? "ファイルを開きました" : "変換完了"}
        </div>
        <div className="text-sm text-slate-400">
          {result?.is_binary ? (
            <>{result.file_name}</>
          ) : (
            <>
              {result?.detected_encoding} &rarr; UTF-8 BOM (信頼度:{" "}
              {result ? Math.round(result.confidence * 100) : 0}%)
            </>
          )}
        </div>
        <div className="text-xs text-slate-500">
          アプリケーションで開きました
        </div>
        {/* Manual override button */}
        {result && !result.is_binary && result.original_path && (
          <button
            onClick={() => setView("convert")}
            className="mt-2 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-400 transition-colors"
          >
            手動で変更
          </button>
        )}
      </div>
    );
  }

  // Batch processing view
  if (view === "batch") {
    return (
      <BatchView
        filePaths={batchPaths}
        onClose={() => {
          setBatchPaths([]);
          setView("idle");
        }}
      />
    );
  }

  // Settings view
  if (view === "settings") {
    return <Settings onBack={() => setView(filePath ? "convert" : "idle")} />;
  }

  // Convert confirmation view (manual override)
  if (view === "convert" && result) {
    return (
      <ConvertView
        result={result}
        onClose={closeWindow}
      />
    );
  }

  // Idle / Drop zone view
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
      {/* Auto-update banner */}
      {updateBanner?.state === "available" && (
        <div className="w-full max-w-sm bg-sky-900/40 border border-sky-700 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-sky-300">v{updateBanner.version} が利用可能</span>
          <button onClick={handleBannerUpdate} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 rounded text-xs font-medium transition-colors">
            更新する
          </button>
        </div>
      )}
      {updateBanner?.state === "downloading" && (
        <div className="w-full max-w-sm bg-sky-900/40 border border-sky-700 rounded-lg px-4 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-sky-300">ダウンロード中...</span>
            <span className="text-xs text-sky-400">{updateBanner.percent}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div className="bg-sky-400 h-1.5 rounded-full transition-all" style={{ width: `${updateBanner.percent}%` }} />
          </div>
        </div>
      )}
      {updateBanner?.state === "ready" && (
        <div className="w-full max-w-sm bg-green-900/40 border border-green-700 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-green-300">更新完了！</span>
          <button onClick={() => relaunch()} className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-medium transition-colors">
            再起動
          </button>
        </div>
      )}

      <div className="text-2xl font-bold text-sky-400 mb-2">
        EncodingMan
      </div>
      <div className="text-sm text-slate-400 text-center">
        文字化け自動修正 &amp; ファイルオープナー
      </div>

      {/* Drop Zone (clickable to open file dialog) */}
      <div
        onClick={handleSelectFile}
        className={`w-full max-w-sm border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragOver
            ? "border-sky-400 bg-sky-400/10"
            : "border-slate-600 hover:border-sky-400 hover:bg-sky-400/5"
        }`}
      >
        <div className="text-3xl mb-3 text-slate-500">&#128196;</div>
        <div className="text-sm text-slate-400">
          ファイルをドロップ or クリックして選択
        </div>
        <div className="text-xs text-slate-500 mt-1">
          CSV / TSV / TXT / XLS / XLSX / DOCX など対応（複数可）
        </div>
      </div>

      {error && (
        <div className="w-full max-w-sm bg-red-900/50 border border-red-700 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={handleSelectFolder}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          &#128193; フォルダ一括変換
        </button>
        <button
          onClick={() => setView("settings")}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          &#9881; 設定
        </button>
      </div>
    </div>
  );
}
