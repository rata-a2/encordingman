use std::path::Path;
use std::process::Command;

/// Launch the specified application with the given file path.
/// If app_path is "system_default" or empty, open with the OS default handler.
pub fn launch_app(app_path: &str, file_path: &str) -> Result<(), String> {
    if app_path.is_empty() || app_path == "system_default" {
        open::that(file_path).map_err(|e| format!("Failed to open file with system default: {}", e))
    } else {
        // Verify the app exists
        if !Path::new(app_path).exists() {
            return Err(format!("Application not found: {}", app_path));
        }

        Command::new(app_path)
            .arg(file_path)
            .spawn()
            .map_err(|e| format!("Failed to launch {}: {}", app_path, e))?;

        Ok(())
    }
}

/// Create a temporary file with the given data and return its path.
/// The file is named to preserve the original .csv extension.
pub fn create_temp_file(original_name: &str, data: &[u8]) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("encodingman");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Use original filename with a prefix to avoid collisions
    let stem = Path::new(original_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("converted");
    let temp_path = temp_dir.join(format!("{}_utf8.csv", stem));

    std::fs::write(&temp_path, data)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    temp_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert temp path to string".to_string())
}

/// Delete a temporary file.
pub fn cleanup_temp_file(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if p.exists() {
        std::fs::remove_file(p).map_err(|e| format!("Failed to delete temp file: {}", e))?;
    }
    Ok(())
}
