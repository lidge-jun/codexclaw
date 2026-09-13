/** Explicit local font bindings; never downloads, installs, copies or publishes fonts. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const text = v => typeof v === 'string' && v.trim().length > 0;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const formats = new Map([['wOF2','woff2'],['wOFF','woff'],['OTTO','opentype'],['true','truetype']]);

/** Validate a user-authored manifest. In-memory faces contain bytes: never log them. */
export function loadFontManifest(manifestPath, { seal = false } = {}) {
  const bytes = readFileSync(manifestPath), input = JSON.parse(bytes.toString('utf8'));
  if (!object(input) || input.schemaVersion !== 1 || !Array.isArray(input.fonts) || !input.fonts.length)
    throw new Error('font manifest requires schemaVersion:1 and a nonempty fonts array');
  const seen = new Set();
  const fonts = input.fonts.map(font => {
    if (!object(font) || !['family','path','source','license','version','postscriptName'].every(k=>text(font[k])) ||
        !Number.isInteger(font.weight) || font.weight < 100 || font.weight > 900 || !['normal','italic'].includes(font.style ?? 'normal'))
      throw new Error('font requires family, path, source, license, version, postscriptName, weight (100..900), and valid style');
    const key = JSON.stringify([font.family,font.weight,font.style ?? 'normal']);
    if (seen.has(key)) throw new Error('duplicate font face: '+font.family+'/'+font.weight);
    seen.add(key);
    const file = resolve(dirname(manifestPath),font.path), content = readFileSync(file);
    const format = content.length >= 4 && (content.readUInt32BE(0) === 0x00010000 ? 'truetype' : formats.get(content.subarray(0,4).toString()));
    if (!format) throw new Error('unsupported font signature: '+font.path);
    const hash = sha256(content);
    if (!seal && (!/^[a-f0-9]{64}$/i.test(font.sha256 ?? '') || font.sha256.toLowerCase() !== hash))
      throw new Error('font hash mismatch or missing: '+font.family+'/'+font.weight);
    return {...font,path:file,style:font.style ?? 'normal',sha256:hash,format,
      dataUrl:'data:font/'+format+';base64,'+content.toString('base64')};
  });
  const roles = input.roles ?? {};
  if (!object(roles) || Object.entries(roles).some(([key,value])=>!['body','heading'].includes(key)||!fonts.some(f=>f.family===value)))
    throw new Error('font roles must select declared body/heading families');
  const faces = fonts.map(({family,weight,style,dataUrl})=>({family,weight,style,dataUrl}));
  const metadata = fonts.map(({family,weight,style,sha256,version,source,license,postscriptName})=>
    ({family,weight,style,sha256,version,source,license,postscriptName}));
  return {manifestSha256:sha256(bytes),fonts,faces,metadata,roles};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error('usage: node report-fonts.mjs <local-spec.json> <manifest.json>');
    const manifest = loadFontManifest(resolve(process.argv[2]),{seal:true});
    const output = {schemaVersion:1,roles:manifest.roles,fonts:manifest.fonts.map(({dataUrl,format,...font})=>font)};
    writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
    console.log('sealed '+output.fonts.length+' local faces; no binaries copied');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
