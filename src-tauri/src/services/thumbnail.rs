#![allow(non_snake_case)]

use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;

use base64::Engine;
use blake3::Hasher;
use image::imageops::FilterType;
use image::GenericImageView;
use image::{DynamicImage, ImageReader};
use lazy_static::lazy_static;

use crate::services::gpu_thumbnail;
use crate::services::vector;

lazy_static! {
    static ref VIDEO_GEN_LOCK: Mutex<()> = Mutex::new(());
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThumbnailResult {
    /// Base64-encoded JPEG, populated **only** when the thumbnail could not be
    /// written to disk (i.e. `cache_path` is None).  Prefer `cache_path`.
    pub thumbnail_base64: Option<String>,
    /// Absolute path to the JPEG on disk inside the app's thumbnail cache dir.
    /// The frontend should load this via `convertFileSrc` to avoid copying the
    /// image data through the IPC bridge and into the JS heap.
    pub cache_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub file_size: Option<u64>,
    pub from_cache: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PreviewResult {
    /// Base64-encoded JPEG, populated **only** when the preview could not be
    /// written to disk (i.e. `cache_path` is None).  Prefer `cache_path`.
    pub preview_base64: Option<String>,
    /// Absolute path to the JPEG on disk inside the app's thumbnail cache dir.
    pub cache_path: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub from_cache: bool,
}

fn get_app_thumbnail_cache_dir() -> Option<PathBuf> {
    dirs::cache_dir().map(|d| d.join("descify").join("thumbnails"))
}

fn compute_cache_key(file_path: &str, mtime: u64, size: u64) -> String {
    let mut hasher = Hasher::new();
    hasher.update(file_path.as_bytes());
    hasher.update(b"|".as_ref());
    hasher.update(mtime.to_string().as_bytes());
    hasher.update(b"|".as_ref());
    hasher.update(size.to_string().as_bytes());
    hasher.finalize().to_hex().to_string()
}

fn get_file_metadata(path: &str) -> Option<(u64, u64)> {
    let metadata = fs::metadata(path).ok()?;
    let mtime = metadata
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_secs();
    let size = metadata.len();
    Some((mtime, size))
}

fn read_image_from_file(path: &PathBuf) -> Option<DynamicImage> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let is_raw = matches!(
        extension.as_deref(),
        Some("raw")
            | Some("cr2")
            | Some("cr3")
            | Some("nef")
            | Some("arw")
            | Some("orf")
            | Some("rw2")
            | Some("dng")
            | Some("raf")
            | Some("srw")
            | Some("pef")
    );

    if is_raw {
        return None;
    }

    let file = File::open(path).ok()?;
    let file_size = file.metadata().ok()?.len();

    if file_size > 500_000_000 {
        return None;
    }

    let mmap = match unsafe { memmap2::Mmap::map(&file) } {
        Ok(m) => m,
        Err(_) => return None,
    };

    ImageReader::new(std::io::Cursor::new(&mmap))
        .with_guessed_format()
        .ok()?
        .decode()
        .ok()
}

pub(crate) fn resize_image(img: &DynamicImage, target_size: u32) -> DynamicImage {
    let (w, h) = img.dimensions();
    let max_dim = w.max(h);

    if max_dim <= target_size {
        return img.clone();
    }

    let scale = target_size as f32 / max_dim as f32;
    let new_w = (w as f32 * scale) as u32;
    let new_h = (h as f32 * scale) as u32;

    img.resize(new_w, new_h, FilterType::Triangle)
}

fn encode_jpeg_fast(img: &DynamicImage) -> Vec<u8> {
    let rgb = img.to_rgb8();
    let (width, height) = rgb.dimensions();
    let mut buffer = Vec::with_capacity((width * height / 2) as usize);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, 70);
    encoder.encode_image(&rgb).ok();
    buffer
}

/// Returns the path to a cached thumbnail file if it already exists on disk,
/// without reading or decoding the file contents (avoids unnecessary I/O).
fn get_cached_thumbnail_path(cache_dir: &PathBuf, cache_key: &str) -> Option<PathBuf> {
    let thumb_path = cache_dir.join(format!("{}.jpg", cache_key));
    if thumb_path.exists() {
        Some(thumb_path)
    } else {
        None
    }
}

