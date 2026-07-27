import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (...p) => path.join(root, ...p);
const dataPath = rel('reference', 'decision-rules.data.json');
const markdownPath = rel('reference', 'decision-rules.md');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const markdown = fs.readFileSync(markdownPath, 'utf8');
const normalizedMarkdown = normalize(markdown);
const failures = [];
const warnings = [];
let checked = 0;
const strict = process.argv.includes('--strict');

function normalize(value) {
  return String(value)
    .replace(/[–—]/g, '-')
    .replace(/[→]/g, ' to ')
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[`*_()]/g, ' ')
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function esc(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function flex(value) { return esc(value).replace(/\\ /g, '\\s+').replace(/-/g, '[–-]'); }
function excluded(name) {
  return data.markdownAssertionExclusions?.[name];
}
function assertRegex(name, regex, message) {
  checked += 1;
  if (excluded(name)) return;
  if (!regex.test(markdown)) failures.push(`${name}: ${message}`);
}
function warnIfMissing(name, value) {
  checked += 1;
  if (excluded(name)) return;
  if (!normalizedMarkdown.includes(normalize(value))) warnings.push(`${name}: could not locate ${JSON.stringify(value)} in reference\\decision-rules.md`);
}
function warnIfMissingAny(name, values) {
  checked += 1;
  if (excluded(name)) return;
  if (!values.some(value => normalizedMarkdown.includes(normalize(value)))) warnings.push(`${name}: could not locate any of ${JSON.stringify(values)} in reference\\decision-rules.md`);
}

assertRegex('version', new RegExp(`\\*\\*${esc(data.version)}\\*\\*`), `expected markdown source version ${data.version}`);

const floors = data.sourceVersionFloors;
assertRegex('sourceVersionFloors.miLink.sqlServerMin', new RegExp(`MI Link[\\s\\S]*?SQL Server \\*\\*${floors.miLink.sqlServerMin}\\+\\*\\*`, 'u'), `expected MI Link SQL Server ${floors.miLink.sqlServerMin}+`);
assertRegex('sourceVersionFloors.standaloneLrs', new RegExp(`Standalone LRS[\\s\\S]*?SQL Server \\*\\*${floors.standaloneLrs.sqlServerMin}[–-]${floors.standaloneLrs.sqlServerMax}\\*\\*`, 'u'), `expected standalone LRS ${floors.standaloneLrs.sqlServerMin}-${floors.standaloneLrs.sqlServerMax}`);
assertRegex('sourceVersionFloors.nativeRestoreToMi.sqlServerMin', new RegExp(`Native backup/restore[\\s\\S]*?SQL Server ${floors.nativeRestoreToMi.sqlServerMin}\\+`, 'u'), `expected native restore SQL Server ${floors.nativeRestoreToMi.sqlServerMin}+`);
assertRegex('sourceVersionFloors.transactionalReplicationToSqlDb.publisherSqlServerMin', new RegExp(`publisher SQL Server \\*\\*${floors.transactionalReplicationToSqlDb.publisherSqlServerMin} and later\\*\\*`, 'u'), `expected transactional replication publisher floor ${floors.transactionalReplicationToSqlDb.publisherSqlServerMin}+`);

const arc = data.azureArcFloors;
assertRegex('azureArcFloors.overallMigrationExperience.sqlServerMin', new RegExp(`Arc-enabled SQL Server overall migration experience:[\\s\\S]*?SQL Server \\*\\*${arc.overallMigrationExperience.sqlServerMin}\\+\\*\\*`, 'u'), `expected Arc overall SQL Server ${arc.overallMigrationExperience.sqlServerMin}+`);
assertRegex('azureArcFloors.miLinkToManagedInstance', new RegExp(`Arc → Azure SQL MI via MI Link:[\\s\\S]*?SQL Server \\*\\*${arc.miLinkToManagedInstance.sqlServerMin}\\+\\*\\*[\\s\\S]*?Windows Server \\*\\*${arc.miLinkToManagedInstance.windowsServerMin}\\+\\*\\*`, 'u'), `expected Arc MI Link SQL/Windows floors ${arc.miLinkToManagedInstance.sqlServerMin}+/${arc.miLinkToManagedInstance.windowsServerMin}+`);
assertRegex('azureArcFloors.lrsToManagedInstanceConservative', new RegExp(`method-table floor of SQL Server \\*\\*${arc.lrsToManagedInstanceConservative.documentedMethodSqlServerMin}\\+\\*[\\s\\S]*?require Arc experience floor \\*\\*${arc.lrsToManagedInstanceConservative.sqlServerMin}\\+\\*\\*`, 'u'), `expected Arc LRS documented ${arc.lrsToManagedInstanceConservative.documentedMethodSqlServerMin}+ and conservative ${arc.lrsToManagedInstanceConservative.sqlServerMin}+ floors`);
assertRegex('azureArcFloors.sqlServerOnAzureVm.sqlServerMin', new RegExp(`Arc → SQL Server on Azure VM:[\\s\\S]*?SQL Server \\*\\*${arc.sqlServerOnAzureVm.sqlServerMin}\\+\\*\\*`, 'u'), `expected Arc SQL VM floor ${arc.sqlServerOnAzureVm.sqlServerMin}+`);

const ports = data.miLink.ports;
assertRegex('miLink.ports.sqlServerEndpoint', new RegExp(`Required ports are:[\\s\\S]*?\\*\\*${ports.sqlServerEndpoint}\\*\\*`, 'u'), `expected MI Link endpoint port ${ports.sqlServerEndpoint}`);
assertRegex('miLink.ports.managedInstanceHadrRange', new RegExp(`Required ports are:[\\s\\S]*?\\*\\*${ports.managedInstanceHadrRange.start}[–-]${ports.managedInstanceHadrRange.end}\\*\\*`, 'u'), `expected MI Link HADR range ${ports.managedInstanceHadrRange.start}-${ports.managedInstanceHadrRange.end}`);

const cap = data.miLink.capacityLinks;
assertRegex('miLink.capacityLinks.generalPurpose', new RegExp(`Up to \\*\\*${cap.generalPurpose} links\\*\\* on MI General Purpose`, 'u'), `expected MI Link GP capacity ${cap.generalPurpose}`);
assertRegex('miLink.capacityLinks.businessCritical', new RegExp(`Up to \\*\\*${cap.businessCritical} links\\*\\* on MI General Purpose and Business Critical`, 'u'), `expected MI Link BC capacity ${cap.businessCritical}`);
assertRegex('miLink.capacityLinks.nextGenGeneralPurpose', new RegExp(`up to \\*\\*${cap.nextGenGeneralPurpose} links\\*\\* on Next-gen General Purpose`, 'u'), `expected MI Link Next-gen GP capacity ${cap.nextGenGeneralPurpose}`);

const wizard = data.arcPortalWizard;
assertRegex('arcPortalWizard.batchLimitAtOrAboveExtension', new RegExp(`up to \\*\\*${wizard.batchLimitAtOrAboveExtension} databases\\*\\* per batch with Azure Extension for SQL Server \\*\\*${flex(wizard.extensionMinVersionForBatchLimit)}\\+\\*\\*`, 'u'), `expected Arc wizard ${wizard.batchLimitAtOrAboveExtension}-database batch at extension ${wizard.extensionMinVersionForBatchLimit}+`);
assertRegex('arcPortalWizard.batchLimitBeforeExtension', new RegExp(`earlier extension versions select ${wizard.batchLimitBeforeExtension === 1 ? 'one' : wizard.batchLimitBeforeExtension} database at a time`, 'u'), `expected Arc wizard pre-floor batch ${wizard.batchLimitBeforeExtension}`);

assertRegex('fabricMigration.maxDacpacMb', new RegExp(`DACPAC\\s*(?:<=|≤)\\s*${data.fabricMigration.maxDacpacMb}\\s*MB`, 'iu'), `expected Fabric DACPAC cap ${data.fabricMigration.maxDacpacMb} MB`);
assertRegex('sqlDatabaseTiers.hyperscaleSizeThresholdTb', new RegExp(`Database size\\s*>\\s*${data.sqlDatabaseTiers.hyperscaleSizeThresholdTb}\\s*TB`, 'iu'), `expected SQL DB Hyperscale threshold > ${data.sqlDatabaseTiers.hyperscaleSizeThresholdTb} TB`);
assertRegex('sqlDatabaseTiers.generalPurposeSmallDatabaseSignalGb', new RegExp(`<\\s*${data.sqlDatabaseTiers.generalPurposeSmallDatabaseSignalGb}\\s*GB`, 'iu'), `expected small database signal < ${data.sqlDatabaseTiers.generalPurposeSmallDatabaseSignalGb} GB`);

for (const [method, model] of Object.entries(data.methodAvailability)) {
  const availability = model.targetAvailabilityDuringSync;
  const cutovers = model.businessCutoverDowntimeByTier ? Object.values(model.businessCutoverDowntimeByTier) : [model.businessCutoverDowntime];
  warnIfMissing(`methodAvailability.${method}.targetAvailabilityDuringSync`, availability);
  for (const cutover of cutovers) {
    const aliases = {
      '<1min': ['< 1 minute', '<1min'],
      'full-restore-time': ['full restore time'],
      'full-load-time': ['full load time'],
      'total-migration-time': ['total migration execution time', 'total migration time']
    }[cutover] || [cutover];
    warnIfMissingAny(`methodAvailability.${method}.businessCutoverDowntime`, aliases);
  }
}

for (const [source, matrix] of Object.entries(data.crossCloudEligibility)) {
  warnIfMissing(`crossCloudEligibility.${source}`, source);
  for (const value of Object.values(matrix)) {
    const keyTerms = value.split(':')[0].replace('eligible', '✅').replace('unsupported', '❌').replace('indirect', '⚠️');
    const aliases = [
      value,
      keyTerms,
      value.replace(/S3 to Blob upload/gi, 'S3→Blob upload'),
      value.replace(/S3 to Blob to restore/gi, 'S3→Blob→restore'),
      value.replace(/export to Blob/gi, 'export→Blob')
    ];
    if (!aliases.some(alias => normalizedMarkdown.includes(normalize(alias)))) warnings.push(`crossCloudEligibility.${source}: could not locate ${JSON.stringify(value)}`);
    checked += 1;
  }
}

for (const [rule, states] of Object.entries(data.hardEligibilityRules)) {
  warnIfMissing(`hardEligibilityRules.${rule}`, rule);
  for (const value of Object.values(states)) warnIfMissing(`hardEligibilityRules.${rule}`, value);
}

for (const [tierFamily, tierRules] of Object.entries(data.tierSelection)) {
  for (const [name, values] of Object.entries(tierRules)) {
    if (Array.isArray(values)) for (const value of values) warnIfMissing(`tierSelection.${tierFamily}.${name}`, value);
    else warnIfMissing(`tierSelection.${tierFamily}.${name}`, values);
  }
}

for (const key of data.validatedEvidence.requiredBooleans) {
  checked += 1;
  const prose = {
    dependenciesToolConfirmed: 'tool-confirmed dependency inventory',
    performanceMeasured: 'measured performance and sizing data',
    regionAvailabilityConfirmed: 'confirmed target-region feature availability',
    architectSignedOff: 'explicit architect sign-off'
  }[key];
  const name = `validatedEvidence.${key}`;
  if (!excluded(name) && !normalizedMarkdown.includes(normalize(prose))) warnings.push(`${name}: could not locate ${JSON.stringify(prose)} in reference\\decision-rules.md`);
}

for (const tool of data.retiredTooling) {
  warnIfMissing(`retiredTooling.${tool.name}.name`, tool.name.replace('Azure DMS classic — SQL scenarios', 'Azure DMS *classic* — SQL scenarios'));
  warnIfMissing(`retiredTooling.${tool.name}.date`, tool.date);
  warnIfMissingAny(`retiredTooling.${tool.name}.useInstead`, [tool.useInstead, tool.useInstead.replace(/\s*\([^)]*\)/g, '')]);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
if (failures.length || (strict && warnings.length)) {
  console.error(`Rules data check failed: ${failures.length} failure(s), ${warnings.length} warning(s), ${checked} constants checked${strict ? ' (strict)' : ''}.`);
  process.exit(1);
}
console.log(`Rules data check passed: ${data.version}; ${checked} constants checked; ${warnings.length} warning(s)${strict ? '; strict mode.' : '.'}`);
