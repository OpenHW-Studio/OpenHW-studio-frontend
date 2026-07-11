import crypto from 'crypto';
import path from 'path';

function sanitizeFileName(name: string): string {
  const base = path.basename(String(name || '').trim());
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureAllowedSourceExt(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return ['.ino', '.h', '.hpp', '.c', '.cpp'].includes(ext);
}

function stableSourceFiles(files: any[]): any[] {
  const list = Array.isArray(files) ? files : [];
  return list
    .filter((f) => f && typeof f.name === 'string' && typeof f.content === 'string')
    .map((f) => ({
      name: sanitizeFileName(f.name),
      content: f.content,
    }))
    .filter((f) => ensureAllowedSourceExt(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildCompileRequestHash({
  code,
  files,
  fqbn,
  builder,
  libraries_txt,
}: {
  code: string;
  files: any[];
  fqbn: string;
  builder?: string;
  libraries_txt?: string;
}): string {
  const payload = {
    code: typeof code === 'string' ? code : '',
    files: stableSourceFiles(files),
    fqbn: String(fqbn || '').trim() || 'arduino:avr:uno',
    builder: String(builder || '').trim() || 'arduino-cli',
    libraries_txt: String(libraries_txt || '').trim(),
  };
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
}