/// Writes `jpeg_data` to the cache directory and returns the resulting path on
/// success, or `None` if the write failed.  Callers fall back to returning
/// base64-encoded data when this function returns `None`.
fn save_thumbnail_to_cache(
    cache_dir: &PathBuf,
    cache_key: &str,
    jpeg_data: &[u8],
) -> Option<PathBuf> {
    if !cache_dir.exists() {
        fs::create_dir_all(cache_dir).ok()?;
    }
    let thumb_path = cache_dir.join(format!("{}.jpg", cache_key));
    let mut file = File::create(&thumb_path).ok()?;
    file.write_all(jpeg_data).ok()?;
    Some(thumb_path)
}

pub fn generate_thumbnail(file_path: &str, target_size: u32) -> ThumbnailResult {
    let path = PathBuf::from(file_path);
    if !path.exists() || !path.is_file() {
        return ThumbnailResult {
            thumbnail_base64: None,
            cache_path: None,
            width: None,
            height: None,
            file_size: None,
            from_cache: false,
        };
    }

    let file_meta = match get_file_metadata(file_path) {
        Some(m) => m,
        None => {
            return ThumbnailResult {
                thumbnail_base64: None,
                cache_path: None,
                width: None,
                height: None,
                file_size: None,
                from_cache: false,
            }
        }
    };
    let (file_mtime, file_size) = file_meta;

    let cache_key = compute_cache_key(file_path, file_mtime, file_size);
    let cache_dir = match get_app_thumbnail_cache_dir() {
        Some(d) => d,
        None => {
            return ThumbnailResult {
                thumbnail_base64: None,
                cache_path: None,
                width: None,
                height: None,
                file_size: None,
                from_cache: false,
            }
        }
    };

    // Cache hit: return the on-disk path without reading or re-encoding the file.
    // The frontend loads it via the asset:// protocol (convertFileSrc).
    if let Some(cached_path) = get_cached_thumbnail_path(&cache_dir, &cache_key) {
        return ThumbnailResult {
            thumbnail_base64: None,
            cache_path: Some(cached_path.to_string_lossy().into_owned()),
            width: None,
            height: None,
            file_size: Some(file_size),
            from_cache: true,
        };
    }

    // Vector formats (.ai / .eps) cannot be decoded by the `image` crate —
    // rasterize them through the Ghostscript-backed vector service instead.
    let img = if vector::is_vector_file(&path) {
        match vector::rasterize_vector(file_path, target_size) {
            Some(i) => i,
            None => {
                return ThumbnailResult {
                    thumbnail_base64: None,
                    cache_path: None,
                    width: None,
                    height: None,
                    file_size: Some(file_size),
                    from_cache: false,
                }
            }
        }
    } else {
        match read_image_from_file(&path) {
            Some(i) => i,
            None => {
                return ThumbnailResult {
                    thumbnail_base64: None,
                    cache_path: None,
                    width: None,
                    height: None,
                    file_size: Some(file_size),
                    from_cache: false,
                }
            }
        }
    };

    let resized = resize_image(&img, target_size);
    let (width, height) = resized.dimensions();
    let jpeg_data = encode_jpeg_fast(&resized);

    // Prefer returning a path so the image never has to cross the IPC bridge as
    // base64.  Fall back to base64 only if the disk write failed.
    let (cache_path, thumbnail_base64) =
        match save_thumbnail_to_cache(&cache_dir, &cache_key, &jpeg_data) {
            Some(p) => (Some(p.to_string_lossy().into_owned()), None),
            None => (
                None,
                Some(base64::engine::general_purpose::STANDARD.encode(&jpeg_data)),
            ),
        };

    ThumbnailResult {
        thumbnail_base64,
        cache_path,
        width: Some(width),
        height: Some(height),
        file_size: Some(file_size),
        from_cache: false,
    }
}

