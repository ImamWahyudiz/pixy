import fs from 'fs/promises';
import path from 'path';

export type OutputMode = 'compress' | 'enhance' | 'ai';

export function getOutputDirectory(
  inputPath: string,
  inputIsDirectory: boolean,
  mode: OutputMode,
  customRoot?: string
): string {
  const root = customRoot || (inputIsDirectory ? inputPath : path.dirname(inputPath));
  return mode === 'ai'
    ? path.join(root, 'enhance', 'ai')
    : path.join(root, mode);
}

export async function getAvailableOutputPath(outputDir: string, filename: string): Promise<string> {
  const parsed = path.parse(filename);
  let candidate = path.join(outputDir, filename);
  let number = 1;

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(outputDir, `${parsed.name} (${number++})${parsed.ext}`);
    } catch {
      return candidate;
    }
  }
}
