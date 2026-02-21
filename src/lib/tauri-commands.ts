import { invoke } from "@tauri-apps/api/core";

export interface ConvertResult {
  auto_converted: boolean;
  is_binary: boolean;
  detected_encoding: string;
  confidence: number;
  temp_file_path: string | null;
  original_preview: string[];
  converted_preview: string[];
  original_path: string;
  file_name: string;
}

export interface AppConfig {
  default_app: string;
  target_encoding: string;
  confidence_threshold: number;
  preview_lines: number;
  keep_temp_file: boolean;
}

export interface BatchFileResult {
  file_path: string;
  file_name: string;
  status: "converted" | "already_utf8" | "binary" | "error";
  detected_encoding: string | null;
  error_message: string | null;
}

export interface BatchResult {
  results: BatchFileResult[];
  total: number;
  converted: number;
  already_utf8: number;
  binary: number;
  errors: number;
}

export async function detectAndConvert(
  filePath: string
): Promise<ConvertResult> {
  return invoke("detect_and_convert", { filePath });
}

export async function convertWithEncoding(
  filePath: string,
  encoding: string
): Promise<string> {
  return invoke("convert_with_encoding", { filePath, encoding });
}

export async function batchConvert(
  filePaths: string[]
): Promise<BatchResult> {
  return invoke("batch_convert", { filePaths });
}

export async function scanFolder(
  folderPath: string
): Promise<string[]> {
  return invoke("scan_folder", { folderPath });
}

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function updateConfig(newConfig: AppConfig): Promise<void> {
  return invoke("update_config", { newConfig });
}

export async function getSupportedEncodings(): Promise<string[]> {
  return invoke("get_supported_encodings");
}

export async function openConvertedFile(tempPath: string): Promise<void> {
  return invoke("open_converted_file", { tempPath });
}

export async function cleanupTemp(tempPath: string): Promise<void> {
  return invoke("cleanup_temp", { tempPath });
}
