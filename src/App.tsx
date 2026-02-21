import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import ConvertView from "./components/ConvertView";
import Settings from "./components/Settings";
import BatchView from "./components/BatchView";
import type { ConvertResult } from "./lib/tauri-commands";
import { detectAndConvert, scanFolder } from "./lib/tauri-commands";

type View = "loading" | "convert" | "settings" | "done" | "idle" | "batch";

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [batchPaths, setBatchPaths] = useState<string[]>([]);

  useEffect(() => {
    async function init() {
      try {
        // Ensure window is visible (setup hook may have already shown it)
        await getCurrentWindow().show();

        const urlParams = new URLSearchParams(window.location.search);
        const fileArg = urlParams.get("file");

        if (fileArg) {
          setFilePath(fileArg);
          await processFile(fileArg);
        } else {
          setView("idle");
        }
      } catch (e) {
        setError(String(e));
        setView("idle");
      }
    }

    init();
  }, []);

  async function processFile(path: string) {
    setView("loading");
    setError(null);
    try {
      const convertResult = await detectAndConvert(path);
      setResult(convertResult);

      if (convertResult.auto_converted) {
        setView("done");
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Manual mode fallback (should not happen in v1.3.0 smart mode)
        setView("convert");
      }
    } catch (e) {
      setError(String(e));
      setView("idle");
    }
  }

  async function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      // Multiple files → batch mode
      const paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const path = (files[i] as File & { path?: string }).path;
        if (path) paths.push(path);
      }
      if (paths.length > 0) {
        setBatchPaths(paths);
        setView("batch");
      }
    } else {
      // Single file
      const path = (files[0] as File & { path?: string }).path;
      if (path) {
        setFilePath(path);
        await processFile(path);
      }
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

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
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
        onClose={() => window.close()}
      />
    );
  }

  // Idle / Drop zone view
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-4 p-6"
      onDrop={handleFileDrop}
      onDragOver={handleDragOver}
    >
      <div className="text-2xl font-bold text-sky-400 mb-2">
        EncodingMan
      </div>
      <div className="text-sm text-slate-400 text-center">
        文字化け自動修正 &amp; ファイルオープナー
      </div>

      {/* Drop Zone */}
      <div className="w-full max-w-sm border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-sky-400 transition-colors cursor-pointer">
        <div className="text-3xl mb-3 text-slate-500">&#128196;</div>
        <div className="text-sm text-slate-400">
          ファイルをここにドロップ（複数可）
        </div>
        <div className="text-xs text-slate-500 mt-1">
          CSV / TSV / TXT / XLS / XLSX / DOCX など対応
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
