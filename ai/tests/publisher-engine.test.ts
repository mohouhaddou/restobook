import assert from 'node:assert/strict';
import test from 'node:test';
import discoverPackageJson from '../examples/discover-package.json';
import {
  DEFAULT_PUBLISHER_CONFIGURATION,
  PublisherEngine,
  PublisherValidationError,
} from '../publisher';
import type { ContentPackage } from '../types';

const contentPackage = discoverPackageJson as ContentPackage;

test('PublisherEngine valide et retourne un rapport publiable complet', async () => {
  const engine = new PublisherEngine<{ packageId: string; ready: boolean }>();
  const events: string[] = [];
  engine.pipeline.eventBus.on(event => events.push(event.type));

  for (const phase of DEFAULT_PUBLISHER_CONFIGURATION.phases) {
    engine.registerPhaseHandler(phase.name, context => ({
      status: 'SUCCESS',
      result: {
        packageId: context.package.id,
        ready: phase.name === 'Finalize',
      },
    }));
  }

  const report = await engine.publish({
    package: contentPackage,
    workspace: 'virtual/publisher-engine-test',
  });

  assert.equal(report.status, 'SUCCESS');
  assert.equal(report.packageId, contentPackage.id);
  assert.equal(report.result?.ready, true);
  assert.equal(report.executedSteps.length, 7);
  assert.ok(report.durationMs >= 0);
  assert.ok(report.logs.some(entry => entry.event === 'publisher:start'));
  assert.ok(report.logs.some(entry => entry.event === 'publisher:end'));
  assert.equal(events[0], 'publisher:start');
  assert.equal(events.at(-1), 'publisher:end');
});

test('PublisherEngine refuse un ContentPackage invalide avant le pipeline', async () => {
  const engine = new PublisherEngine();

  await assert.rejects(
    engine.publish({
      package: { ...contentPackage, articleMarkdown: '' },
      workspace: 'virtual/publisher-engine-test',
    }),
    PublisherValidationError,
  );
});

test('PublisherEngine exige un handler pour chaque phase active', async () => {
  const engine = new PublisherEngine();
  engine.registerPhaseHandler('Validate', () => ({ status: 'SUCCESS' }));

  await assert.rejects(
    engine.publish({
      package: contentPackage,
      workspace: 'virtual/publisher-engine-test',
    }),
    error => error instanceof PublisherValidationError
      && error.validationErrors.some(message => message.includes('Normalize')),
  );
});
