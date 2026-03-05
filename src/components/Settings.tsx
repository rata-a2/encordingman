import { useEffect, useState } from "react";
import type { AppConfig } from "../lib/tauri-commands";
import { getConfig, updateConfig } from "../lib/tauri-commands";
import { open } from "@tauri-apps/plugin-dialog";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

interface SettingsProps {
  onBack: () => void;
}

type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; body: string }
  | { state: "downloading"; percent: number }
  | { state: "ready" }
  | { state: "latest" }
  | { state: "error"; message: string };

export default function Settings({ onBack }: SettingsProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getConfig().then(setConfig);
    getVersion().then(setAppVersion);
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

  async function handleCheckUpdate() {
    setUpdateStatus({ state: "checking" });
    try {
      const update = await check();
      if (update) {
        setUpdateStatus({
          state: "available",
          version: update.version,
          body: update.body ?? "",
        });
      } else {
        setUpdateStatus({ state: "latest" });
        setTimeout(() => setUpdateStatus({ state: "idle" }), 3000);
      }
    } catch (e) {
      setUpdateStatus({ state: "error", message: String(e) });
    }
  }

  async function handleInstallUpdate() {
    setUpdateStatus({ state: "downloading", percent: 0 });
    try {
      const update = await check();
      if (!update) return;

      let totalBytes = 0;
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          const percent = totalBytes > 0
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : 0;
          setUpdateStatus({ state: "downloading", percent });
        }
      });
      setUpdateStatus({ state: "ready" });
    } catch (e) {
      setUpdateStatus({ state: "error", message: String(e) });
    }
  }

  async function handleRelaunch() {
    await relaunch();
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

        {/* Smart Auto-Fix Info */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            エンコーディング判定
          </label>
          <span className="text-xs text-slate-500">
            スマート自動判定: 全候補エンコーディングを試行し、最適なものを自動選択します
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

        {/* Update Section */}
        <div className="flex flex-col gap-2 border-t border-slate-700 pt-4">
          <label className="text-sm font-medium text-slate-300">
            アップデート
          </label>

          {updateStatus.state === "idle" && (
            <button
              onClick={handleCheckUpdate}
              className="self-start px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              アップデートを確認
            </button>
          )}

          {updateStatus.state === "checking" && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              確認中...
            </div>
          )}

          {updateStatus.state === "latest" && (
            <div className="text-sm text-green-400">
              &#10003; 最新バージョンです (v{appVersion})
            </div>
          )}

          {updateStatus.state === "available" && (
            <div className="flex flex-col gap-2">
              <div className="bg-sky-900/30 border border-sky-700 rounded p-3">
                <div className="text-sm font-medium text-sky-300">
                  v{updateStatus.version} が利用可能です
                </div>
                {updateStatus.body && (
                  <div className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">
                    {updateStatus.body}
                  </div>
                )}
              </div>
              <button
                onClick={handleInstallUpdate}
                className="self-start px-4 py-1.5 bg-sky-600 hover:bg-sky-500 rounded text-sm font-medium transition-colors"
              >
                ダウンロードしてインストール
              </button>
            </div>
          )}

          {updateStatus.state === "downloading" && (
            <div className="flex flex-col gap-1">
              <div className="text-sm text-slate-400">ダウンロード中...</div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-sky-400 h-2 rounded-full transition-all"
                  style={{ width: `${updateStatus.percent}%` }}
                />
              </div>
            </div>
          )}

          {updateStatus.state === "ready" && (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-green-400">
                &#10003; インストール完了
              </div>
              <button
                onClick={handleRelaunch}
                className="self-start px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
              >
                再起動して適用
              </button>
            </div>
          )}

          {updateStatus.state === "error" && (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-red-400">
                {updateStatus.message}
              </div>
              <button
                onClick={() => setUpdateStatus({ state: "idle" })}
                className="self-start px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs transition-colors"
              >
                再試行
              </button>
            </div>
          )}
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
