import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile, execSync } from 'child_process';
import sharp from 'sharp';
import { getAvailableOutputPath } from './output';

export type AiPreset = 'text' | 'landscape' | 'anime';

export interface AiOptions {
  model?: 'realesrgan-x4plus' | 'realesrgan-x4plus-anime' | 'realesr-animevideov3';
  preset?: AiPreset;
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
 * Enhances a static image using Real-ESRGAN AI Super-Resolution with dedicated presets for text, landscape, and anime.
 * Note: GIF animation is not supported in AI mode (use Compress mode instead).
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

  if (ext === '.gif') {
    throw new Error('Animasi GIF tidak didukung untuk AI Super-Resolution. Gunakan mode Compress untuk mengoptimalkan GIF.');
  }

  const nameWithoutExt = path.parse(filename).name;
  const scale = options.scale ?? 2;

  // Determine model based on preset or explicit model choice
  let model: string = 'realesrgan-x4plus';
  let isTextPreset = false;

  if (options.preset === 'text') {
    model = 'realesrgan-x4plus';
    isTextPreset = true;
  } else if (options.preset === 'landscape') {
    model = 'realesrgan-x4plus';
  } else if (options.preset === 'anime') {
    model = 'realesrgan-x4plus-anime';
  } else if (options.model) {
    model = options.model;
  }

  await fsPromises.mkdir(outputDir, { recursive: true });
  const outputFilePath = await getAvailableOutputPath(outputDir, `${nameWithoutExt}_ai${ext}`);

  const presetLabel = options.preset === 'text' 
    ? 'Teks & Dokumen' 
    : options.preset === 'landscape' 
      ? 'Landscape & Foto' 
      : options.preset === 'anime'
        ? 'Anime 2D'
        : model;

  if (onProgress) onProgress(`Memproses AI Super-Resolution (${scale}x - Preset: ${presetLabel})...`);

  const tempOut = path.join(outputDir, `.${path.parse(outputFilePath).name}_temp_ai.png`);
  await runExecutable([
    '-i', path.resolve(inputFilePath),
    '-o', path.resolve(tempOut),
    '-n', model,
    '-s', scale.toString(),
    '-g', '0'
  ]);

  // Post-processing pipeline with optional text unsharp mask
  let pipeline = sharp(tempOut);
  if (isTextPreset) {
    // Apply subtle edge sharpening specifically tailored for crisp text rendering
    pipeline = pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 1.5 });
  }

  if (ext === '.png') {
    if (isTextPreset) {
      await pipeline.png({ compressionLevel: 8 }).toFile(outputFilePath);
      await fsPromises.unlink(tempOut);
    } else {
      await fsPromises.rename(tempOut, outputFilePath);
    }
  } else if (ext === '.webp') {
    await pipeline.webp({ quality: 90, effort: 6, smartSubsample: true }).toFile(outputFilePath);
    await fsPromises.unlink(tempOut);
  } else {
    // jpg / jpeg
    await pipeline.jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(outputFilePath);
    await fsPromises.unlink(tempOut);
  }

  return outputFilePath;
}
