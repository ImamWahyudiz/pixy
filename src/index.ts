#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import path from 'path';
import fs from 'fs';
import { processPath } from './converter';
import { processEnhancePath, EnhanceOptions } from './enhancer';
import { enhanceWithAi, AiOptions } from './ai-engine';
import { runInteractiveMode } from './interactive';

// If run with no arguments, launch interactive wizard mode
if (process.argv.slice(2).length === 0) {
  runInteractiveMode().catch((err) => {
    console.error(pc.red(`Error: ${err.message}`));
    process.exit(1);
  });
} else {
  const program = new Command();

  program
    .name('pixy')
    .description('Pixy - Modern Image Compression & Enhancement CLI')
    .argument('<inputPath>', 'Path to a single image file or a directory containing images.')
    .option('-q, --quality <number>', 'Quality of compression (1-100)', '80')
    .option('-c, --colors <number>', 'Number of palette colors for GIF compression (2-256)')
    .option('-e, --enhance', 'Enhance and upscale image quality (Non-AI, Lanczos3 + Sharpening)')
    .option('-s, --scale <number>', 'Scale factor for enhancement or AI (1, 2, or 4)', '2')
    .option('--ai', 'Use AI Super-Resolution (Real-ESRGAN on-demand)')
    .option('--model <name>', 'AI Model (realesr-animevideov3, realesrgan-x4plus-anime, realesrgan-x4plus)')
    .action(async (inputPath, options) => {
      const scale = parseInt(options.scale, 10) as 1 | 2 | 4;

      // 1. AI Super-Resolution Mode
      if (options.ai) {
        console.log(pc.cyan(`\n[AI] Processing with Real-ESRGAN Super-Resolution (${scale}x)...`));
        try {
          const outputDir = path.join(process.cwd(), 'output', 'ai');
          const stats = await fs.promises.stat(inputPath);
          const files: string[] = [];

          if (stats.isDirectory()) {
            const list = await fs.promises.readdir(inputPath);
            for (const f of list) {
              const ext = path.extname(f).toLowerCase();
              if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
                files.push(path.join(inputPath, f));
              }
            }
          } else {
            files.push(inputPath);
          }

          for (const file of files) {
            console.log(pc.blue(`Processing: ${file}`));
            const out = await enhanceWithAi(
              file,
              outputDir,
              { scale: (scale === 1 ? 2 : scale) as 2 | 4, model: options.model },
              (msg) => console.log(pc.dim(` > ${msg}`))
            );
            console.log(pc.green(` ✓ Saved: ${out}`));
          }
          console.log(pc.green(`\nAll done! Output saved in output/ai/`));
        } catch (err: any) {
          console.error(pc.red(`\nError: ${err.message}`));
          process.exit(1);
        }
        return;
      }

      // 2. Non-AI Enhance Mode
      if (options.enhance) {
        console.log(pc.cyan(`\n[Enhance] Upscaling and sharpening (${scale}x, Lanczos3, format preserved)...`));
        try {
          const enhanceOpts: EnhanceOptions = {
            scale,
            sharpen: 'normal',
            normalise: true,
            format: 'original'
          };
          const result = await processEnhancePath(inputPath, enhanceOpts, (file, idx, total) => {
            console.log(pc.dim(` [${idx}/${total}] Enhancing ${file}...`));
          });

          if (result.success.length > 0) {
            console.log(pc.green(`\nSuccessfully enhanced ${result.success.length} file(s):`));
            result.success.forEach(file => console.log(pc.green(` - ${file}`)));
          }
          if (result.failed.length > 0) {
            console.log(pc.red(`\nFailed to enhance ${result.failed.length} file(s):`));
            result.failed.forEach(failure => console.log(pc.red(` - ${failure.file} : ${failure.error.message}`)));
          }
        } catch (err: any) {
          console.error(pc.red(`\nError: ${err.message}`));
          process.exit(1);
        }
        return;
      }

      // 3. Normal Compression Mode
      const quality = parseInt(options.quality, 10);
      if (isNaN(quality) || quality < 1 || quality > 100) {
        console.error(pc.red('Error: Quality must be a number between 1 and 100.'));
        process.exit(1);
      }

      let colors: number | undefined;
      if (options.colors !== undefined) {
        colors = parseInt(options.colors, 10);
        if (isNaN(colors) || colors < 2 || colors > 256) {
          console.error(pc.red('Error: Colors must be a number between 2 and 256.'));
          process.exit(1);
        }
      }

      console.log(pc.blue(`Processing: ${inputPath} (Quality: ${quality}${colors ? `, Colors: ${colors}` : ''})`));

      try {
        const result = await processPath(inputPath, { quality, colors });

        if (result.success.length > 0) {
          console.log(pc.green(`\nSuccessfully converted ${result.success.length} file(s):`));
          result.success.forEach(file => console.log(pc.green(` - ${file}`)));
        }

        if (result.failed.length > 0) {
          console.log(pc.red(`\nFailed to convert ${result.failed.length} file(s):`));
          result.failed.forEach(failure => console.log(pc.red(` - ${failure.file} : ${failure.error.message}`)));
        }

        if (result.success.length === 0 && result.failed.length === 0) {
          console.log(pc.yellow('\nNo supported images found in the specified path.'));
        }
      } catch (error: any) {
        console.error(pc.red(`\nError: ${error.message}`));
        process.exit(1);
      }
    });

  program.parse(process.argv);
}
