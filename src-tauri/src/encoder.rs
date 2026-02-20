use chardetng::EncodingDetector;
use encoding_rs::Encoding;
use std::fs;
use std::io;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct DetectionResult {
    pub encoding_name: String,
    pub confidence: f32,
}

/// Detect the encoding of a file's contents.
/// Returns the detected encoding name and a confidence score (0.0 - 1.0).
pub fn detect_encoding(data: &[u8]) -> DetectionResult {
    // Check for BOM markers first
    if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
        return DetectionResult {
            encoding_name: "UTF-8".to_string(),
            confidence: 1.0,
        };
    }
    if data.len() >= 2 {
        if data[0] == 0xFF && data[1] == 0xFE {
            return DetectionResult {
                encoding_name: "UTF-16LE".to_string(),
                confidence: 1.0,
            };
        }
        if data[0] == 0xFE && data[1] == 0xFF {
            return DetectionResult {
                encoding_name: "UTF-16BE".to_string(),
                confidence: 1.0,
            };
        }
    }

    let mut detector = EncodingDetector::new();
    detector.feed(data, true);

    let encoding = detector.guess(Some(b"ja"), true);
    let encoding_name = encoding.name().to_string();

    // chardetng doesn't provide a direct confidence score,
    // so we estimate one based on heuristics.
    let confidence = estimate_confidence(data, encoding);

    DetectionResult {
        encoding_name,
        confidence,
    }
}

/// Estimate confidence for the detected encoding.
fn estimate_confidence(data: &[u8], encoding: &'static Encoding) -> f32 {
    // Try decoding and see if there are replacement characters
    let (decoded, _, had_errors) = encoding.decode(data);

    if !had_errors {
        // If it's valid UTF-8, high confidence
        if encoding == encoding_rs::UTF_8 {
            return 0.95;
        }
        // Valid decode without errors = good confidence
        // Check if the decoded text contains common Japanese characters
        let has_japanese = decoded.chars().any(|c| {
            ('\u{3000}'..='\u{9FFF}').contains(&c) || ('\u{F900}'..='\u{FAFF}').contains(&c)
        });
        if has_japanese {
            return 0.90;
        }
        return 0.80;
    }

    // Had errors during decoding = lower confidence
    0.50
}

/// Convert data from the source encoding to UTF-8 with BOM.
pub fn convert_to_utf8_bom(data: &[u8], source_encoding_name: &str) -> Result<Vec<u8>, String> {
    let source_data = strip_bom(data);

    let encoding = Encoding::for_label(source_encoding_name.as_bytes())
        .ok_or_else(|| format!("Unknown encoding: {}", source_encoding_name))?;

    let (decoded, _, had_errors) = encoding.decode(source_data);

    if had_errors {
        return Err("Encoding conversion had errors (some characters could not be decoded)".to_string());
    }

    // Build UTF-8 BOM + content
    let mut result = Vec::with_capacity(3 + decoded.len());
    result.extend_from_slice(&[0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    result.extend_from_slice(decoded.as_bytes());

    Ok(result)
}

/// Strip BOM from the beginning of data if present.
fn strip_bom(data: &[u8]) -> &[u8] {
    if data.len() >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
        return &data[3..];
    }
    if data.len() >= 2 {
        if (data[0] == 0xFF && data[1] == 0xFE) || (data[0] == 0xFE && data[1] == 0xFF) {
            return &data[2..];
        }
    }
    data
}

/// Read file contents as raw bytes (read-only, never modifies the original).
pub fn read_file_bytes(path: &Path) -> io::Result<Vec<u8>> {
    fs::read(path)
}

/// Get the first N lines from decoded text for preview.
pub fn get_preview_lines(text: &str, n: usize) -> Vec<String> {
    text.lines().take(n).map(|s| s.to_string()).collect()
}

/// Get a list of supported encoding names for the UI dropdown.
pub fn supported_encodings() -> Vec<&'static str> {
    vec![
        "Shift_JIS",
        "UTF-8",
        "EUC-JP",
        "ISO-2022-JP",
        "UTF-16LE",
        "UTF-16BE",
        "windows-1252",
    ]
}
