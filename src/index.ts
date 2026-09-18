#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { processPath } from './converter';

const program = new Command();

program
  .name('webpc')
  .description('A simple CLI to convert and compress images (WebP for static images, optimized GIF for GIFs).')
  .argument('<inputPath>', 'Path to a single image file or a directory containing images.')
  .option('-q, --quality <number>', 'Quality of compression (1-100)', '80')
  .option('-c, --colors <number>', 'Number of palette colors for GIF compression (2-256)')
  .action(async (inputPath, options) => {
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
