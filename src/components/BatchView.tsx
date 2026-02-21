import { useEffect, useState } from "react";
import type { BatchResult } from "../lib/tauri-commands";
import { batchConvert } from "../lib/tauri-commands";

interface BatchViewProps {
  filePaths: string[];
  onClose: () => void;
}

export default function BatchView({ filePaths, onClose }: BatchViewProps) {
  const [result, setResult] = useState<BatchResult | null>(null);
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        const res = await batchConvert(filePaths);
        setResult(res);
      } catch (e) {
        setError(String(e));
      } finally {
        setProcessing(false);
      }
    }
    run();
  }, [filePaths]);

  if (processing) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <div className="w-10 h-10 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-400 text-sm">
          {filePaths.length} 件のファイルを処理中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-6">
        <div className="text-4xl text-red-400">!</div>
        <div className="text-sm text-red-300">{error}</div>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (!result) return null;

  const statusIcon = (status: string) => {
    switch (status) {
      case "converted":
        return <span className="text-green-400">&#10003;</span>;
      case "already_utf8":
        return <span className="text-blue-400">&#10003;</span>;
      case "binary":
        return <span className="text-slate-400">&#9654;</span>;
      case "error":
        return <span className="text-red-400">&#10007;</span>;
      default:
        return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "converted":
        return "変換済";
      case "already_utf8":
        return "UTF-8";
      case "binary":
        return "バイナリ";
      case "error":
        return "エラー";
      default:
        return status;
    }
  };

  return (
    <div className="flex flex-col h-screen p-4 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-sky-400">
          バッチ処理結果
        </h1>
        <span className="text-sm text-slate-400">
          {result.total} 件
        </span>
      </div>

      {/* Summary */}
      <div className="flex gap-3 text-xs">
        {result.converted > 0 && (
          <span className="px-2 py-1 rounded bg-green-900/50 text-green-300">
            変換: {result.converted}
          </span>
        )}
        {result.already_utf8 > 0 && (
          <span className="px-2 py-1 rounded bg-blue-900/50 text-blue-300">
            UTF-8: {result.already_utf8}
          </span>
        )}
        {result.binary > 0 && (
          <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
            バイナリ: {result.binary}
          </span>
        )}
        {result.errors > 0 && (
          <span className="px-2 py-1 rounded bg-red-900/50 text-red-300">
            エラー: {result.errors}
          </span>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto border border-slate-700 rounded">
        {result.results.map((file, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 text-sm ${
              i > 0 ? "border-t border-slate-700/50" : ""
            }`}
          >
            <span className="text-lg">{statusIcon(file.status)}</span>
            <div className="flex-1 min-w-0">
              <div className="truncate">{file.file_name}</div>
              {file.detected_encoding && file.status === "converted" && (
                <div className="text-xs text-slate-500">
                  {file.detected_encoding} &rarr; UTF-8 BOM
                </div>
              )}
              {file.error_message && (
                <div className="text-xs text-red-400">{file.error_message}</div>
              )}
            </div>
            <span className="text-xs text-slate-500 shrink-0">
              {statusLabel(file.status)}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={onClose}
        className="self-center px-6 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium transition-colors"
      >
        閉じる
      </button>
    </div>
  );
}
