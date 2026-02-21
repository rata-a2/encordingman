<p align="center">
  <img src="public/icon.png" alt="EncodingMan" width="128" height="128">
</p>

<h1 align="center">EncodingMan</h1>

<p align="center">
  <strong>テキストファイルの文字化けをゼロタッチで解消するデスクトップツール</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.3.0-blue" alt="version">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?logo=windows" alt="platform">
  <img src="https://img.shields.io/badge/Rust-000000?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/Tauri_2-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React">
</p>

---

## Overview

ExcelでCSVを開いたら文字化け...そんな経験はありませんか？

**EncodingMan** は、テキストファイルの文字コードを自動判定し、UTF-8 BOM付きに変換してから指定アプリで開くツールです。ファイルをダブルクリックするだけで、文字化けのない状態でExcelやエディタが起動します。

## Features

- **スマート自動判定** - 全候補エンコーディングを試行し、最適なものを自動選択
- **サイレント処理** - ウィンドウを表示せずに瞬時に変換・起動（v1.3.0新機能）
- **バッチ処理** - 複数ファイルやフォルダを一括変換（v1.3.0新機能）
- **元ファイル保護** - 元のファイルは一切変更しない非破壊処理
- **多形式対応** - テキスト系はエンコード変換、Office系はパススルーで開く
- **軽量・高速** - Tauri製でインストーラーわずか3MB、起動500ms以内

## How It Works

```
ファイルをダブルクリック
  → EncodingMan がバックグラウンドで起動
  → 既にUTF-8？ → そのままアプリで開く（ウィンドウ表示なし）
  → 文字化けあり？ → スマート自動変換 → アプリで開く（ウィンドウ表示なし）
  → バイナリ？ → そのまま関連アプリで開く（ウィンドウ表示なし）
```

**ポイント**: ファイル引数付きで起動した場合、全てのケースでウィンドウは表示されません。完全にバックグラウンドで処理が完了します。

## Supported File Types

### テキスト系（エンコード自動変換対象）

| 拡張子 | 説明 |
|--------|------|
| `.csv` | カンマ区切りファイル |
| `.tsv` | タブ区切りファイル |
| `.txt` | テキストファイル |
| `.xml` | XMLファイル |
| `.xsl` / `.xslt` | XSLスタイルシート |
| `.json` | JSONファイル |
| `.html` / `.htm` | HTMLファイル |
| `.dat` | データファイル |
| `.log` | ログファイル |

### バイナリ系（パススルー：そのまま指定アプリで開く）

| 拡張子 | 説明 |
|--------|------|
| `.xls` | Excel (旧形式) |
| `.xlsx` / `.xlsm` / `.xlsb` | Excel (Open XML) |
| `.doc` | Word (旧形式) |
| `.docx` / `.docm` | Word (Open XML) |
| `.ppt` | PowerPoint (旧形式) |
| `.pptx` / `.pptm` | PowerPoint (Open XML) |
| `.pdf` | PDF |

## Supported Encodings

| エンコード | 説明 |
|-----------|------|
| Shift-JIS / CP932 | 日本語Windows標準 |
| UTF-8 (BOM無し) | Linux・Webサービス標準 |
| UTF-8 (BOM付き) | Excel互換UTF-8 |
| EUC-JP | 古い日本語システム |
| ISO-2022-JP | メール等の旧日本語規格 |
| UTF-16 LE/BE | Windowsの一部アプリ |
| windows-1252 | 西ヨーロッパ言語 |

## Download

> **[Releases ページからダウンロード](https://github.com/rata-a2/encordingman/releases)**

- `EncodingMan_x.x.x_x64-setup.exe` - NSISインストーラー（推奨）
- `EncodingMan_x.x.x_x64_en-US.msi` - MSIインストーラー

## How to Use

### 基本的な使い方

1. インストーラーを実行してインストール
2. CSVファイルを右クリック →「プログラムから開く」→ EncodingManを選択
3. 以降、ファイルをダブルクリックするだけで自動変換 → Excelなどで表示

### バッチ処理

1. EncodingManを直接起動
2. 複数ファイルをドラッグ&ドロップ、または「フォルダ一括変換」ボタンからフォルダを選択
3. 全ファイルが自動で変換され、結果サマリーが表示されます

### 設定

アプリを起動して「設定」ボタンから以下を変更できます：

| 設定項目 | 説明 | デフォルト |
|---------|------|----------|
| デフォルト起動アプリ | 変換後に開くアプリのパス | システムデフォルト |
| 変換先エンコード | 変換後の文字コード | UTF-8 BOM付き |
| プレビュー行数 | 確認画面で表示する行数 | 10行 |

## Architecture

```
EncodingMan
├── src-tauri/           # Rust バックエンド
│   ├── src/
│   │   ├── main.rs      # エントリポイント
│   │   ├── lib.rs       # Tauri コマンド定義 + setup フック
│   │   ├── encoder.rs   # chardetng + encoding_rs による判定・変換
│   │   ├── scorer.rs    # マルチエンコーディング スコアリングエンジン
│   │   ├── config.rs    # 設定ファイル管理 (%APPDATA%)
│   │   └── launcher.rs  # 外部アプリ起動・一時ファイル管理
│   └── Cargo.toml
├── src/                 # React フロントエンド
│   ├── App.tsx          # メインUI
│   ├── components/
│   │   ├── BatchView.tsx    # バッチ処理結果画面
│   │   ├── ConvertView.tsx  # 手動変換確認画面
│   │   └── Settings.tsx     # 設定画面
│   └── lib/
│       └── tauri-commands.ts  # Rust↔React ブリッジ
└── package.json
```

## Tech Stack

| 技術 | 用途 |
|------|------|
| **Rust** | バックエンド処理 |
| **chardetng** | 文字コード自動判定 (Firefoxと同エンジン) |
| **encoding_rs** | エンコーディング変換 |
| **Tauri 2** | デスクトップアプリフレームワーク |
| **React + TypeScript** | フロントエンドUI |
| **Tailwind CSS** | スタイリング |
| **Vite** | フロントエンドビルド |

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v18+)
- [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/downloads/)

### Build

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run tauri dev

# プロダクションビルド (.exe 生成)
npm run tauri build
```

ビルド成果物は `src-tauri/target/release/bundle/` に出力されます。

## License

MIT
