// Validate tests/golden-scenarios.json against tests/golden-scenarios.schema.json.
//
// The repository keeps its test path dependency-free on purpose, so this implements the
// subset of JSON Schema the file actually uses rather than pulling in a validator:
// $ref to local $defs, type, required, additionalProperties, properties, enum, pattern,
// minLength, minItems and items. Anything outside that subset is ignored rather than
// silently treated as a pass, so extending the schema means extending this too.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCHEMA = path.join(ROOT, 'tests', 'golden-scenarios.schema.json');
const DATA = path.join(ROOT, 'tests', 'golden-scenarios.json');

const SUPPORTED = new Set([
  '$schema', '$id', 'title', 'description', '$defs', '$ref',
  'type', 'required', 'additionalProperties', 'properties',
  'enum', 'pattern', 'minLength', 'minItems', 'items',
  'const', 'maxItems', 'uniqueItems', 'contains', 'minContains', 'maxContains',
  'allOf', 'anyOf', 'not', 'if', 'then', 'else', 'minimum', 'format', '$comment'
]);

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

export function validateGoldenScenarios(schemaPath = SCHEMA, dataPath = DATA) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const errors = [];
  const unsupported = new Set();

  const resolve = (node) => {
    if (!node || !node.$ref) return node;
    const ref = node.$ref;
    if (!ref.startsWith('#/$defs/')) {
      errors.push(`schema: only local $defs references are supported, got ${ref}`);
      return {};
    }
    const target = schema.$defs?.[ref.slice('#/$defs/'.length)];
    if (!target) errors.push(`schema: unresolved reference ${ref}`);
    return target || {};
  };

  const check = (node, value, at) => {
    const s = resolve(node);
    for (const keyword of Object.keys(s)) if (!SUPPORTED.has(keyword)) unsupported.add(keyword);

    if (s.type) {
      const allowed = Array.isArray(s.type) ? s.type : [s.type];
      const actual = typeOf(value);
      // JSON has one number type; an integer is a number with no fractional part.
      const ok = allowed.some(t => t === actual || (t === 'integer' && actual === 'number' && Number.isInteger(value)));
      if (!ok) {
        errors.push(`${at}: expected ${allowed.join(' or ')}, got ${actual}`);
        return;
      }
    }

    if (s.enum && !s.enum.includes(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(s.enum)}`);
    }
    if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(value)) {
      errors.push(`${at}: expected the constant ${JSON.stringify(s.const)}, got ${JSON.stringify(value)}`);
    }
    if (s.pattern && typeof value === 'string' && !new RegExp(s.pattern, 'u').test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} does not match ${s.pattern}`);
    }
    if (s.minLength != null && typeof value === 'string' && value.length < s.minLength) {
      errors.push(`${at}: shorter than ${s.minLength} characters`);
    }
    if (s.minimum != null && typeof value === 'number' && value < s.minimum) {
      errors.push(`${at}: below the minimum of ${s.minimum}`);
    }
    if (s.format === 'uri' && typeof value === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      errors.push(`${at}: ${JSON.stringify(value)} is not a URI`);
    }

    if (typeOf(value) === 'array') {
      if (s.minItems != null && value.length < s.minItems) {
        errors.push(`${at}: has ${value.length} item(s), needs at least ${s.minItems}`);
      }
      if (s.maxItems != null && value.length > s.maxItems) {
        errors.push(`${at}: has ${value.length} item(s), at most ${s.maxItems} allowed`);
      }
      if (s.uniqueItems) {
        const seen = new Set();
        for (const item of value) {
          const key = JSON.stringify(item);
          if (seen.has(key)) { errors.push(`${at}: repeated item ${key}`); break; }
          seen.add(key);
        }
      }
      // uniqueItems compares whole entries, so on its own it lets one family appear twice under two
      // reasons while another is missing. contains with minContains/maxContains is what expresses
      // "each of these exactly once", and it went unenforced until this validator learned it.
      if (s.contains) {
        const matches = value.filter((item) => probe(s.contains, item).length === 0).length;
        const min = s.minContains == null ? 1 : s.minContains;
        if (matches < min) errors.push(`${at}: ${matches} item(s) match contains, needs at least ${min}`);
        if (s.maxContains != null && matches > s.maxContains) {
          errors.push(`${at}: ${matches} item(s) match contains, at most ${s.maxContains} allowed`);
        }
      }
      if (s.items) value.forEach((item, i) => check(s.items, item, `${at}[${i}]`));
    }

    if (typeOf(value) === 'object') {
      for (const key of s.required || []) {
        if (!(key in value)) errors.push(`${at}: missing required property "${key}"`);
      }
      if (s.additionalProperties === false && s.properties) {
        for (const key of Object.keys(value)) {
          if (!(key in s.properties)) errors.push(`${at}: unexpected property "${key}"`);
        }
      }
      for (const [key, sub] of Object.entries(s.properties || {})) {
        if (key in value) check(sub, value[key], `${at}.${key}`);
      }
    }

    // Applicators last: they compose the checks above rather than replacing them.
    for (const branch of s.allOf || []) check(branch, value, at);
    if (s.anyOf) {
      const outcomes = s.anyOf.map((branch) => probe(branch, value));
      if (!outcomes.some((o) => o.length === 0)) {
        errors.push(`${at}: matches none of the ${s.anyOf.length} accepted shapes (${outcomes.map((o) => o[0]).join(' | ')})`);
      }
    }
    if (s.not && probe(s.not, value).length === 0) {
      errors.push(`${at}: matches a shape the schema forbids`);
    }
    if (s.if) {
      const taken = probe(s.if, value).length === 0 ? s.then : s.else;
      if (taken) check(taken, value, at);
    }
  };

  // Run a subschema without recording its result: applicators such as anyOf, not and if need to
  // know whether a branch matches, and a failed probe is a decision rather than an error.
  const probe = (node, value) => {
    const mark = errors.length;
    check(node, value, '');
    return errors.splice(mark);
  };

  // Name each scenario by id rather than index, so a failure points at the entry a
  // contributor recognises.
  const s = resolve(schema);
  if (s.type === 'array' && Array.isArray(data)) {
    if (s.minItems != null && data.length < s.minItems) {
      errors.push(`root: has ${data.length} scenario(s), needs at least ${s.minItems}`);
    }
    data.forEach((item, i) => check(s.items, item, item?.id ? `scenario "${item.id}"` : `scenario[${i}]`));
  } else {
    check(schema, data, 'root');
  }

  return { errors, unsupported: [...unsupported], count: Array.isArray(data) ? data.length : 0 };
}

