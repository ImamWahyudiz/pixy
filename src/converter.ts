import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export interface ConverterOptions {
  quality: number;
  colors?: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.jfif', '.heic', '.webp', '.gif']);

/**
 * Validates if the file has a supported extension.
 */
function isSupportedImage(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Converts or compresses a single image file and saves it to the output directory.
 * - Static images (.jpg, .png, etc.) are converted to WebP.
 * - GIF images (.gif) are compressed and saved as animated GIF.
 * @param inputFilePath Full path to the input image file
 * @param outputDir Directory where the compressed file will be saved
 * @param options Conversion options (e.g. quality, colors)
 * @returns The path to the output file, or null if it was skipped (unsupported format)
 */
export async function convertImage(
  inputFilePath: string,
  outputDir: string,
  options: ConverterOptions
): Promise<string | null> {
  const filename = path.basename(inputFilePath);
  if (!isSupportedImage(filename)) {
    return null;
  }

  const ext = path.extname(filename).toLowerCase();
  const isGif = ext === '.gif';

  const nameWithoutExt = path.parse(filename).name;
  const outputExtension = isGif ? '.gif' : '.webp';
  const outputFilePath = path.join(outputDir, `${nameWithoutExt}${outputExtension}`);

  if (isGif) {
    const colours = options.colors !== undefined
      ? Math.max(2, Math.min(256, options.colors))
      : Math.max(2, Math.min(256, Math.round((options.quality / 100) * 240 + 16)));

    // interFrameMaxError (0 to 32): 0 is lossless, higher allows more compression across frames
    const interFrameMaxError = Math.max(0, Math.min(32, Math.round((100 - options.quality) * 0.32)));

    await sharp(inputFilePath, { animated: true })
      .gif({
        colours,
        effort: 7,
        interFrameMaxError,
        dither: 1.0,
      })
      .toFile(outputFilePath);
  } else {
    await sharp(inputFilePath)
      .webp({ quality: options.quality, effort: 6, smartSubsample: true })
      .toFile(outputFilePath);
  }

  return outputFilePath;
}

/**
 * Deep Module Seam: Processes a given path (can be a file or a directory).
 * If it's a directory, it processes all supported images inside it.
 * The converted files will be placed in an 'output' folder in the current working directory,
 * or alongside the input if specified.
 * 
 * @param inputPath The path to process
 * @param options Conversion options
 * @returns Object containing successful output paths and failed errors
 */
export async function processPath(
  inputPath: string,
  options: ConverterOptions
): Promise<{ success: string[], failed: { file: string, error: any }[] }> {
  
  const stats = await fs.stat(inputPath);
  const isDirectory = stats.isDirectory();
  
  // Create output directory 'output' in the current working directory
  const outputDir = path.join(process.cwd(), 'output');
  await fs.mkdir(outputDir, { recursive: true });

  const result = {
    success: [] as string[],
    failed: [] as { file: string, error: any }[]
  };

  if (isDirectory) {
    const files = await fs.readdir(inputPath);
    for (const file of files) {
      const filePath = path.join(inputPath, file);
      const fileStats = await fs.stat(filePath);
      
      if (fileStats.isFile() && isSupportedImage(file)) {
        try {
          const outPath = await convertImage(filePath, outputDir, options);
          if (outPath) {
            result.success.push(outPath);
          }
        } catch (error) {
          result.failed.push({ file: filePath, error });
        }
      }
    }
  } else {
    // It's a single file
    if (isSupportedImage(inputPath)) {
      try {
        const outPath = await convertImage(inputPath, outputDir, options);
        if (outPath) {
          result.success.push(outPath);
        }
      } catch (error) {
        result.failed.push({ file: inputPath, error });
      }
    } else {
       throw new Error(`File format not supported. Supported extensions: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`);
    }
  }

  return result;
}
