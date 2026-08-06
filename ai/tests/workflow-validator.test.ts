import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WorkflowValidator,
  type WorkflowDefinition,
} from '../workflow-engine';

const validWorkflow: WorkflowDefinition = {
  id: 'validator-test',
  name: 'Validator test',
  version: '1.0.0',
  steps: [
    { id: 'validate', name: 'Validate', type: 'ValidateInput', order: 1 },
    { id: 'finalize', name: 'Finalize', type: 'Finalize', order: 2 },
  ],
};

test('WorkflowValidator accepte une définition complète et des types compatibles', () => {
  const validator = new WorkflowValidator();
  const supported = new Set(['ValidateInput', 'Finalize']);

  const result = validator.validate(validWorkflow, type => supported.has(type));

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('WorkflowValidator exige des étapes', () => {
  const validator = new WorkflowValidator();
  const result = validator.validate({ ...validWorkflow, steps: [] });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('au moins une étape')));
});

test('WorkflowValidator rejette les ordres dupliqués ou non continus', () => {
  const validator = new WorkflowValidator();
  const result = validator.validate({
    ...validWorkflow,
    steps: [
      { ...validWorkflow.steps[0], order: 2 },
      { ...validWorkflow.steps[1], order: 2 },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('unique')));
  assert.ok(result.errors.some(error => error.includes('continu')));
});

test('WorkflowValidator rejette un type sans handler compatible', () => {
  const validator = new WorkflowValidator();
  const result = validator.validate(validWorkflow, type => type === 'ValidateInput');

  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('aucun handler compatible')));
});

test('WorkflowValidator contrôle les types primitifs des étapes', () => {
  const validator = new WorkflowValidator();
  const result = validator.validate({
    ...validWorkflow,
    steps: [
      { id: 'bad', name: 'Bad', type: 42, order: 'first', enabled: 'yes' },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 3);
});
