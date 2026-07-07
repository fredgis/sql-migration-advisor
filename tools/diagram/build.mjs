#!/usr/bin/env node
// Renders docs/decision-tree.png from tools/diagram/decision-tree.html.
//
// The Azure / Fabric service icons are NOT committed (Microsoft's icon terms
// permit their use in architecture diagrams & docs, not redistribution) —
// this script downloads the official packs, extracts the handful of icons the
// diagram uses, then screenshots the page with headless Chrome at 2x.
//
// Usage: node tools/diagram/build.mjs
// Needs: curl, unzip, and Google Chrome (or set CHROME=/path/to/chrome).

import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const work = join(os.tmpdir(), 'sql-migration-advisor-diagram');
const iconsDir = join(here, 'icons');
const out = join(repo, 'docs', 'decision-tree.png');

const AZURE_ZIP = 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V22.zip';
const FABRIC_ZIP = 'https://github.com/microsoft/fabric-samples/raw/main/docs-samples/Icons.zip';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });

// 1. Fetch + extract the official icon packs (cached in $TMPDIR between runs).
mkdirSync(work, { recursive: true });
if (!existsSync(join(work, 'azure.zip'))) sh(`curl -sL -o "${join(work, 'azure.zip')}" "${AZURE_ZIP}"`);
if (!existsSync(join(work, 'fabric.zip'))) sh(`curl -sL -o "${join(work, 'fabric.zip')}" "${FABRIC_ZIP}"`);
sh(`unzip -q -o "${join(work, 'azure.zip')}" -d "${join(work, 'azure')}"`);
sh(`unzip -q -o "${join(work, 'fabric.zip')}" -d "${join(work, 'fabric')}"`);

// 2. Copy just the icons the diagram references.
const AZ = join(work, 'azure', 'Azure_Public_Service_Icons', 'Icons');
const FB = join(work, 'fabric', 'v6.1.0', 'package', 'dist', 'svg');
const icons = {
  'arc-sql-server.svg': [AZ, 'other', '01850-icon-service-Arc-SQL-Server.svg'],
  'avs.svg': [AZ, 'other', '01219-icon-service-Azure-VMware-Solution.svg'],
  'sql-vm.svg': [AZ, 'databases', '10124-icon-service-Azure-SQL-VM.svg'],
  'arc-sql-mi.svg': [AZ, 'other', '01849-icon-service-Arc-SQL-Managed-Instance.svg'],
  'aks.svg': [AZ, 'containers', '10023-icon-service-Kubernetes-Services.svg'],
  'aci.svg': [AZ, 'containers', '10104-icon-service-Container-Instances.svg'],
  'sql-mi.svg': [AZ, 'databases', '10136-icon-service-SQL-Managed-Instance.svg'],
  'sql-db.svg': [AZ, 'databases', '10130-icon-service-SQL-Database.svg'],
  'elastic-pool.svg': [AZ, 'databases', '10134-icon-service-SQL-Elastic-Pools.svg'],
  'azure-sql.svg': [AZ, 'databases', '02390-icon-service-Azure-SQL.svg'],
  'fabric.svg': [FB, 'fabric_48_color.svg'],
  'fabric-sql-db.svg': [FB, 'sql_database_64_item.svg'],
  'fabric-mirrored-db.svg': [FB, 'mirrored_generic_database_64_item.svg'],
};
rmSync(iconsDir, { recursive: true, force: true });
mkdirSync(iconsDir, { recursive: true });
for (const [name, parts] of Object.entries(icons)) copyFileSync(join(...parts), join(iconsDir, name));

// 3. Screenshot with headless Chrome at 2x device scale.
const chrome =
  process.env.CHROME ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'google-chrome');
sh(
  `"${chrome}" --headless=new --disable-gpu --no-sandbox --force-device-scale-factor=2 ` +
    `--window-size=1720,2330 --screenshot="${out}" "file://${join(here, 'decision-tree.html')}"`
);
console.log(`\nWrote ${out}`);