// Validate an in-memory object against an in-memory schema, using the same subset. The JSON
// examples printed in the skill documents are the contract a model actually copies, so they are
// validated here rather than trusted: a producer example that its own schema rejects makes the
// handoff depend on which document the model happened to read.
export function validateObjectAgainstSchema(schema, data, label = 'root') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-schema-'));
  const schemaPath = path.join(dir, 'schema.json');
  const dataPath = path.join(dir, 'data.json');
  try {
    fs.writeFileSync(schemaPath, JSON.stringify(schema), 'utf8');
    fs.writeFileSync(dataPath, JSON.stringify(data), 'utf8');
    const { errors, unsupported } = validateGoldenScenarios(schemaPath, dataPath);
    return { errors: errors.map((e) => e.replace(/^root/, label)), unsupported };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('validate-scenarios.mjs')) {
  const { errors, unsupported, count } = validateGoldenScenarios();
  for (const u of unsupported) console.warn(`WARN schema keyword not implemented by this validator: ${u}`);
  for (const e of errors) console.error(`FAIL ${e}`);
  if (errors.length) {
    console.error(`Scenario schema validation failed: ${errors.length} error(s) across ${count} scenario(s).`);
    process.exit(1);
  }
  console.log(`Scenario schema validation passed: ${count} scenarios match tests\\golden-scenarios.schema.json.`);
}
