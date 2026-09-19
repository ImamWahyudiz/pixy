import * as p from '@clack/prompts';
import pc from 'picocolors';
import path from 'path';
import fs from 'fs';
import { processPath } from './converter';
import { processEnhancePath, EnhanceOptions } from './enhancer';
import { getOutputDirectory } from './output';
import {
  enhanceWithAi,
  getAiModelStatus,
  cleanAiModels,
  isAiEngineInstalled,
  downloadAiEngine
} from './ai-engine';

/**
 * Sanitizes input path (removes quotes from Windows drag-and-drop)
 */
function cleanPath(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

async function chooseOutputRoot(): Promise<string | undefined> {
  const destination = await p.select({
    message: 'Pilih lokasi penyimpanan hasil:',
    options: [
      { value: 'source', label: 'Folder sumber (Rekomendasi)' },
      { value: 'custom', label: 'Folder lain...' }
    ]
  });
  if (p.isCancel(destination) || destination === 'source') return undefined;

  const customPath = await p.text({
    message: 'Masukkan atau drag & drop folder tujuan:',
    validate: (value) => !value?.trim() ? 'Path folder tidak boleh kosong!' : undefined
  });
  return p.isCancel(customPath) ? undefined : cleanPath(customPath);
}

export async function runInteractiveMode(): Promise<void> {
  console.clear();
  p.intro(`${pc.bgCyan(pc.black(' PIXY '))} ${pc.bold('Modern Image Compression & Enhancement Tool')}`);

  while (true) {
    const action = await p.select({
      message: 'Pilih aksi yang ingin dilakukan:',
      options: [
        { value: 'compress', label: 'Compress Images', hint: 'WebP atau format asli untuk gambar statis, kompresi GIF untuk animasi' },
        { value: 'enhance', label: 'Enhance & Upscale (Non-AI)', hint: 'Lanczos3 + Sharpen (Khusus gambar statis: JPG, PNG, WebP)' },
        { value: 'ai', label: 'AI Super-Resolution', hint: 'Preset Teks & Landscape (Khusus gambar statis)' },
        { value: 'models', label: 'Pengaturan & Cache Model AI', hint: 'Cek status atau bersihkan model AI di .models/' },
        { value: 'exit', label: 'Keluar' }
      ]
    });

    if (p.isCancel(action) || action === 'exit') {
      p.outro(pc.yellow('Sampai jumpa!'));
      process.exit(0);
    }

    // --- MENU: MANAGE AI MODELS ---
    if (action === 'models') {
      const status = getAiModelStatus();
      if (status.installed) {
        p.note(
          `Lokasi: ${status.path}\nUkuran Cache: ${status.sizeMb} MB\nStatus: Terpasang & Siap Digunakan`,
          'Status Model AI'
        );
        const shouldClean = await p.confirm({
          message: 'Apakah Anda ingin menghapus folder cache model AI (.models/)?',
          initialValue: false
        });
        if (!p.isCancel(shouldClean) && shouldClean) {
          const s = p.spinner();
          s.start('Membersihkan folder .models/...');
          await cleanAiModels();
          s.stop('Cache model AI berhasil dibersihkan!');
        }
      } else {
        p.note(
          'Engine Real-ESRGAN belum diunduh.\nEngine akan otomatis diunduh saat Anda menjalankan fitur AI Super-Resolution.',
          'Status Model AI'
        );
        const shouldDownload = await p.confirm({
          message: 'Ingin mengunduh engine Real-ESRGAN sekarang (~24 MB)?',
          initialValue: false
        });
        if (!p.isCancel(shouldDownload) && shouldDownload) {
          const s = p.spinner();
          s.start('Mengunduh dan mengekstrak Real-ESRGAN...');
          try {
            await downloadAiEngine((msg) => { s.message(msg); });
            s.stop('Real-ESRGAN berhasil dipasang di folder .models/!');
          } catch (err: any) {
            s.stop(pc.red('Gagal mengunduh: ' + err.message));
          }
        }
      }
      continue;
    }

    // --- GET INPUT PATH ---
    const inputPathRaw = await p.text({
      message: 'Masukkan path file atau folder (bisa drag & drop dari file explorer):',
      placeholder: 'Contoh: test/input atau drag file ke sini',
      validate: (val) => {
        if (!val || !val.trim()) return 'Path tidak boleh kosong!';
        const cleaned = cleanPath(val);
        if (!fs.existsSync(cleaned)) return `File atau folder tidak ditemukan: ${cleaned}`;
      }
    });

    if (p.isCancel(inputPathRaw)) continue;
    const inputPath = cleanPath(inputPathRaw);
    const outputRoot = await chooseOutputRoot();

    // --- ACTION: COMPRESS ---
    if (action === 'compress') {
      const qualityChoice = await p.select({
        message: 'Pilih kualitas kompresi:',
        options: [
          { value: '80', label: '80 (Rekomendasi - Seimbang)', hint: 'Ukuran hemat dengan visual tetap tajam' },
          { value: '60', label: '60 (Kompresi Tinggi)', hint: 'Ukuran file jauh lebih kecil' },
          { value: '95', label: '95 (Maksimal / Near-Lossless)', hint: 'Kualitas tertinggi' },
          { value: 'custom', label: 'Kustom...', hint: 'Tentukan angka 1 - 100 manual' }
        ]
      });

      if (p.isCancel(qualityChoice)) continue;
      let quality = parseInt(qualityChoice as string, 10);

      if (qualityChoice === 'custom') {
        const customQ = await p.text({
          message: 'Masukkan angka kualitas (1 - 100):',
          defaultValue: '80',
          validate: (v) => {
            if (!v) return 'Harus diisi!';
            const num = parseInt(v, 10);
            if (isNaN(num) || num < 1 || num > 100) return 'Harus angka antara 1 dan 100!';
          }
        });
        if (p.isCancel(customQ)) continue;
        quality = parseInt(customQ, 10);
      }

      const formatChoice = await p.select({
        message: 'Pilih format hasil:',
        options: [
          { value: 'webp', label: 'WebP (Rekomendasi)', hint: 'Ukuran file paling efisien' },
          { value: 'original', label: 'Format asli', hint: 'JPG, PNG, atau WebP tetap memakai format semula' }
        ]
      });
      if (p.isCancel(formatChoice)) continue;

      const s = p.spinner();
      s.start('Memproses kompresi gambar...');

      try {
        const res = await processPath(inputPath, { quality, format: formatChoice as 'webp' | 'original' }, outputRoot);
        s.stop(`Selesai! Berhasil mengompres ${res.success.length} file.`);

        if (res.success.length > 0) {
          p.log.success(pc.green(`File tersimpan di ${pc.bold(path.dirname(res.success[0]))}`));
          res.success.slice(0, 5).forEach(f => p.log.info(` - ${path.basename(f)}`));
          if (res.success.length > 5) p.log.info(` ... dan ${res.success.length - 5} file lainnya`);
        }
        if (res.failed.length > 0) {
          p.log.error(pc.red(`Gagal memproses ${res.failed.length} file:`));
          res.failed.forEach(fail => p.log.error(` - ${fail.file}: ${fail.error.message}`));
        }
      } catch (err: any) {
        s.stop(pc.red('Gagal: ' + err.message));
      }
      continue;
    }

    // --- ACTION: ENHANCE (NON-AI) ---
    if (action === 'enhance') {
      if (path.extname(inputPath).toLowerCase() === '.gif') {
        p.log.warn(pc.yellow('Animasi GIF tidak didukung untuk Enhance. Gunakan menu Compress untuk mengoptimalkan GIF.'));
        continue;
      }
      const preset = await p.select({
        message: 'Pilih preset peningkatan kualitas:',
        options: [
          { value: 'balanced', label: 'Balanced (2x Upscale + Normal Sharpen)', hint: 'Paling ideal untuk foto & animasi' },
          { value: 'max', label: 'Max Detail (4x Upscale + Strong Sharpen)', hint: 'Resolusi tinggi maksimal' },
          { value: 'subtle', label: 'Subtle Enhance (1x / Resolusi Tetap + Sharpen)', hint: 'Menajamkan tanpa ubah ukuran' },
          { value: 'custom', label: 'Kustom Parameter...' }
        ]
      });

      if (p.isCancel(preset)) continue;

      let enhanceOptions: EnhanceOptions = {
        format: 'original',
        normalise: true
      };

      if (preset === 'balanced') {
        enhanceOptions.scale = 2;
        enhanceOptions.sharpen = 'normal';
      } else if (preset === 'max') {
        enhanceOptions.scale = 4;
        enhanceOptions.sharpen = 'strong';
      } else if (preset === 'subtle') {
        enhanceOptions.scale = 1;
        enhanceOptions.sharpen = 'normal';
      } else {
        // Custom
        const scaleChoice = await p.select({
          message: 'Pilih skala pembesaran (Scale Factor):',
          options: [
            { value: '1', label: '1x (Ukuran Asli)' },
            { value: '2', label: '2x' },
            { value: '4', label: '4x' }
          ]
        });
        if (p.isCancel(scaleChoice)) continue;
        enhanceOptions.scale = parseInt(scaleChoice as string, 10) as 1 | 2 | 4;

        const sharpenChoice = await p.select({
          message: 'Tingkat ketajaman (Sharpening):',
          options: [
            { value: 'normal', label: 'Normal (Rekomendasi)' },
            { value: 'strong', label: 'Kuat (Strong)' },
            { value: 'none', label: 'Tanpa Sharpening' }
          ]
        });
        if (p.isCancel(sharpenChoice)) continue;
        enhanceOptions.sharpen = sharpenChoice as 'none' | 'normal' | 'strong';
      }

      const s = p.spinner();
      s.start('Meningkatkan kualitas gambar (Lanczos3 + Sharpen)...');

      try {
        const res = await processEnhancePath(inputPath, enhanceOptions, (file, idx, total) => {
          s.message(`[${idx}/${total}] Memproses: ${file}...`);
        }, outputRoot);

        s.stop(`Selesai! Berhasil meningkatkan kualitas ${res.success.length} file.`);

        if (res.success.length > 0) {
          p.log.success(pc.green(`File tersimpan di ${pc.bold(path.dirname(res.success[0]))}`));
          res.success.slice(0, 5).forEach(f => p.log.info(` - ${path.basename(f)}`));
          if (res.success.length > 5) p.log.info(` ... dan ${res.success.length - 5} file lainnya`);
        }
        if (res.failed.length > 0) {
          p.log.error(pc.red(`Gagal memproses ${res.failed.length} file:`));
          res.failed.forEach(fail => p.log.error(` - ${fail.file}: ${fail.error.message}`));
        }
      } catch (err: any) {
        s.stop(pc.red('Gagal: ' + err.message));
      }
      continue;
    }

    // --- ACTION: AI SUPER-RESOLUTION ---
    if (action === 'ai') {
      if (path.extname(inputPath).toLowerCase() === '.gif') {
        p.log.warn(pc.yellow('Animasi GIF tidak didukung untuk AI Super-Resolution. Gunakan menu Compress untuk mengoptimalkan GIF.'));
        continue;
      }

      const presetChoice = await p.select({
        message: 'Pilih jenis gambar untuk AI Super-Resolution:',
        options: [
          { 
            value: 'text', 
            label: 'Teks, Screenshot, UI & Dokumen',
            hint: 'realesrgan-x4plus + text sharpening (tulisan tajam & tidak meleleh)' 
          },
          { 
            value: 'landscape', 
            label: 'Landscape, Foto Alam & Pemandangan',
            hint: 'realesrgan-x4plus (tekstur realistis pohon, langit, & objek nyata)' 
          },
          { 
            value: 'anime', 
            label: 'Gambar Anime & Ilustrasi 2D',
            hint: 'realesrgan-x4plus-anime (garis line-art tebal & tegas)' 
          }
        ]
      });

      if (p.isCancel(presetChoice)) continue;

      const scaleChoice = await p.select({
        message: 'Pilih skala perbesaran AI:',
        options: [
          { value: '2', label: '2x Upscale' },
          { value: '4', label: '4x Upscale' }
        ]
      });

      if (p.isCancel(scaleChoice)) continue;
      const scale = parseInt(scaleChoice as string, 10) as 2 | 4;

      const s = p.spinner();
      s.start('Mempersiapkan AI Super-Resolution...');

      try {
        const stats = await fs.promises.stat(inputPath);
        const outputDir = getOutputDirectory(inputPath, stats.isDirectory(), 'ai', outputRoot);
        const filesToProcess: string[] = [];

        if (stats.isDirectory()) {
          const files = await fs.promises.readdir(inputPath);
          for (const f of files) {
            const ext = path.extname(f).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
              filesToProcess.push(path.join(inputPath, f));
            }
          }
        } else {
          filesToProcess.push(inputPath);
        }

        if (filesToProcess.length === 0) {
          p.log.warn(pc.yellow('Tidak ada gambar statis (.jpg, .png, .webp) yang ditemukan untuk diproses AI. (GIF diabaikan)'));
          continue;
        }

        const success: string[] = [];
        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          s.message(`[${i + 1}/${filesToProcess.length}] Memproses AI: ${path.basename(file)}...`);

          const outPath = await enhanceWithAi(
            file,
            outputDir,
            { preset: presetChoice as any, scale },
            (statusMsg) => { s.message(statusMsg); }
          );
          success.push(outPath);
        }

        s.stop(`Selesai! Berhasil memproses ${success.length} file dengan AI.`);
        p.log.success(pc.green(`File tersimpan di ${pc.bold(outputDir)}`));
        success.forEach(f => p.log.info(` - ${path.basename(f)}`));
      } catch (err: any) {
        s.stop(pc.red('Gagal: ' + err.message));
      }
      continue;
    }
  }
}
