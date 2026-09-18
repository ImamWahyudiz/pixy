import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execFile, execSync } from 'child_process';
import sharp from 'sharp';

export interface AiOptions {
  model?: 'realesr-animevideov3' | 'realesrgan-x4plus-anime' | 'realesrgan-x4plus';
  scale?: 2 | 3 | 4;
}

const MODELS_DIR = path.join(process.cwd(), '.models');
const EXECUTABLE_PATH = path.join(MODELS_DIR, 'realesrgan-ncnn-vulkan.exe');
const DOWNLOAD_URL = 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip';

export function isAiEngineInstalled(): boolean {
  return fs.existsSync(EXECUTABLE_PATH);
}

export function getAiModelStatus(): { installed: boolean; path: string; sizeMb?: number } {
  if (!isAiEngineInstalled()) {
    return { installed: false, path: MODELS_DIR };
  }
  let totalBytes = 0;
  function calculateSize(dir: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        calculateSize(full);
      } else {
        totalBytes += stat.size;
      }
    }
  }
  calculateSize(MODELS_DIR);
  return {
    installed: true,
    path: MODELS_DIR,
    sizeMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10
  };
}

export async function cleanAiModels(): Promise<void> {
  if (fs.existsSync(MODELS_DIR)) {
    await fsPromises.rm(MODELS_DIR, { recursive: true, force: true });
  }
}

/**
 * Downloads and extracts the Real-ESRGAN NCNN Vulkan binary on-demand.
 */
export async function downloadAiEngine(
  onProgress?: (status: string) => void
): Promise<void> {
  if (isAiEngineInstalled()) {
    return;
  }

  await fsPromises.mkdir(MODELS_DIR, { recursive: true });
  const zipPath = path.join(MODELS_DIR, 'realesrgan.zip');

  if (onProgress) onProgress('Mengunduh Real-ESRGAN engine (~24 MB)...');

  // Use powershell to download following redirects and extract
  const downloadScript = `
    $ProgressPreference = 'SilentlyContinue';
    Invoke-WebRequest -Uri "${DOWNLOAD_URL}" -OutFile "${zipPath}";
  `;
  execSync(`powershell -NoProfile -Command "${downloadScript.replace(/\n/g, ' ')}"`);

  if (onProgress) onProgress('Mengekstrak binary & model AI...');
  const extractScript = `
    $ProgressPreference = 'SilentlyContinue';
    Expand-Archive -Path "${zipPath}" -DestinationPath "${MODELS_DIR}" -Force;
    # Move files up if extracted into a subfolder
    $subDir = Get-ChildItem -Path "${MODELS_DIR}" -Directory | Where-Object { Test-Path (Join-Path $_.FullName "realesrgan-ncnn-vulkan.exe") } | Select-Object -First 1;
    if ($subDir) {
      Get-ChildItem -Path $subDir.FullName | Move-Item -Destination "${MODELS_DIR}" -Force;
      Remove-Item -Path $subDir.FullName -Recurse -Force;
    }
    Remove-Item -Path "${zipPath}" -Force -ErrorAction SilentlyContinue;
  `;
  execSync(`powershell -NoProfile -Command "${extractScript.replace(/\n/g, ' ')}"`);

  if (!isAiEngineInstalled()) {
    throw new Error('Gagal menginstal Real-ESRGAN engine. Executable tidak ditemukan setelah ekstraksi.');
  }
}

/**
 * Runs Real-ESRGAN command line asynchronously.
 */
function runExecutable(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(EXECUTABLE_PATH, args, { cwd: MODELS_DIR }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`Real-ESRGAN Error: ${error.message}\n${stderr}`));
      }
      resolve();
    });
  });
}

/**
 * Enhances a single image or animated GIF using Real-ESRGAN AI Super-Resolution.
 */
