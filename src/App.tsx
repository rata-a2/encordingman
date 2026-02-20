import { useEffect, useState } from "react";
import ConvertView from "./components/ConvertView";
import Settings from "./components/Settings";
import type { ConvertResult } from "./lib/tauri-commands";
import { detectAndConvert } from "./lib/tauri-commands";

type View = "loading" | "convert" | "settings" | "done" | "idle";

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);

  useEffect(() => {
    // Get file path from command line arguments via Tauri
    async function init() {
      try {
        // Try to get the file path from URL search params (passed by Tauri)
        const urlParams = new URLSearchParams(window.location.search);
        const fileArg = urlParams.get("file");

        if (fileArg) {
          setFilePath(fileArg);
          await processFile(fileArg);
        } else {
          // No file argument - show idle/drop zone
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
        // High confidence: file was auto-converted and opened
        setView("done");
        // Auto-close window after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Low confidence: show confirmation UI
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
    if (files && files.length > 0) {
      const path = (files[0] as File & { path?: string }).path;
      if (path) {
        setFilePath(path);
        await processFile(path);
      }
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
        <div className="text-base font-medium">変換完了</div>
        <div className="text-sm text-slate-400">
          {result?.detected_encoding} &rarr; UTF-8 BOM (信頼度:{" "}
          {result ? Math.round(result.confidence * 100) : 0}%)
        </div>
        <div className="text-xs text-slate-500">
          アプリケーションで開きました
        </div>
      </div>
    );
  }

  // Settings view
  if (view === "settings") {
    return <Settings onBack={() => setView(filePath ? "convert" : "idle")} />;
  }

  // Convert confirmation view
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
        テキストファイル文字化け自動修正ツール
      </div>

      {/* Drop Zone */}
      <div className="w-full max-w-sm border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-sky-400 transition-colors cursor-pointer">
        <div className="text-3xl mb-3 text-slate-500">&#128196;</div>
        <div className="text-sm text-slate-400">
          ファイルをここにドロップ
        </div>
        <div className="text-xs text-slate-500 mt-1">
          CSV / TSV / TXT / XML / JSON / HTML など対応
        </div>
      </div>

      {error && (
        <div className="w-full max-w-sm bg-red-900/50 border border-red-700 rounded p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Settings Button */}
      <button
        onClick={() => setView("settings")}
        className="mt-2 px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
      >
        &#9881; 設定
      </button>
    </div>
  );
}
