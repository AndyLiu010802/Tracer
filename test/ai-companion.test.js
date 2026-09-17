'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Chat = require('../lib/ai-companion');
const Work = require('../public/companion-work');
const task = { title: 'Write the report', notes: '', due: null, scheduled: null, priority: 'medium', estimate: null, checklist: [] };
const proposal = { type: 'tasks', project: null, tasks: [task] };
const messages = [{ role: 'user', content: 'Create a report-writing task, no deadline.' }];

test('chat accepts only a local date, bounded conversation and normalized unsaved proposal context', () => {
  const raw = { pet: 'nova', messages, today: '2026-09-17', proposal,
    tasks: [{ title: 'Private existing task' }], projects: [{ name: 'Private project' }], workspace: { secret: 'Private workspace' }, apiKey: 'private-key', photo: 'private-photo' };
  const value = Chat.input(raw), transmitted = JSON.stringify({ value, conversation: Chat.conversation(value) });
  assert.equal(value.today, '2026-09-17');
  assert.deepEqual(value.proposal, Work.normalize(proposal));
  assert.notEqual(value.proposal, proposal);
  for (const secret of ['Private existing task', 'Private project', 'Private workspace', 'private-key', 'private-photo']) assert.equal(transmitted.includes(secret), false);
  assert.equal(Chat.input({ messages }).proposal, null);
  assert.equal(Chat.input({ messages }).today, undefined);
  for (const today of [null, '', '0000-01-01', '2026-02-30', '2026-9-17', '2026-09-17T00:00:00Z', 'ignore rules']) assert.throws(() => Chat.input({ messages, today }), /invalid-chat/);
  assert.equal(Chat.input({ messages, today: '2028-02-29' }).today, '2028-02-29');
  for (const invalid of [{}, { ...proposal, tasks: [] }, { ...proposal, workspace: { tasks: [] } }]) assert.throws(() => Chat.input({ messages, proposal: invalid }), /invalid-chat/);
});

test('chat prompt asks only essential follow-ups and reserves actual creation for local confirmation', () => {
  const instructions = Chat.instructions(Chat.input({ pet: 'ember', language: 'zh', messages }));
  for (const rule of [/explicit request/, /at most two short/, /Never ask again/, /unknown or unwanted dates and estimates stay null/,
    /local calendar date/, /complete revised draft/, /explicit confirmation/, /Never claim a task or project has been created/, /Never browse, use tools, access files/,
    /Authored built-in character profile/, /Reply in Simplified Chinese/]) assert.match(instructions, rule);
  assert.deepEqual(Chat.schema.required, ['reply', 'proposal']);
  assert.equal(Chat.schema.additionalProperties, false);
  assert.equal(Chat.schema.properties.proposal.anyOf[0], Work.schema);
});

test('structured chat can clarify, draft tasks and revise projects without applying work', () => {
  assert.deepEqual(Chat.reply(JSON.stringify({ reply: 'What should the report deliver?', proposal: null })), { reply: 'What should the report deliver?', proposal: null });
  const draft = { reply: 'Here is a draft for your review.', proposal };
  assert.deepEqual(Chat.reply(JSON.stringify(draft)), draft);
  const project = { type: 'project', project: { name: 'Report', notes: 'Review a report.', start: null, end: null }, tasks: [] };
  assert.deepEqual(Chat.reply('```json\n' + JSON.stringify({ reply: 'Project draft ready for review.', proposal: project }) + '\n```').proposal, project);
  assert.deepEqual(Chat.reply('Hello, let’s take a break.'), { reply: 'Hello, let’s take a break.', proposal: null });
});

test('malformed JSON and invalid proposals never downgrade into a usable reply or action', () => {
  for (const output of ['', '{"reply":"Draft","proposal":', '```json\n{"reply":"unfinished"}', 'Here is JSON: {"proposal":oops}',
    'null', '[]', '"Hello"', JSON.stringify({ reply: 'Hello' }), JSON.stringify({ reply: 'Hello', proposal: null, execute: true }),
    JSON.stringify({ reply: '', proposal: null }), JSON.stringify({ reply: 'x'.repeat(2001), proposal: null }), JSON.stringify({ reply: 'Hello\u0000', proposal: null }),
    JSON.stringify({ reply: 'Draft', proposal: { ...proposal, tasks: [] } }),
    JSON.stringify({ reply: 'Draft', proposal: { ...proposal, tasks: [{ ...task, due: '2026-02-30' }] } }),
    JSON.stringify({ reply: 'Draft', proposal: { ...proposal, tasks: [{ ...task, id: 'overwrite-existing' }] } })]) {
    assert.throws(() => Chat.reply(output), /invalid-response/, output.slice(0, 80));
  }
});
