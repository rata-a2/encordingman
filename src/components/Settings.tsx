import { useEffect, useState } from "react";
import type { AppConfig } from "../lib/tauri-commands";
import { getConfig, updateConfig } from "../lib/tauri-commands";
import { open } from "@tauri-apps/plugin-dialog";

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateConfig(config);
      setMessage("設定を保存しました");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage(`エラー: ${e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectApp() {
    try {
      const selected = await open({
        filters: [
          { name: "Executable", extensions: ["exe"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (selected && config) {
        setConfig({ ...config, default_app: selected as string });
      }
    } catch {
      // User cancelled
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white transition-colors"
        >
          &larr; 戻る
        </button>
        <h1 className="text-lg font-bold text-sky-400">設定</h1>
      </div>

      {/* Settings Form */}
      <div className="flex-1 flex flex-col gap-5 overflow-auto">
        {/* Default App */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            デフォルト起動アプリ
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config.default_app}
              onChange={(e) =>
                setConfig({ ...config, default_app: e.target.value })
              }
              placeholder="system_default"
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-sky-400"
            />
            <button
              onClick={handleSelectApp}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              参照...
            </button>
          </div>
          <span className="text-xs text-slate-500">
            system_default でOSの既定アプリを使用
          </span>
        </div>

        {/* Target Encoding */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            変換先エンコード
          </label>
          <select
            value={config.target_encoding}
            onChange={(e) =>
              setConfig({ ...config, target_encoding: e.target.value })
            }
            className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-sky-400"
          >
            <option value="utf-8-bom">UTF-8 BOM付き (推奨)</option>
            <option value="utf-8">UTF-8 (BOM無し)</option>
            <option value="shift_jis">Shift-JIS</option>
          </select>
        </div>

        {/* Confidence Threshold */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            信頼度スコア閾値:{" "}
            <span className="text-sky-400">
              {Math.round(config.confidence_threshold * 100)}%
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            value={config.confidence_threshold}
            onChange={(e) =>
              setConfig({
                ...config,
                confidence_threshold: parseFloat(e.target.value),
              })
            }
            className="w-full accent-sky-400"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
          <span className="text-xs text-slate-500">
            この値より低い場合、確認ダイアログを表示します
          </span>
        </div>

        {/* Preview Lines */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            プレビュー行数
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={config.preview_lines}
            onChange={(e) =>
              setConfig({
                ...config,
                preview_lines: parseInt(e.target.value) || 10,
              })
            }
            className="w-24 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-sky-400"
          />
        </div>

        {/* Keep Temp File */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="keepTemp"
            checked={config.keep_temp_file}
            onChange={(e) =>
              setConfig({ ...config, keep_temp_file: e.target.checked })
            }
            className="w-4 h-4 accent-sky-400"
          />
          <label htmlFor="keepTemp" className="text-sm text-slate-300">
            一時ファイルをアプリ終了後も保持する
          </label>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`rounded p-2 text-sm ${
            message.startsWith("エラー")
              ? "bg-red-900/50 border border-red-700 text-red-300"
              : "bg-green-900/50 border border-green-700 text-green-300"
          }`}
        >
          {message}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}
