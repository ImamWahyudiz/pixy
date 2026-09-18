import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export interface EnhanceOptions {
  scale?: 1 | 2 | 4;
  sharpen?: 'none' | 'normal' | 'strong';
  normalise?: boolean;
  format?: 'original' | 'webp' | 'png' | 'jpeg';
  quality?: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.jfif', '.heic', '.webp', '.gif']);

export function isSupportedImage(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Enhances a single image (Non-AI) using Sharp with Lanczos3 super-sampling,
 * smart sharpening, contrast normalization, and optional format preservation.
 */
export async function enhanceImage(
  inputFilePath: string,
  outputDir: string,
  options: EnhanceOptions = {}
): Promise<string | null> {
  const filename = path.basename(inputFilePath);
  if (!isSupportedImage(filename)) {
    return null;
  }

  const ext = path.extname(filename).toLowerCase();
  const isGif = ext === '.gif';
  const scale = options.scale ?? 2;
  const sharpenLevel = options.sharpen ?? 'normal';
  const shouldNormalise = options.normalise ?? true;
  const targetFormat = options.format ?? 'original';
  const quality = options.quality ?? 90;

  // Determine output extension
  let outputExt = ext;
  if (targetFormat !== 'original') {
    outputExt = `.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`;
  }

  const nameWithoutExt = path.parse(filename).name;
  const outputFilePath = path.join(outputDir, `${nameWithoutExt}_enhanced${outputExt}`);

  // Load image with animated support if it's GIF
  let pipeline = sharp(inputFilePath, isGif ? { animated: true } : {});
  const meta = await pipeline.metadata();

  // 1. Resizing with high-quality Lanczos3 kernel
  if (scale > 1 && meta.width) {
    const newWidth = Math.round(meta.width * scale);
    pipeline = pipeline.resize({
      width: newWidth,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    });
  }

  // 2. Smart Sharpening
  if (sharpenLevel === 'normal') {
    pipeline = pipeline.sharpen({ sigma: 1.0, m1: 0.5, m2: 2.0 });
  } else if (sharpenLevel === 'strong') {
    pipeline = pipeline.sharpen({ sigma: 1.5, m1: 1.0, m2: 3.0 });
  }

  // 3. Contrast Normalisation
  if (shouldNormalise) {
    pipeline = pipeline.normalise();
  }

  // 4. Output format handling
  if (outputExt === '.gif') {
    await pipeline
      .gif({
        colours: 256,
        effort: 7,
        dither: 1.0,
      })
      .toFile(outputFilePath);
  } else if (outputExt === '.png') {
    await pipeline
      .png({ compressionLevel: 8, effort: 8 })
      .toFile(outputFilePath);
  } else if (outputExt === '.webp') {
    await pipeline
      .webp({ quality, effort: 6, smartSubsample: true })
      .toFile(outputFilePath);
  } else {
    // jpg / jpeg / jfif
    await pipeline
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:4:4', trellisQuantisation: true })
      .toFile(outputFilePath);
  }

  return outputFilePath;
}

/**
 * Processes a path (file or directory) for enhancement.
 */
export async function processEnhancePath(
  inputPath: string,
  options: EnhanceOptions,
  onProgress?: (file: string, index: number, total: number) => void,
  customOutputDir?: string
): Promise<{ success: string[]; failed: { file: string; error: any }[] }> {
  const stats = await fs.stat(inputPath);
  const isDirectory = stats.isDirectory();

  const outputDir = customOutputDir || path.join(process.cwd(), 'output', 'enhance');
  await fs.mkdir(outputDir, { recursive: true });

  const result = {
    success: [] as string[],
    failed: [] as { file: string; error: any }[],
  };

  if (isDirectory) {
    const files = await fs.readdir(inputPath);
    const validFiles = files.filter(f => isSupportedImage(f));
    let processed = 0;

    for (const file of validFiles) {
      const filePath = path.join(inputPath, file);
      const fileStats = await fs.stat(filePath);

      if (fileStats.isFile()) {
        processed++;
        if (onProgress) onProgress(file, processed, validFiles.length);
        try {
          const outPath = await enhanceImage(filePath, outputDir, options);
          if (outPath) {
            result.success.push(outPath);
          }
        } catch (error) {
          result.failed.push({ file: filePath, error });
        }
      }
    }
  } else {
    if (isSupportedImage(inputPath)) {
      if (onProgress) onProgress(path.basename(inputPath), 1, 1);
      try {
        const outPath = await enhanceImage(inputPath, outputDir, options);
        if (outPath) {
          result.success.push(outPath);
        }
      } catch (error) {
        result.failed.push({ file: inputPath, error });
      }
    } else {
      throw new Error(`File format not supported. Supported: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
    }
  }

  return result;
}
