import { useState } from "react";
import type { ConvertResult } from "../lib/tauri-commands";
import {
  convertWithEncoding,
  getSupportedEncodings,
  openConvertedFile,
} from "../lib/tauri-commands";

interface ConvertViewProps {
  result: ConvertResult;
  onClose: () => void;
}

export default function ConvertView({ result, onClose }: ConvertViewProps) {
  const [selectedEncoding, setSelectedEncoding] = useState(
    result.detected_encoding
  );
  const [encodings, setEncodings] = useState<string[]>([]);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    getSupportedEncodings().then(setEncodings);
  });

  const confidencePercent = Math.round(result.confidence * 100);
  const confidenceColor =
    confidencePercent >= 75
      ? "text-green-400"
      : confidencePercent >= 50
        ? "text-yellow-400"
        : "text-red-400";

  async function handleConvert() {
    setConverting(true);
    setError(null);
    try {
      const tempPath = await convertWithEncoding(
        result.original_path,
        selectedEncoding
      );
      await openConvertedFile(tempPath);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-sky-400">
          EncodingMan
        </h1>
        <span className="text-sm text-slate-400 truncate max-w-[300px]">
          {result.file_name}
        </span>
      </div>

      {/* Detection Info */}
      <div className="bg-slate-800 rounded-lg p-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm text-slate-400">検出エンコーディング</div>
          <div className="text-base font-semibold">
            {result.detected_encoding}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">信頼度</div>
          <div className={`text-xl font-bold ${confidenceColor}`}>
            {confidencePercent}%
          </div>
        </div>
      </div>

      {/* Encoding Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400 whitespace-nowrap">
          変換元エンコード:
        </label>
        <select
          className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-sky-400"
          value={selectedEncoding}
          onChange={(e) => setSelectedEncoding(e.target.value)}
        >
          {encodings.map((enc) => (
            <option key={enc} value={enc}>
              {enc}
              {enc === result.detected_encoding ? " (検出)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <div className="flex-1 grid grid-cols-2 gap-2 min-h-0">
        <div className="flex flex-col min-h-0">
          <div className="text-xs text-slate-400 mb-1 font-medium">
            変換前
          </div>
          <div className="flex-1 bg-slate-900 rounded p-2 overflow-auto text-xs font-mono leading-relaxed border border-slate-700">
            {result.original_preview.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <div className="text-xs text-slate-400 mb-1 font-medium">
            変換後 (UTF-8 BOM)
          </div>
          <div className="flex-1 bg-slate-900 rounded p-2 overflow-auto text-xs font-mono leading-relaxed border border-sky-900">
            {result.converted_preview.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded p-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleConvert}
          disabled={converting}
          className="px-6 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {converting ? "変換中..." : "このエンコードで開く"}
        </button>
      </div>
    </div>
  );
}
