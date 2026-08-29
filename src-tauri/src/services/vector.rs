//! Vector graphics rasterization (.ai / .eps) via an external Ghostscript binary.
//!
//! `.ai` (v9+, PDF-compatible) and `.eps` (PostScript) cannot be decoded by the
//! `image` crate, so we shell out to Ghostscript — the same external-tool
//! pattern already used for FFmpeg (video thumbnails) and ExifTool (metadata).
//!
//! Ghostscript is *detected* at runtime and never bundled: bundling would make
//! the entire application subject to Ghostscript's AGPL license, while
//! invoking an unmodified, separately-installed binary does not.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

use image::DynamicImage;
use image::GenericImageView;

use crate::services::thumbnail::resize_image;

/// Ghostscript console binary candidates, in preference order.
/// `gswin64c` / `gswin32c` are the Windows console executables.
const GHOSTSCRIPT_CANDIDATES: [&str; 3] = ["gs", "gswin64c", "gswin32c"];

/// Base DPI for the first rasterization attempt. If the result is smaller than
/// the requested target size the file is re-rendered at a proportionally
/// higher DPI (capped) so large previews stay crisp.
const BASE_DPI: f64 = 150.0;

/// Upper DPI bound to keep memory usage and latency bounded for huge artboards.
const MAX_DPI: f64 = 600.0;

static RENDER_SEQ: AtomicU64 = AtomicU64::new(0);

/// Returns `true` when `path` has a supported vector extension (`.ai` / `.eps`).
pub fn is_vector_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| matches!(e.to_lowercase().as_str(), "ai" | "eps"))
        .unwrap_or(false)
}

/// Locate a Ghostscript executable on the system.
fn get_ghostscript_path() -> Option<PathBuf> {
    for candidate in GHOSTSCRIPT_CANDIDATES {
        if let Ok(path) = which::which(candidate) {
            return Some(path);
        }
    }
    None
}

/// Warn (once per process) when Ghostscript is missing, so users understand
/// why .ai/.eps files fail to produce thumbnails.
fn warn_ghostscript_missing_once() {
    use std::sync::atomic::AtomicBool;
    static WARNED: AtomicBool = AtomicBool::new(false);
    if !WARNED.swap(true, Ordering::Relaxed) {
        eprintln!(
            "⚠️ Ghostscript not found — .ai/.eps support is disabled. \
             Install it to enable vector rasterization \
             (Linux: `sudo apt install ghostscript`, macOS: `brew install ghostscript`, \
             Windows: https://ghostscript.com/releases)."
        );
    }
}

/// Render `file_path` with Ghostscript to a temp PNG and return its bytes.
fn render_to_png(gs: &Path, file_path: &str, dpi: f64) -> Option<Vec<u8>> {
    let seq = RENDER_SEQ.fetch_add(1, Ordering::Relaxed);
    let output_path = std::env::temp_dir()
        .join(format!("descify_vector_{}_{}.png", std::process::id(), seq));

    // -dEPSCrop respects the EPS bounding box (harmless for PDF-based .ai).
    // pngalpha renders with transparency; the result is flattened onto white
    // by the caller so transparent areas don't turn black in the JPEG cache.
    // Text/graphics alpha bits give smoother downscale results.
    let output = Command::new(gs)
        .args([
            "-dSAFER",
            "-dBATCH",
            "-dNOPAUSE",
            "-dEPSCrop",
            "-dTextAlphaBits=4",
            "-dGraphicsAlphaBits=4",
            "-sDEVICE=pngalpha",
        ])
        .arg(format!("-r{}", dpi))
        .arg("-o")
        .arg(&output_path)
        .arg(file_path)
        .output()
        .ok()?;

    if !output.status.success() {
        let _ = std::fs::remove_file(&output_path);
        eprintln!(
            "Ghostscript failed to rasterize {} (exit code {:?}): {}",
            file_path,
            output.status.code(),
            String::from_utf8_lossy(&output.stderr).trim()
        );
        return None;
    }

    let data = std::fs::read(&output_path).ok();
    let _ = std::fs::remove_file(&output_path);
    data
}