pub fn generate_preview(file_path: &str, target_size: u32) -> PreviewResult {
    let path = PathBuf::from(file_path);
    if !path.exists() || !path.is_file() {
        return PreviewResult {
            preview_base64: None,
            cache_path: None,
            width: None,
            height: None,
            from_cache: false,
        };
    }

    let file_meta = match get_file_metadata(file_path) {
        Some(m) => m,
        None => {
            return PreviewResult {
                preview_base64: None,
                cache_path: None,
                width: None,
                height: None,
                from_cache: false,
            }
        }
    };
    let (file_mtime, _file_size) = file_meta;

    let cache_key = format!("preview_{}", compute_cache_key(file_path, file_mtime, 0));
    let cache_dir = match get_app_thumbnail_cache_dir() {
        Some(d) => d,
        None => {
            return PreviewResult {
                preview_base64: None,
                cache_path: None,
                width: None,
                height: None,
                from_cache: false,
            }
        }
    };

    if let Some(cached_path) = get_cached_thumbnail_path(&cache_dir, &cache_key) {
        return PreviewResult {
            preview_base64: None,
            cache_path: Some(cached_path.to_string_lossy().into_owned()),
            width: None,
            height: None,
            from_cache: true,
        };
    }

    // Vector formats (.ai / .eps) cannot be decoded by the `image` crate —
    // rasterize them through the Ghostscript-backed vector service instead.
    let img = if vector::is_vector_file(&path) {
        match vector::rasterize_vector(file_path, target_size) {
            Some(i) => i,
            None => {
                return PreviewResult {
                    preview_base64: None,
                    cache_path: None,
                    width: None,
                    height: None,
                    from_cache: false,
                }
            }
        }
    } else {
        match read_image_from_file(&path) {
            Some(i) => i,
            None => {
                return PreviewResult {
                    preview_base64: None,
                    cache_path: None,
                    width: None,
                    height: None,
                    from_cache: false,
                }
            }
        }
    };

    let resized = resize_image(&img, target_size);
    let (width, height) = resized.dimensions();
    let jpeg_data = encode_jpeg_fast(&resized);

    let (cache_path, preview_base64) =
        match save_thumbnail_to_cache(&cache_dir, &cache_key, &jpeg_data) {
            Some(p) => (Some(p.to_string_lossy().into_owned()), None),
            None => (
                None,
                Some(base64::engine::general_purpose::STANDARD.encode(&jpeg_data)),
            ),
        };

    PreviewResult {
        preview_base64,
        cache_path,
        width: Some(width),
        height: Some(height),
        from_cache: false,
    }
}

fn get_ffmpeg_path() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let ffmpeg = exe_dir.join("ffmpeg-x86_64-unknown-linux-gnu-x86_64-unknown-linux-gnu");
    if ffmpeg.exists() {
        return Some(ffmpeg);
    }
    let ffmpeg = exe_dir.join("ffmpeg");
    if ffmpeg.exists() {
        return Some(ffmpeg);
    }
    which::which("ffmpeg").ok()
}

fn detect_video_dimensions(file_path: &str) -> Option<(u32, u32)> {
    let ffmpeg = get_ffmpeg_path()?;
    let output = Command::new(&ffmpeg)
        .args(["-i", file_path, "-hide_banner"])
        .output()
        .ok()?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        if line.contains("Video:") || line.contains("Stream #") {
            if let Some(res) = line.split("x").last() {
                let dims: Vec<u32> = res
                    .split_whitespace()
                    .next()?
                    .split(',')
                    .next()?
                    .split('x')
                    .filter_map(|s| s.trim().parse().ok())
                    .collect();
                if dims.len() >= 2 {
                    return Some((dims[0], dims[1]));
                }
            }
        }
    }
    None
}

