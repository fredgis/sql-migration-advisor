// Ask an Azure AI Foundry model to review the knowledge base and decision tree.
//
// Replaces the retired GitHub Models action. Authentication is Entra ID only:
// the workflow signs in with GitHub OIDC (no stored client secret, no API key)
// and passes a short-lived bearer token in AZURE_AI_TOKEN.
//
// Env:
//   AZURE_AI_TOKEN       bearer token for the https://ai.azure.com audience (required)
//   AZURE_AI_ENDPOINT    e.g. https://<resource>.services.ai.azure.com/openai/v1 (required)
//   AZURE_AI_DEPLOYMENT  model deployment name (required)
//   AI_PROMPT_FILE       prompt file, default prompt.txt
//   AI_RESPONSE_FILE     output file, default response.txt
//   AI_REASONING_EFFORT  reasoning depth, default xhigh
//   AI_MAX_OUTPUT_TOKENS default 24000 (reasoning tokens are billed to this budget)
//
// The review is advisory: it can never bump a version on its own. So a failure
// here must never break the weekly run — we log it, write an empty response and
// exit 0, and decide.mjs treats an empty response as "no AI verdict".
import fs from 'node:fs';

const PROMPT_FILE = process.env.AI_PROMPT_FILE || 'prompt.txt';
const RESPONSE_FILE = process.env.AI_RESPONSE_FILE || 'response.txt';
// This is a weekly, whole-corpus review of the knowledge base plus the decision tree, so it is
// worth the deepest reasoning the deployment offers. Reasoning tokens count against
// max_output_tokens, hence the generous budget.
const REASONING_EFFORT = process.env.AI_REASONING_EFFORT || 'xhigh';
const MAX_TOKENS = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '24000', 10);

const SYSTEM_PROMPT = [
  'You are a meticulous technical editor who maintains a SQL Server to Azure migration',
  'knowledge base and its distilled decision tree. Report only accurate, relevant,',
  'source-backed recommendations. Your verdict is advisory: a version bump requires an',
  'actual substantive diff plus passing consistency checks.',
  'Answer with a single JSON object and nothing else.',
].join(' ');

function giveUp(reason) {
  console.error(`AI review skipped: ${reason}`);
  fs.writeFileSync(RESPONSE_FILE, '');
  process.exit(0);
}

const token = process.env.AZURE_AI_TOKEN;
const endpoint = (process.env.AZURE_AI_ENDPOINT || '').replace(/\/+$/, '');
const deployment = process.env.AZURE_AI_DEPLOYMENT;

if (!token) giveUp('AZURE_AI_TOKEN is not set');
if (!endpoint) giveUp('AZURE_AI_ENDPOINT is not set');
if (!deployment) giveUp('AZURE_AI_DEPLOYMENT is not set');

let prompt = '';
try {
  prompt = fs.readFileSync(PROMPT_FILE, 'utf8');
} catch {
  giveUp(`cannot read ${PROMPT_FILE}`);
}
if (!prompt.trim()) giveUp(`${PROMPT_FILE} is empty`);

// Pull the assistant text out of a Responses API payload, tolerating shape changes.
function extractText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text;
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === 'string') chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

const body = {
  model: deployment,
  instructions: SYSTEM_PROMPT,
  input: prompt,
  reasoning: { effort: REASONING_EFFORT },
  max_output_tokens: MAX_TOKENS,
};

let res;
try {
  res = await fetch(`${endpoint}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600000),
  });
} catch (e) {
  giveUp(`request failed: ${e.message}`);
}

const raw = await res.text();
if (!res.ok) {
  // Never echo the body wholesale: it can repeat request content. Status is enough to triage.
  giveUp(`HTTP ${res.status} from the model endpoint`);
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  giveUp('response was not valid JSON');
}

const text = extractText(payload);
if (!text) giveUp('model returned no text');

fs.writeFileSync(RESPONSE_FILE, text);
const usage = payload.usage || {};
const reasoned = usage.output_tokens_details?.reasoning_tokens;
console.log(
  `AI review complete (effort ${REASONING_EFFORT}): ${text.length} chars` +
    (usage.total_tokens ? ` (${usage.input_tokens || '?'} in / ${usage.output_tokens || '?'} out tokens` : '') +
    (reasoned != null ? `, ${reasoned} reasoning)` : usage.total_tokens ? ')' : '')
);