/// Decode PNG bytes into a `DynamicImage`.
fn decode_png(png_data: &[u8]) -> Option<DynamicImage> {
    image::ImageReader::new(std::io::Cursor::new(png_data))
        .with_guessed_format()
        .ok()?
        .decode()
        .ok()
}


/// Composite a (possibly transparent) image onto a white background.
///
/// The thumbnail cache stores JPEG, which has no alpha channel — without this
/// step every transparent pixel would be encoded as black.
fn flatten_onto_white(img: &DynamicImage) -> DynamicImage {
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut canvas =
        image::RgbaImage::from_pixel(width, height, image::Rgba([255, 255, 255, 255]));
    image::imageops::overlay(&mut canvas, &rgba, 0, 0);
    DynamicImage::ImageRgba8(canvas)
}

/// Rasterize a vector file (.ai / .eps) into a flattened `DynamicImage`.
///
/// The returned image is NOT sized exactly to `target_size` — the caller
/// applies the shared `resize_image` / `encode_jpeg_fast` pipeline.
/// `target_size` is used to pick a rendering DPI that yields enough pixels
/// for the requested size.
///
/// Returns `None` when Ghostscript is unavailable or rendering fails.
pub fn rasterize_vector(file_path: &str, target_size: u32) -> Option<DynamicImage> {
    let gs = match get_ghostscript_path() {
        Some(gs) => gs,
        None => {
            warn_ghostscript_missing_once();
            return None;
        }
    };

    let img = render_to_png(&gs, file_path, BASE_DPI).and_then(|d| decode_png(&d))?;

    // If the first pass is below the requested size, re-render at a higher DPI.
    let (w, h) = img.dimensions();
    let max_dim = w.max(h);
    let img = if max_dim < target_size {
        let dpi = ((BASE_DPI * target_size as f64) / max_dim as f64).min(MAX_DPI);
        render_to_png(&gs, file_path, dpi)
            .and_then(|d| decode_png(&d))
            .unwrap_or(img)
    } else {
        img
    };

    // Bring the render down towards the requested size; render at ~2x the
    // target and let the caller fine-tune with its own resize pass.
    let img = resize_image(&img, target_size * 2);
    Some(flatten_onto_white(&img))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_EPS: &str = "%!PS-Adobe-3.0 EPSF-3.0\n\
        %%BoundingBox: 0 0 200 100\n\
        0 0 0 setrgbcolor\n\
        10 60 moveto /Helvetica findfont 40 scalefont setfont (EPS Test) show\n\
        0 0 200 100 rectstroke\n\
        %%EOF\n";

    #[test]
    fn detects_vector_extensions() {
        assert!(is_vector_file(Path::new("/tmp/logo.ai")));
        assert!(is_vector_file(Path::new("/tmp/logo.EPS")));
        assert!(is_vector_file(Path::new("/tmp/logo.Ai")));
        assert!(!is_vector_file(Path::new("/tmp/logo.png")));
        assert!(!is_vector_file(Path::new("/tmp/logo")));
        assert!(!is_vector_file(Path::new("/tmp/ai.txt")));
    }

    #[test]
    fn rasterizes_eps_file() {
        // Skip gracefully when Ghostscript is not installed (e.g. CI containers).
        if get_ghostscript_path().is_none() {
            eprintln!("Ghostscript not installed — skipping rasterization test");
            return;
        }

        let dir = std::env::temp_dir()
            .join(format!("descify_vector_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let eps_path = dir.join("test.eps");
        std::fs::write(&eps_path, SAMPLE_EPS).unwrap();

        let img = rasterize_vector(eps_path.to_str().unwrap(), 720)
            .expect("EPS rasterization should succeed");

        let (w, h) = img.dimensions();
        assert!(w > 0 && h > 0, "rasterized image must have non-zero dimensions");
        // BoundingBox is 200x100 (2:1) — verify -dEPSCrop was respected.
        let ratio = w as f64 / h as f64;
        assert!(
            (ratio - 2.0).abs() < 0.1,
            "expected ~2:1 aspect ratio, got {}x{}",
            w,
            h
        );

        let _ = std::fs::remove_dir_all(&dir);
    }
}