fn generate_video_thumbnail_ffmpeg(
    file_path: &str,
    target_size: u32,
) -> Option<(Vec<u8>, u32, u32)> {
    let ffmpeg = get_ffmpeg_path()?;

    let (orig_w, orig_h) = detect_video_dimensions(file_path).unwrap_or((1920, 1080));
    let scale = if orig_w > orig_h {
        (target_size as f32 / orig_w as f32).min(1.0)
    } else {
        (target_size as f32 / orig_h as f32).min(1.0)
    };
    let new_w = (orig_w as f32 * scale) as u32;
    let new_h = (orig_h as f32 * scale) as u32;

    let temp_dir = std::env::temp_dir();
    let output_path = temp_dir.join(format!("thumb_{}.jpg", std::process::id()));

    let use_gpu = gpu_thumbnail::is_gpu_available();
    let hwaccel_args = gpu_thumbnail::get_ffmpeg_hwaccel_args();

    let filter_str = if use_gpu {
        format!("scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,hwupload_cuda", new_w, new_h, new_w, new_h)
    } else {
        format!(
            "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
            new_w, new_h, new_w, new_h
        )
    };

    let mut args = vec!["-y".to_string(), "-ss".to_string(), "00:00:01".to_string()];
    for arg in hwaccel_args.iter() {
        args.push(arg.to_string());
    }
    args.push("-i".to_string());
    args.push(file_path.to_string());
    args.push("-vframes".to_string());
    args.push("1".to_string());
    args.push("-vf".to_string());
    args.push(filter_str);
    args.push("-q:v".to_string());
    args.push("2".to_string());
    args.push(output_path.to_str()?.to_string());

    let output = Command::new(&ffmpeg).args(&args).output().ok()?;

    if !output.status.success() {
        let fallback_output = temp_dir.join(format!("thumb_fallback_{}.jpg", std::process::id()));
        let fallback_filter = format!("scale={}:{}", new_w, new_h);
        let output = Command::new(&ffmpeg)
            .args([
                "-y", "-ss", "00:00:01", "-i", file_path, "-vframes", "1", "-vf",
            ])
            .arg(&fallback_filter)
            .args(["-q:v", "2"])
            .arg(fallback_output.to_str()?)
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let data = fs::read(&fallback_output).ok()?;
        let _ = fs::remove_file(&fallback_output);

        let img = ImageReader::new(std::io::Cursor::new(&data))
            .with_guessed_format()
            .ok()?
            .decode()
            .ok()?;

        let (w, h) = img.dimensions();
        return Some((data, w, h));
    }

    let data = fs::read(&output_path).ok()?;
    let _ = fs::remove_file(&output_path);

    let img = ImageReader::new(std::io::Cursor::new(&data))
        .with_guessed_format()
        .ok()?
        .decode()
        .ok()?;

    let (w, h) = img.dimensions();
    Some((data, w, h))
}

