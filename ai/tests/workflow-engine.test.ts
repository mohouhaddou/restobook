import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WorkflowEngine,
  createWorkflowContext,
  type WorkflowDefinition,
} from '../workflow-engine';

const orderedWorkflow: WorkflowDefinition = {
  id: 'engine-order',
  name: 'Engine order',
  version: '1.0.0',
  steps: [
    { id: 'third', name: 'Third', type: 'Third', order: 3 },
    { id: 'first', name: 'First', type: 'First', order: 1 },
    { id: 'second', name: 'Second', type: 'Second', order: 2 },
  ],
};

test('WorkflowEngine enregistre, charge et exécute les étapes dans leur ordre', async () => {
  const engine = new WorkflowEngine();
  const calls: string[] = [];

  engine.registerStepHandler('First', () => {
    calls.push('first');
    return { status: 'SUCCESS', message: 'Première étape terminée.' };
  });
  engine.registerStepHandler('Second', async () => {
    calls.push('second');
    return {
      status: 'WARNING',
      message: 'Avertissement contrôlé.',
      warnings: ['Revue recommandée.'],
    };
  });
  engine.registerStepHandler('Third', () => {
    calls.push('third');
    return { status: 'SUCCESS', output: { complete: true } };
  });

  engine.register(orderedWorkflow);
  assert.equal(engine.load(orderedWorkflow.id), orderedWorkflow);

  const context = createWorkflowContext({
    editor: 'generic-test-editor',
    workingDirectory: 'workspace/test',
    metadata: {},
  });
  const events: string[] = [];
  engine.executor.eventBus.on(event => events.push(event.type));

  const report = await engine.execute(orderedWorkflow.id, context);

  assert.deepEqual(calls, ['first', 'second', 'third']);
  assert.equal(report.status, 'WARNING');
  assert.deepEqual(report.steps.map(step => step.stepId), ['first', 'second', 'third']);
  assert.equal(report.steps[2].status, 'SUCCESS');
  assert.ok(report.warnings.includes('Revue recommandée.'));
  assert.ok(report.logs.some(entry => entry.event === 'workflow:start'));
  assert.ok(report.logs.some(entry => entry.event === 'workflow:end'));
  assert.deepEqual(events, [
    'workflow:start',
    'step:start', 'step:end',
    'step:start', 'step:end',
    'step:start', 'step:end',
    'workflow:end',
  ]);
});

test('WorkflowEngine arrête les handlers après la première erreur', async () => {
  const engine = new WorkflowEngine();
  let finalHandlerCalled = false;
  const workflow: WorkflowDefinition = {
    id: 'engine-error',
    name: 'Engine error',
    version: '1.0.0',
    steps: [
      { id: 'start', name: 'Start', type: 'Start', order: 1 },
      { id: 'fail', name: 'Fail', type: 'Fail', order: 2 },
      { id: 'final', name: 'Final', type: 'Final', order: 3 },
    ],
  };

  engine.registerStepHandler('Start', () => ({ status: 'SUCCESS' }));
  engine.registerStepHandler('Fail', () => {
    throw new Error('Erreur de test contrôlée.');
  });
  engine.registerStepHandler('Final', () => {
    finalHandlerCalled = true;
    return { status: 'SUCCESS' };
  });
  engine.register(workflow);

  const report = await engine.execute(workflow.id, createWorkflowContext({
    editor: 'generic-test-editor',
    workingDirectory: 'workspace/test',
    metadata: {},
  }));

  assert.equal(report.status, 'ERROR');
  assert.equal(finalHandlerCalled, false);
  assert.equal(report.steps[1].status, 'ERROR');
  assert.equal(report.steps[2].status, 'SKIPPED');
  assert.ok(report.errors.includes('Erreur de test contrôlée.'));
});

test('WorkflowEngine valide les handlers avant l’exécution', async () => {
  const engine = new WorkflowEngine();
  engine.register(orderedWorkflow);

  await assert.rejects(
    engine.execute(orderedWorkflow.id, createWorkflowContext({
      editor: 'generic-test-editor',
      workingDirectory: 'workspace/test',
      metadata: {},
    })),
    error => error instanceof Error && error.name === 'WorkflowValidationError',
  );
});
