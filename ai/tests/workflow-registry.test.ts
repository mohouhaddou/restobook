import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WorkflowAlreadyRegisteredError,
  WorkflowNotFoundError,
  WorkflowRegistry,
  type WorkflowDefinition,
} from '../workflow-engine';

const workflow: WorkflowDefinition = {
  id: 'registry-test',
  name: 'Registry test',
  version: '1.0.0',
  steps: [
    { id: 'first', name: 'First', type: 'Noop', order: 1 },
  ],
};

test('WorkflowRegistry expose register, get, list et has', () => {
  const registry = new WorkflowRegistry();

  registry.register(workflow);

  assert.equal(registry.has(workflow.id), true);
  assert.equal(registry.get(workflow.id), workflow);
  assert.deepEqual(registry.list(), [workflow]);
});

test('WorkflowRegistry refuse un identifiant déjà enregistré', () => {
  const registry = new WorkflowRegistry();
  registry.register(workflow);

  assert.throws(
    () => registry.register(workflow),
    WorkflowAlreadyRegisteredError,
  );
});

test('WorkflowRegistry retire et signale les workflows absents', () => {
  const registry = new WorkflowRegistry();
  registry.register(workflow);

  assert.equal(registry.unregister(workflow.id), workflow);
  assert.equal(registry.has(workflow.id), false);
  assert.throws(() => registry.get(workflow.id), WorkflowNotFoundError);
});
