use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Path to the default application to open CSV files.
    /// "system_default" means use the OS default handler.
    pub default_app: String,

    /// Target encoding for conversion. Default is "utf-8-bom".
    pub target_encoding: String,

    /// Confidence threshold (0.0-1.0). Below this, show confirmation UI.
    pub confidence_threshold: f32,

    /// Number of lines to show in preview.
    pub preview_lines: usize,

    /// Whether to keep temp files after the app closes.
    pub keep_temp_file: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            default_app: "system_default".to_string(),
            target_encoding: "utf-8-bom".to_string(),
            confidence_threshold: 0.75,
            preview_lines: 10,
            keep_temp_file: false,
        }
    }
}

/// Get the config file path: %APPDATA%/encodingman/config.json
fn config_path() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("encodingman");
    path.push("config.json");
    path
}

/// Load config from disk. Returns default if file doesn't exist.
pub fn load_config() -> AppConfig {
    let path = config_path();
    if !path.exists() {
        return AppConfig::default();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// Save config to disk.
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}