pub fn generate_video_thumbnail(file_path: &str, target_size: u32) -> ThumbnailResult {
    let _guard = VIDEO_GEN_LOCK.lock().unwrap();

    let path = PathBuf::from(file_path);
    if !path.exists() || !path.is_file() {
        return ThumbnailResult {
            thumbnail_base64: None,
            cache_path: None,
            width: None,
            height: None,
            file_size: None,
            from_cache: false,
        };
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let is_video = matches!(
        extension.as_deref(),
        Some("mp4")
            | Some("mov")
            | Some("webm")
            | Some("avi")
            | Some("mkv")
            | Some("flv")
            | Some("wmv")
            | Some("m4v")
            | Some("3gp")
            | Some("ogv")
            | Some("mts")
            | Some("m2ts")
    );

    if !is_video {
        return ThumbnailResult {
            thumbnail_base64: None,
            cache_path: None,
            width: None,
            height: None,
            file_size: None,
            from_cache: false,
        };
    }

    let file_meta = match get_file_metadata(file_path) {
        Some(m) => m,
        None => {
            return ThumbnailResult {
                thumbnail_base64: None,
                cache_path: None,
                width: None,
                height: None,
                file_size: None,
                from_cache: false,
            }
        }
    };
    let (file_mtime, file_size) = file_meta;

    let cache_key = format!(
        "video_{}",
        compute_cache_key(file_path, file_mtime, file_size)
    );
    let cache_dir = match get_app_thumbnail_cache_dir() {
        Some(d) => d,
        None => {
            return ThumbnailResult {
                thumbnail_base64: None,
                cache_path: None,
                width: None,
                height: None,
                file_size: None,
                from_cache: false,
            }
        }
    };

    if let Some(cached_path) = get_cached_thumbnail_path(&cache_dir, &cache_key) {
        return ThumbnailResult {
            thumbnail_base64: None,
            cache_path: Some(cached_path.to_string_lossy().into_owned()),
            width: None,
            height: None,
            file_size: Some(file_size),
            from_cache: true,
        };
    }

    let (jpeg_data, width, height) = match generate_video_thumbnail_ffmpeg(file_path, target_size) {
        Some(result) => result,
        None => {
            return ThumbnailResult {
                thumbnail_base64: None,
                cache_path: None,
                width: None,
                height: None,
                file_size: Some(file_size),
                from_cache: false,
            }
        }
    };

    let (cache_path, thumbnail_base64) =
        match save_thumbnail_to_cache(&cache_dir, &cache_key, &jpeg_data) {
            Some(p) => (Some(p.to_string_lossy().into_owned()), None),
            None => (
                None,
                Some(base64::engine::general_purpose::STANDARD.encode(&jpeg_data)),
            ),
        };

    ThumbnailResult {
        thumbnail_base64,
        cache_path,
        width: Some(width),
        height: Some(height),
        file_size: Some(file_size),
        from_cache: false,
    }
}

pub fn generate_video_preview(file_path: &str, target_size: u32) -> PreviewResult {
    let _guard = VIDEO_GEN_LOCK.lock().unwrap();

    let path = PathBuf::from(file_path);
    if !path.exists() || !path.is_file() {
        return PreviewResult {
            preview_base64: None,
            cache_path: None,
            width: None,
            height: None,
            from_cache: false,
        };
    }

    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    let is_video = matches!(
        extension.as_deref(),
        Some("mp4")
            | Some("mov")
            | Some("webm")
            | Some("avi")
            | Some("mkv")
            | Some("flv")
            | Some("wmv")
            | Some("m4v")
            | Some("3gp")
            | Some("ogv")
            | Some("mts")
            | Some("m2ts")
    );

    if !is_video {
        return PreviewResult {
            preview_base64: None,
            cache_path: None,
            width: None,
            height: None,
            from_cache: false,
        };
    }

    let file_meta = match get_file_metadata(file_path) {
        Some(m) => m,
        None => {
            return PreviewResult {
                preview_base64: None,
                cache_path: None,
                width: None,
                height: None,
                from_cache: false,
            }
        }
    };
    let (file_mtime, _file_size) = file_meta;

    let cache_key = format!(
        "video_preview_{}",
        compute_cache_key(file_path, file_mtime, 0)
    );
    let cache_dir = match get_app_thumbnail_cache_dir() {
        Some(d) => d,
        None => {
            return PreviewResult {
                preview_base64: None,
                cache_path: None,
                width: None,
                height: None,
                from_cache: false,
            }
        }
    };

    if let Some(cached_path) = get_cached_thumbnail_path(&cache_dir, &cache_key) {
        return PreviewResult {
            preview_base64: None,
            cache_path: Some(cached_path.to_string_lossy().into_owned()),
            width: None,
            height: None,
            from_cache: true,
        };
    }

    let (jpeg_data, width, height) = match generate_video_thumbnail_ffmpeg(file_path, target_size) {
        Some(result) => result,
        None => {
            return PreviewResult {
                preview_base64: None,
                cache_path: None,
                width: None,
                height: None,
                from_cache: false,
            }
        }
    };

    let (cache_path, preview_base64) =
        match save_thumbnail_to_cache(&cache_dir, &cache_key, &jpeg_data) {
            Some(p) => (Some(p.to_string_lossy().into_owned()), None),
            None => (
                None,
                Some(base64::engine::general_purpose::STANDARD.encode(&jpeg_data)),
            ),
        };

    PreviewResult {
        preview_base64,
        cache_path,
        width: Some(width),
        height: Some(height),
        from_cache: false,
    }
}
