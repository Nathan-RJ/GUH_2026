// Runs without React/Vite: node --test tests/upload.test.cjs (requires TypeScript).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function setup(base = '') {
  const requests = [];
  class XHR {
    upload = {};
    open(method, url) { this.method = method; this.url = url; }
    send(body) { this.body = body; requests.push(this); }
    reply(status, data) { this.status = status; this.responseText = JSON.stringify(data); this.onload(); }
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/services/upload.ts'), 'utf8')
    .replace('import.meta.env["VITE_API_BASE_URL"]', JSON.stringify(base));
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const context = { exports: {}, FormData, XMLHttpRequest: XHR };
  vm.runInNewContext(compiled.outputText, context);
  return { ...context.exports, requests };
}
const doc = (overrides = {}) => ({ file: new File(['# Bubble sort\nCompare adjacent values.'], 'lesson.md', { type: 'text/plain' }), title: '  Bubble sort  ', kind: 'content', ...overrides });

test('sends actual bytes and title, then waits for confirmed draft', async () => {
  const api = setup();
  let uploaded = false;
  const input = doc();
  const result = api.processDocument(input, () => { uploaded = true; });
  const req = api.requests[0];
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/api/lessons/prepare');
  assert.deepEqual([...req.body.keys()], ['document', 'title']);
  assert.equal(await req.body.get('document').text(), await input.file.text());
  assert.equal(req.body.get('title'), 'Bubble sort');
  req.upload.onload();
  assert.equal(uploaded, true);
  req.reply(201, { status: 'draft', lesson_id: 'lesson-123' });
  assert.equal((await result).lesson_id, 'lesson-123');
});

test('production API origin is used', async () => {
  const api = setup('https://api.example.com/');
  const result = api.processDocument(doc());
  assert.equal(api.requests[0].url, 'https://api.example.com/api/lessons/prepare');
  api.requests[0].reply(201, { status: 'draft', lesson_id: 'saved' });
  await result;
});

test('invalid content, categories and titles never send a request', async () => {
  const api = setup();
  for (const input of [doc({ kind: 'rubric' }), doc({ kind: 'exams' }), doc({ title: ' ' }), doc({ title: 'x'.repeat(201) }), doc({ file: new File(['fake'], 'slides.pptx') }), doc({ file: new File([], 'empty.txt') }), doc({ file: new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt') })]) {
    await assert.rejects(api.processDocument(input));
  }
  assert.equal(api.requests.length, 0);
});

test('acknowledgements and incomplete responses never mean success', async () => {
  for (const [status, data] of [[200, { message: 'Workflow was started' }], [202, { status: 'draft', lesson_id: 'id' }], [200, { status: 'draft' }], [200, { status: 'processing', lesson_id: 'id' }]]) {
    const api = setup();
    const result = api.processDocument(doc());
    api.requests[0].reply(status, data);
    assert.equal((await result).status, 'unconfirmed');
  }
});

test('server errors, malformed responses, timeouts and network failures reject', async () => {
  for (const action of [
    req => req.reply(503, { error: 'Publish the workflow.' }),
    req => { req.status = 200; req.responseText = '<html>'; req.onload(); },
    req => req.ontimeout(), req => req.onerror(), req => req.onabort(),
  ]) {
    const api = setup();
    const result = api.processDocument(doc());
    action(api.requests[0]);
    await assert.rejects(result);
  }
});

test('upload page TSX parses without syntax errors', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/lecturer.upload.tsx'), 'utf8');
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }, fileName: 'lecturer.upload.tsx' });
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
});