export async function enhanceWithAi(
  inputFilePath: string,
  outputDir: string,
  options: AiOptions = {},
  onProgress?: (status: string) => void
): Promise<string> {
  if (!isAiEngineInstalled()) {
    await downloadAiEngine(onProgress);
  }

  const filename = path.basename(inputFilePath);
  const ext = path.extname(filename).toLowerCase();
  const isGif = ext === '.gif';
  const nameWithoutExt = path.parse(filename).name;
  const scale = options.scale ?? (isGif ? 2 : 4);
  const model = options.model ?? (isGif ? 'realesr-animevideov3' : 'realesrgan-x4plus-anime');

  await fsPromises.mkdir(outputDir, { recursive: true });
  const outputFilePath = path.join(outputDir, `${nameWithoutExt}_ai${ext}`);

  if (!isGif) {
    // Process static image directly
    if (onProgress) onProgress(`Memproses AI Super-Resolution (${scale}x - ${model})...`);
    
    // Use temp png for inference if needed, or direct
    const tempOut = path.join(outputDir, `${nameWithoutExt}_temp_ai.png`);
    await runExecutable([
      '-i', path.resolve(inputFilePath),
      '-o', path.resolve(tempOut),
      '-n', model,
      '-s', scale.toString(),
    ]);

    // Convert temp output back to original format if not png
    if (ext === '.png') {
      if (fs.existsSync(outputFilePath)) await fsPromises.unlink(outputFilePath);
      await fsPromises.rename(tempOut, outputFilePath);
    } else if (ext === '.webp') {
      await sharp(tempOut).webp({ quality: 90 }).toFile(outputFilePath);
      await fsPromises.unlink(tempOut);
    } else {
      // jpg / jpeg
      await sharp(tempOut).jpeg({ quality: 92, mozjpeg: true }).toFile(outputFilePath);
      await fsPromises.unlink(tempOut);
    }

    return outputFilePath;
  }

  // --- Animated GIF Handling ---
  if (onProgress) onProgress('Mengekstrak frame-frame animasi GIF...');
  const tempFramesIn = path.join(MODELS_DIR, `temp_in_${Date.now()}`);
  const tempFramesOut = path.join(MODELS_DIR, `temp_out_${Date.now()}`);
  await fsPromises.mkdir(tempFramesIn, { recursive: true });
  await fsPromises.mkdir(tempFramesOut, { recursive: true });

  try {
    const meta = await sharp(inputFilePath, { animated: true }).metadata();
    const pageCount = meta.pages || 1;
    const pageHeight = meta.pageHeight || meta.height || 100;
    const width = meta.width || 100;

    // Extract all frames as individual PNG files
    for (let page = 0; page < pageCount; page++) {
      const framePath = path.join(tempFramesIn, `frame_${String(page).padStart(5, '0')}.png`);
      await sharp(inputFilePath, { page })
        .png()
        .toFile(framePath);
    }

    if (onProgress) onProgress(`Memproses ${pageCount} frame animasi dengan AI (${model})...`);
    await runExecutable([
      '-i', path.resolve(tempFramesIn),
      '-o', path.resolve(tempFramesOut),
      '-n', model,
      '-s', scale.toString(),
    ]);

    if (onProgress) onProgress('Menyusun kembali frame animasi GIF...');
    // Read all processed frames
    const processedFrameFiles = (await fsPromises.readdir(tempFramesOut))
      .filter(f => f.endsWith('.png'))
      .sort();

    const compositeInputs = [];
    const newWidth = width * scale;
    const newPageHeight = pageHeight * scale;
    const totalHeight = newPageHeight * processedFrameFiles.length;

    for (let i = 0; i < processedFrameFiles.length; i++) {
      compositeInputs.push({
        input: path.join(tempFramesOut, processedFrameFiles[i]),
        top: i * newPageHeight,
        left: 0,
      });
    }

    // Combine all frames vertically and encode as animated GIF
    const joinedBuffer = await sharp({
      create: {
        width: newWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite(compositeInputs)
    .raw()
    .toBuffer();

    await sharp(joinedBuffer, {
      raw: {
        width: newWidth,
        height: totalHeight,
        channels: 4,
        pageHeight: newPageHeight,
      }
    })
    .gif({
      colours: 256,
      effort: 7,
      dither: 1.0,
    })
    .toFile(outputFilePath);

    return outputFilePath;
  } finally {
    // Clean up temporary frame directories
    await fsPromises.rm(tempFramesIn, { recursive: true, force: true });
    await fsPromises.rm(tempFramesOut, { recursive: true, force: true });
  }
}
