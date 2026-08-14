// One definition of "this knowledge base actually changed", shared by the stage that decides and the
// stage that applies.
//
// The two used to compute it separately. The decision stage compared the branch against its merge
// base with origin/main; the apply stage compared the working tree against HEAD. On a normal
// checkout the working tree equals HEAD, so a branch carrying committed corrections was declared
// substantive by the first and refused by the second. They also disagreed on which files counted.
// Both now call the functions below, so the two answers cannot drift apart again.
import { execFileSync } from 'node:child_process';
import { ROOT, readFile, TARGETS, substantiveFiles } from './kb-targets.mjs';

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * The commit a weekly run is proposing changes against.
 *
 * On the automation branch this is the point it left main, so edits committed to the branch are
 * visible. On main itself it degrades to HEAD, where the only visible edits are uncommitted ones.
 */
export function baselineRef() {
  if (git(['rev-parse', '--verify', '--quiet', 'origin/main'])) {
    return git(['merge-base', 'HEAD', 'origin/main']) || 'origin/main';
  }
  return git(['rev-parse', '--verify', '--quiet', 'HEAD']) || null;
}

export function fileAt(ref, rel) {
  try {
    return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * Strip everything the automation itself writes: versions, freshness stamps and changelog rows.
 * Without this a housekeeping run would look like a content change and license the next version bump,
 * so the version number would climb on its own with nothing behind it.
 */
export function normalize(text) {
  const out = [];
  let inChangelog = false;
  for (const raw of String(text ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (/^#{1,6}\s+.*(?:change\s*log|changelog|version history)/i.test(line)) { inChangelog = true; continue; }
    if (inChangelog) {
      // Skip the changelog table itself and nothing more. Ending the skip at the next heading looked
      // equivalent, but the changelog is the last section of two of these documents, so everything
      // written after it would have been invisible to this comparison for good.
      if (line === '' || /^\|/.test(line)) continue;
      inChangelog = false;
    }
    if (/^\|\s*v\d+\.\d+\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/i.test(line)) continue;
    if (/\*\*Version[.:]\*\*\s*v\d+\.\d+/i.test(line)) continue;
    if (/Current version:\s*\*\*v\d+\.\d+\*\*/i.test(line)) continue;
    if (/current:\s*v\d+\.\d+/i.test(line)) continue;
    if (/\(sql-migration-advisor\),\s*\*\*v\d+\.\d+\*\*/i.test(line)) continue;
    if (/current as of\s+(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/i.test(line)) continue;
    if (/verified\s+(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/i.test(line)) continue;
    if (/verified:\s*(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/i.test(line)) continue;
    if (/\*\*Last verified[.:]\*\*\s*\d{4}-\d{2}-\d{2}/i.test(line)) continue;
    if (/"(?:knowledgeBaseVersion|version|latest|released)":\s*"[^"]*"/.test(line)) continue;
    out.push(line.replace(/\s+/g, ' '));
  }
  return out.join('\n').trim();
}

/** Did this knowledge base change in a way that is not just metadata? */
export function isSubstantive(target, base = baselineRef()) {
  if (!base) return false;
  for (const rel of substantiveFiles(target)) {
    const before = fileAt(base, rel);
    const after = readFile(rel, null);
    if (before === null || after === null) continue;
    if (normalize(before) !== normalize(after)) return true;
  }
  return false;
}

/** The ids of every knowledge base carrying a substantive change, evaluated against one baseline. */
export function substantiveTargets(targets = TARGETS) {
  const base = baselineRef();
  return targets.filter(t => isSubstantive(t, base)).map(t => t.id);
}
