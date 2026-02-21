use encoding_rs::Encoding;

/// Score result for a single encoding candidate.
#[derive(Debug, Clone)]
pub struct EncodingScore {
    pub encoding_name: String,
    pub score: f64,
    pub replacement_count: usize,
    pub japanese_char_count: usize,
    pub total_chars: usize,
}

/// Candidate encodings to try for Japanese text detection.
const CANDIDATE_ENCODINGS: &[&str] = &[
    "Shift_JIS",
    "EUC-JP",
    "ISO-2022-JP",
    "UTF-8",
    "UTF-16LE",
    "UTF-16BE",
    "windows-1252",
];

/// Score all candidate encodings against raw bytes.
/// Returns scores sorted descending (best first).
pub fn score_all_encodings(data: &[u8]) -> Vec<EncodingScore> {
    let mut scores: Vec<EncodingScore> = CANDIDATE_ENCODINGS
        .iter()
        .filter_map(|name| {
            let encoding = Encoding::for_label(name.as_bytes())?;
            Some(score_encoding(data, encoding, name))
        })
        .collect();

    scores.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    scores
}

/// Pick the best encoding for the given data.
pub fn best_encoding(data: &[u8]) -> EncodingScore {
    let scores = score_all_encodings(data);
    scores.into_iter().next().unwrap_or(EncodingScore {
        encoding_name: "UTF-8".to_string(),
        score: 0.0,
        replacement_count: 0,
        japanese_char_count: 0,
        total_chars: 0,
    })
}

fn score_encoding(data: &[u8], encoding: &'static Encoding, name: &str) -> EncodingScore {
    let (decoded, _, had_errors) = encoding.decode(data);

    let total_chars = decoded.chars().count();
    if total_chars == 0 {
        return EncodingScore {
            encoding_name: name.to_string(),
            score: 0.0,
            replacement_count: 0,
            japanese_char_count: 0,
            total_chars: 0,
        };
    }

    let mut replacement_count = 0usize;
    let mut japanese_count = 0usize;
    let mut control_count = 0usize;

    for ch in decoded.chars() {
        if ch == '\u{FFFD}' {
            replacement_count += 1;
        }
        if is_japanese_char(ch) {
            japanese_count += 1;
        }
        if ch.is_control() && ch != '\n' && ch != '\r' && ch != '\t' {
            control_count += 1;
        }
    }

    let replacement_ratio = replacement_count as f64 / total_chars as f64;
    let valid_ratio = (total_chars.saturating_sub(control_count)) as f64 / total_chars as f64;
    let japanese_ratio = japanese_count as f64 / total_chars as f64;

    // Penalize heavily if encoding_rs reported errors
    let error_penalty = if had_errors { 0.3 } else { 0.0 };

    let score = (1.0 - replacement_ratio) * 0.4
        + valid_ratio * 0.2
        + japanese_ratio * 0.3
        + 0.1
        - error_penalty;

    EncodingScore {
        encoding_name: name.to_string(),
        score: score.max(0.0),
        replacement_count,
        japanese_char_count: japanese_count,
        total_chars,
    }
}

fn is_japanese_char(ch: char) -> bool {
    matches!(ch,
        '\u{3040}'..='\u{309F}'   // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{4E00}'..='\u{9FFF}' // CJK Unified Ideographs (Kanji)
        | '\u{3400}'..='\u{4DBF}' // CJK Extension A
        | '\u{F900}'..='\u{FAFF}' // CJK Compatibility Ideographs
        | '\u{FF00}'..='\u{FFEF}' // Halfwidth/Fullwidth forms
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
    )
}
