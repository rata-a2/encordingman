mod config;
mod encoder;
mod launcher;
mod scorer;

use config::AppConfig;
use serde::Serialize;
use std::path::Path;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
pub struct ConvertResult {
    pub auto_converted: bool,
    pub is_binary: bool,
    pub detected_encoding: String,
    pub confidence: f32,
    pub temp_file_path: Option<String>,
    pub original_preview: Vec<String>,
    pub converted_preview: Vec<String>,
    pub original_path: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchFileResult {
    pub file_path: String,
    pub file_name: String,
    pub status: String, // "converted", "already_utf8", "binary", "error"
    pub detected_encoding: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchResult {
    pub results: Vec<BatchFileResult>,
    pub total: usize,
    pub converted: usize,
    pub already_utf8: usize,
    pub binary: usize,
    pub errors: usize,
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
        .unwrap_or("unknown")
        .to_string();

    let cfg = config::load_config();

    // Binary files → open directly without conversion
    if encoder::is_binary_file(path) {
        launcher::launch_app(&cfg.default_app, &file_path)?;

        return Ok(ConvertResult {
            auto_converted: true,
            is_binary: true,
            detected_encoding: "binary".to_string(),
            confidence: 1.0,
            temp_file_path: None,
            original_preview: vec![format!("[バイナリファイル: {}]", file_name)],
            converted_preview: vec![],
            original_path: file_path,
            file_name,
        });
    }

    // Text files → read, smart detect encoding, always auto-convert
    let data = encoder::read_file_bytes(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Already UTF-8 → open directly without conversion
    if encoder::is_already_utf8(&data) {
        launcher::launch_app(&cfg.default_app, &file_path)?;

        return Ok(ConvertResult {
            auto_converted: true,
            is_binary: false,
            detected_encoding: "UTF-8".to_string(),
            confidence: 1.0,
            temp_file_path: None,
            original_preview: vec![],
            converted_preview: vec![],
            original_path: file_path,
            file_name,
        });
    }

    // Smart detect encoding
    let detection = encoder::smart_detect_encoding(&data);

    let original_preview = generate_preview(&data, &detection.encoding_name, cfg.preview_lines);

    // Always auto-convert (Smart Auto-Fix)
    let converted_data = encoder::convert_to_utf8_bom(&data, &detection.encoding_name)?;
    let converted_preview = generate_preview(&converted_data, "UTF-8", cfg.preview_lines);

    let temp_path = launcher::create_temp_file(&file_name, &converted_data)?;
    launcher::launch_app(&cfg.default_app, &temp_path)?;

    Ok(ConvertResult {
        auto_converted: true,
        is_binary: false,
        detected_encoding: detection.encoding_name,
        confidence: detection.confidence,
        temp_file_path: Some(temp_path),
        original_preview,
        converted_preview,
        original_path: file_path,
        file_name,
    })
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
fn batch_convert(file_paths: Vec<String>) -> Result<BatchResult, String> {
    let cfg = config::load_config();
    let mut results = Vec::new();
    let mut converted_count = 0usize;
    let mut utf8_count = 0usize;
    let mut binary_count = 0usize;
    let mut error_count = 0usize;

    for file_path in &file_paths {
        let path = Path::new(file_path);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        if !path.exists() {
            error_count += 1;
            results.push(BatchFileResult {
                file_path: file_path.clone(),
                file_name,
                status: "error".to_string(),
                detected_encoding: None,
                error_message: Some("File not found".to_string()),
            });
            continue;
        }

        // Binary passthrough
        if encoder::is_binary_file(path) {
            let _ = launcher::launch_app(&cfg.default_app, file_path);
            binary_count += 1;
            results.push(BatchFileResult {
                file_path: file_path.clone(),
                file_name,
                status: "binary".to_string(),
                detected_encoding: None,
                error_message: None,
            });
            continue;
        }

        match encoder::read_file_bytes(path) {
            Ok(data) => {
                if encoder::is_already_utf8(&data) {
                    let _ = launcher::launch_app(&cfg.default_app, file_path);
                    utf8_count += 1;
                    results.push(BatchFileResult {
                        file_path: file_path.clone(),
                        file_name,
                        status: "already_utf8".to_string(),
                        detected_encoding: Some("UTF-8".to_string()),
                        error_message: None,
                    });
                } else {
                    let detection = encoder::smart_detect_encoding(&data);
                    match encoder::convert_to_utf8_bom(&data, &detection.encoding_name) {
                        Ok(converted) => {
                            match launcher::create_temp_file(&file_name, &converted) {
                                Ok(temp_path) => {
                                    let _ = launcher::launch_app(&cfg.default_app, &temp_path);
                                    converted_count += 1;
                                    results.push(BatchFileResult {
                                        file_path: file_path.clone(),
                                        file_name,
                                        status: "converted".to_string(),
                                        detected_encoding: Some(detection.encoding_name),
                                        error_message: None,
                                    });
                                }
                                Err(e) => {
                                    error_count += 1;
                                    results.push(BatchFileResult {
                                        file_path: file_path.clone(),
                                        file_name,
                                        status: "error".to_string(),
                                        detected_encoding: Some(detection.encoding_name),
                                        error_message: Some(e),
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            error_count += 1;
                            results.push(BatchFileResult {
                                file_path: file_path.clone(),
                                file_name,
                                status: "error".to_string(),
                                detected_encoding: Some(detection.encoding_name),
                                error_message: Some(e),
                            });
                        }
                    }
                }
            }
            Err(e) => {
                error_count += 1;
                results.push(BatchFileResult {
                    file_path: file_path.clone(),
                    file_name,
                    status: "error".to_string(),
                    detected_encoding: None,
                    error_message: Some(format!("{}", e)),
                });
            }
        }
    }

    Ok(BatchResult {
        total: file_paths.len(),
        converted: converted_count,
        already_utf8: utf8_count,
        binary: binary_count,
        errors: error_count,
        results,
    })
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<String>, String> {
    let path = Path::new(&folder_path);
    if !path.is_dir() {
        return Err("Not a directory".to_string());
    }

    let mut files = Vec::new();
    collect_text_files(path, &mut files)?;
    Ok(files)
}

fn collect_text_files(dir: &Path, files: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("{}", e))?;
        let path = entry.path();
        if path.is_dir() {
            collect_text_files(&path, files)?;
        } else if !encoder::is_binary_file(&path) {
            // Only include files with known text extensions
            if has_text_extension(&path) {
                if let Some(s) = path.to_str() {
                    files.push(s.to_string());
                }
            }
        }
    }
    Ok(())
}

fn has_text_extension(path: &Path) -> bool {
    const TEXT_EXTENSIONS: &[&str] = &[
        "csv", "tsv", "txt", "xml", "xsl", "xslt", "json", "htm", "html", "dat", "log",
        "md", "yml", "yaml", "toml", "ini", "cfg", "conf", "properties",
        "sql", "sh", "bat", "cmd", "ps1",
    ];
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        TEXT_EXTENSIONS.contains(&ext.to_lowercase().as_str())
    } else {
        false
    }
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

/// Process a single file silently (no UI). Used by the setup hook.
/// Returns Ok(true) if file was handled (binary, UTF-8, or converted).
fn process_file_silent(file_path: &str) -> Result<bool, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Ok(false);
    }

    let cfg = config::load_config();

    // Binary files → open directly
    if encoder::is_binary_file(path) {
        launcher::launch_app(&cfg.default_app, file_path)?;
        return Ok(true);
    }

    let data = encoder::read_file_bytes(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Already UTF-8 → open directly
    if encoder::is_already_utf8(&data) {
        launcher::launch_app(&cfg.default_app, file_path)?;
        return Ok(true);
    }

    // Needs conversion → smart detect + convert + open
    let detection = encoder::smart_detect_encoding(&data);
    let converted_data = encoder::convert_to_utf8_bom(&data, &detection.encoding_name)?;

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");
    let temp_path = launcher::create_temp_file(file_name, &converted_data)?;
    launcher::launch_app(&cfg.default_app, &temp_path)?;

    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Check CLI args for file path (file association on Windows passes file as arg)
            let args: Vec<String> = std::env::args().collect();

            if args.len() > 1 {
                let file_path = &args[1];
                // Try to process silently (no UI needed)
                if let Ok(true) = process_file_silent(file_path) {
                    // File was handled successfully → exit without showing window
                    std::process::exit(0);
                }
            }

            // No file arg or processing failed → show window for drag-and-drop
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_and_convert,
            convert_with_encoding,
            batch_convert,
            scan_folder,
            get_config,
            update_config,
            get_supported_encodings,
            open_converted_file,
            cleanup_temp,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
