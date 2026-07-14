#!/usr/bin/env node
// Renders the diagrams that illustrate the skill, from their HTML sources:
//   tools/diagram/poster.html -> docs/sql-migration-advisor-poster.png   (the full engine)
//   tools/diagram/radial.html -> images/sql-migration-advisor-radial.png (hub & spokes)
//   tools/diagram/hero.html   -> images/sql-migration-advisor-hero.png   (README banner)
//
// The Azure / Fabric service icons are NOT committed (Microsoft's icon terms
// permit their use in architecture diagrams & docs, not redistribution) — this
// script downloads the official packs, extracts just the icons the diagrams
// reference into tools/diagram/icons/, then screenshots each page with headless
// Chrome (or Edge) at 2x device scale.
//
// Usage: node tools/diagram/build.mjs
// Needs: curl, unzip, and a Chromium browser (set CHROME=/path/to/chrome to override).

import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const work = join(os.tmpdir(), 'sql-migration-advisor-diagram');
const iconsDir = join(here, 'icons');

const AZURE_ZIP = 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V23.zip';
const FABRIC_ZIP = 'https://github.com/microsoft/fabric-samples/raw/main/docs-samples/Icons.zip';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });

// 1. Fetch + extract the official icon packs (cached in $TMPDIR between runs).
mkdirSync(work, { recursive: true });
if (!existsSync(join(work, 'azure.zip'))) sh(`curl -sL -o "${join(work, 'azure.zip')}" "${AZURE_ZIP}"`);
if (!existsSync(join(work, 'fabric.zip'))) sh(`curl -sL -o "${join(work, 'fabric.zip')}" "${FABRIC_ZIP}"`);
sh(`unzip -q -o "${join(work, 'azure.zip')}" -d "${join(work, 'azure')}"`);
sh(`unzip -q -o "${join(work, 'fabric.zip')}" -d "${join(work, 'fabric')}"`);

// 2. Copy just the icons the diagrams reference, under the names the HTML expects.
//    Icon-pack folder layouts change between releases, so resolve each source
//    file by name recursively rather than hard-coding category subfolders.
const findByName = (root, name) => {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(p);
      else if (entry.name === name) return p;
    }
  }
  throw new Error(`icon not found: ${name} (under ${root})`);
};

const AZ = join(work, 'azure');
const FB = join(work, 'fabric');
// target name -> [pack root, original filename]
const icons = {
  'sql-server.svg': [AZ, '10132-icon-service-SQL-Server.svg'],
  'sql-vm.svg': [AZ, '10124-icon-service-Azure-SQL-VM.svg'],
  'sql-mi.svg': [AZ, '10136-icon-service-SQL-Managed-Instance.svg'],
  'sql-database.svg': [AZ, '10130-icon-service-SQL-Database.svg'],
  'sql-elastic-pools.svg': [AZ, '10134-icon-service-SQL-Elastic-Pools.svg'],
  'arc-sql-server.svg': [AZ, '01850-icon-service-Arc-SQL-Server.svg'],
  'arc-sql-mi.svg': [AZ, '01849-icon-service-Arc-SQL-Managed-Instance.svg'],
  'avs.svg': [AZ, '01219-icon-service-Azure-VMware-Solution.svg'],
  'containers.svg': [AZ, '10104-icon-service-Container-Instances.svg'],
  'azure-migrate.svg': [AZ, '10281-icon-service-Azure-Migrate.svg'],
  'data-box.svg': [AZ, '10094-icon-service-Data-Box.svg'],
  'fabric.svg': [FB, 'fabric_48_color.svg'],
  'fabric-sql-db.svg': [FB, 'sql_database_48_item.svg'],
  'fabric-mirror.svg': [FB, 'mirrored_generic_database_48_item.svg'],
  'copilot.svg': [FB, 'copilot_48_color.svg'],
};
rmSync(iconsDir, { recursive: true, force: true });
mkdirSync(iconsDir, { recursive: true });
for (const [name, [root, orig]] of Object.entries(icons)) copyFileSync(findByName(root, orig), join(iconsDir, name));

// 3. Screenshot each page with headless Chrome/Edge at 2x device scale.
const chrome =
  process.env.CHROME ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      : 'google-chrome');

const pages = [
  { html: 'poster.html', out: join(repo, 'docs', 'sql-migration-advisor-poster.png'), w: 1600, h: 3677 },
  { html: 'radial.html', out: join(repo, 'images', 'sql-migration-advisor-radial.png'), w: 1600, h: 1297 },
  { html: 'hero.html', out: join(repo, 'images', 'sql-migration-advisor-hero.png'), w: 1440, h: 810 },
];
for (const p of pages) {
  mkdirSync(dirname(p.out), { recursive: true });
  sh(
    `"${chrome}" --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files ` +
      `--force-device-scale-factor=2 --window-size=${p.w},${p.h} ` +
      `--screenshot="${p.out}" "file://${join(here, p.html)}"`
  );
  console.log(`Wrote ${p.out}`);
}
