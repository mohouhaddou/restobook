import assert from 'node:assert/strict';
import test from 'node:test';
import discoverPackageJson from '../examples/discover-package.json';
import {
  DEFAULT_PUBLISHER_CONFIGURATION,
  PublisherPipeline,
  type PublisherContext,
  type PublisherPhaseName,
} from '../publisher';
import type { ContentPackage } from '../types';

const contentPackage = discoverPackageJson as ContentPackage;

const createContext = (
  configuration = DEFAULT_PUBLISHER_CONFIGURATION,
): PublisherContext<{ phase: string }> => ({
  package: contentPackage,
  workspace: 'virtual/publisher-test',
  configuration,
  timestamps: {},
  logs: [],
});

test('PublisherPipeline exécute les phases dans leur ordre', async () => {
  const pipeline = new PublisherPipeline<{ phase: string }>();
  const calls: PublisherPhaseName[] = [];

  for (const phase of DEFAULT_PUBLISHER_CONFIGURATION.phases) {
    pipeline.registerHandler(phase.name, (_context, name) => {
      calls.push(name);
      return { status: 'SUCCESS', result: { phase: name } };
    });
  }

  const report = await pipeline.execute(createContext());

  assert.deepEqual(calls, [
    'Validate',
    'Normalize',
    'PrepareImages',
    'PrepareMarkdown',
    'PrepareMetadata',
    'Package',
    'Finalize',
  ]);
  assert.equal(report.status, 'SUCCESS');
  assert.equal(report.result?.phase, 'Finalize');
  assert.deepEqual(report.executedSteps, calls);
  assert.deepEqual(report.skippedSteps, []);
});

test('PublisherPipeline conserve les warnings et ignore les phases désactivées', async () => {
  const configuration = {
    ...DEFAULT_PUBLISHER_CONFIGURATION,
    phases: DEFAULT_PUBLISHER_CONFIGURATION.phases.map(phase => ({
      ...phase,
      enabled: phase.name !== 'PrepareImages',
    })),
  };
  const pipeline = new PublisherPipeline<{ phase: string }>();

  for (const phase of configuration.phases) {
    if (!phase.enabled) continue;
    pipeline.registerHandler(phase.name, () => phase.name === 'Normalize'
      ? { status: 'WARNING', warnings: ['Normalisation à revoir.'] }
      : { status: 'SUCCESS' });
  }

  const report = await pipeline.execute(createContext(configuration));

  assert.equal(report.status, 'WARNING');
  assert.ok(report.warnings.includes('Normalisation à revoir.'));
  assert.ok(report.skippedSteps.includes('PrepareImages'));
  assert.equal(
    report.phases.find(phase => phase.phase === 'PrepareImages')?.status,
    'SKIPPED',
  );
});

test('PublisherPipeline arrête les handlers après une erreur', async () => {
  const pipeline = new PublisherPipeline();
  let finalHandlerCalled = false;

  for (const phase of DEFAULT_PUBLISHER_CONFIGURATION.phases) {
    pipeline.registerHandler(phase.name, () => {
      if (phase.name === 'Normalize') {
        return { status: 'ERROR', errors: ['Erreur contrôlée.'] };
      }
      if (phase.name === 'Finalize') finalHandlerCalled = true;
      return { status: 'SUCCESS' };
    });
  }

  const report = await pipeline.execute(createContext());

  assert.equal(report.status, 'ERROR');
  assert.equal(finalHandlerCalled, false);
  assert.ok(report.errors.includes('Erreur contrôlée.'));
  assert.ok(report.skippedSteps.includes('Finalize'));
});
