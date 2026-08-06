import { EventBus } from "../jobs/JobEvents";
import { JobExecutor } from "../jobs/JobExecutor";
import { JobManager } from "../jobs/JobManager";
import { JobQueue } from "../jobs/JobQueue";
import { JobRetryPolicy, DEFAULT_JOB_RETRY_CONFIGURATION } from "../jobs/JobRetryPolicy";
import { JsonJobPersistence, MemoryJobPersistence } from "../jobs/JobPersistence";
import { MockProvider } from "../providers/MockProvider";
import { ProviderHealth } from "../providers/ProviderHealth";
import { ProviderRegistry } from "../providers/ProviderRegistry";
import { ProviderSelector } from "../providers/ProviderSelector";
import type { AIProvider } from "../providers/AIProvider";
import type { ContentPackage } from "../types";
import { AIBridge } from "./AIBridge";
import { BridgeHealth } from "./BridgeHealth";
import { BridgeLogger } from "./BridgeLogger";
import { BridgeMetrics } from "./BridgeMetrics";
import type { BridgeConfiguration } from "./BridgeConfiguration";
import { EditorDispatcher, GenericEditor } from "./EditorDispatcher";
import type { PublisherPort, WorkflowPort } from "./BridgeContext";

export const DEFAULT_BRIDGE_CONFIGURATION: BridgeConfiguration = {
  defaultProvider: "mock", defaultModel: "mock-editorial-v1", concurrency: 1,
  autoResume: true, retry: DEFAULT_JOB_RETRY_CONFIGURATION,
};

export interface BridgeFactoryDependencies {
  readonly providers?: readonly AIProvider[];
  readonly workflow?: WorkflowPort;
  readonly publisher?: PublisherPort;
  readonly logger?: BridgeLogger;
}

/** Composition root. Changer de provider ne modifie aucun service Dashboard. */
export class BridgeFactory {
  public create(configuration: BridgeConfiguration = DEFAULT_BRIDGE_CONFIGURATION, dependencies: BridgeFactoryDependencies = {}): AIBridge {
    const persistence = configuration.persistencePath ? new JsonJobPersistence(configuration.persistencePath) : new MemoryJobPersistence();
    const queue = new JobQueue(persistence);
    const events = new EventBus();
    const metrics = new BridgeMetrics();
    events.on("*", event => metrics.record(event));
    const registry = new ProviderRegistry();
    for (const provider of dependencies.providers ?? [new MockProvider()]) registry.register(provider);
    const selector = new ProviderSelector(registry, configuration.defaultProvider);
    const dispatcher = new EditorDispatcher();
    for (const [id, label] of [["discover", "Discover"], ["sports", "Sports"], ["kids", "Kids"], ["stories", "Stories"], ["gaming", "GamingHub"]] as const) dispatcher.register(new GenericEditor(id, label));
    const context = {
      configuration, queue, events, selector, dispatcher, logger: dependencies.logger ?? new BridgeLogger(),
      workflow: dependencies.workflow ?? { async execute(contentPackage: ContentPackage) { return contentPackage; } },
      publisher: dependencies.publisher ?? { async publish(_contentPackage: ContentPackage) { return { simulated: true }; } },
    };
    const executor = new JobExecutor(context);
    const manager = new JobManager(queue, executor, events, new JobRetryPolicy(configuration.retry));
    const health = new BridgeHealth(registry, new ProviderHealth(), () => queue.isPaused());
    return new AIBridge(manager, queue, events, health, metrics);
  }
}
