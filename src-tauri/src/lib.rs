mod config;
mod encoder;
mod launcher;

use config::AppConfig;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct ConvertResult {
    /// Whether the conversion was performed automatically (high confidence).
    pub auto_converted: bool,
    /// Detected encoding name.
    pub detected_encoding: String,
    /// Confidence score (0.0 - 1.0).
    pub confidence: f32,
    /// Path to the temporary converted file (if auto-converted).
    pub temp_file_path: Option<String>,
    /// Preview lines of the original (possibly garbled) text.
    pub original_preview: Vec<String>,
    /// Preview lines of the converted text.
    pub converted_preview: Vec<String>,
    /// Original file path.
    pub original_path: String,
    /// Original file name.
    pub file_name: String,
}

#[tauri::command]
fn detect_and_convert(file_path: String) -> Result<ConvertResult, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.csv")
        .to_string();

    // Read file as raw bytes (F-07: read-only, never modify original)
    let data = encoder::read_file_bytes(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect encoding
    let detection = encoder::detect_encoding(&data);
    let cfg = config::load_config();

    // Generate preview of original (decoded with detected encoding)
    let original_preview = generate_preview(&data, &detection.encoding_name, cfg.preview_lines);

    // Convert to UTF-8 BOM
    let converted_data = encoder::convert_to_utf8_bom(&data, &detection.encoding_name)?;
    let converted_preview = generate_preview(&converted_data, "UTF-8", cfg.preview_lines);

    if detection.confidence >= cfg.confidence_threshold {
        // High confidence: auto-convert and launch
        let temp_path = launcher::create_temp_file(&file_name, &converted_data)?;
        launcher::launch_app(&cfg.default_app, &temp_path)?;

        Ok(ConvertResult {
            auto_converted: true,
            detected_encoding: detection.encoding_name,
            confidence: detection.confidence,
            temp_file_path: Some(temp_path),
            original_preview,
            converted_preview,
            original_path: file_path,
            file_name,
        })
    } else {
        // Low confidence: return result for UI to display
        Ok(ConvertResult {
            auto_converted: false,
            detected_encoding: detection.encoding_name,
            confidence: detection.confidence,
            temp_file_path: None,
            original_preview,
            converted_preview,
            original_path: file_path,
            file_name,
        })
    }
}

#[tauri::command]
fn convert_with_encoding(file_path: String, encoding: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.csv");

    let data = encoder::read_file_bytes(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let converted_data = encoder::convert_to_utf8_bom(&data, &encoding)?;
    let temp_path = launcher::create_temp_file(file_name, &converted_data)?;

    let cfg = config::load_config();
    launcher::launch_app(&cfg.default_app, &temp_path)?;

    Ok(temp_path)
}

#[tauri::command]
fn get_config() -> Result<AppConfig, String> {
    Ok(config::load_config())
}

#[tauri::command]
fn update_config(new_config: AppConfig) -> Result<(), String> {
    config::save_config(&new_config)
}

#[tauri::command]
fn get_supported_encodings() -> Vec<&'static str> {
    encoder::supported_encodings()
}

#[tauri::command]
fn open_converted_file(temp_path: String) -> Result<(), String> {
    let cfg = config::load_config();
    launcher::launch_app(&cfg.default_app, &temp_path)
}

#[tauri::command]
fn cleanup_temp(temp_path: String) -> Result<(), String> {
    launcher::cleanup_temp_file(&temp_path)
}

fn generate_preview(data: &[u8], encoding_name: &str, max_lines: usize) -> Vec<String> {
    let encoding = encoding_rs::Encoding::for_label(encoding_name.as_bytes())
        .unwrap_or(encoding_rs::UTF_8);
    let (decoded, _, _) = encoding.decode(data);
    encoder::get_preview_lines(&decoded, max_lines)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_and_convert,
            convert_with_encoding,
            get_config,
            update_config,
            get_supported_encodings,
            open_converted_file,
            cleanup_temp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
