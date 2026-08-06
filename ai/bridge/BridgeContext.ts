import type { ContentPackage } from "../types";

export interface WorkflowPort { execute(contentPackage: ContentPackage): Promise<ContentPackage>; }
export interface PublisherPort { publish(contentPackage: ContentPackage): Promise<unknown>; }
import type { EventBus } from "../jobs/JobEvents";
import type { JobQueue } from "../jobs/JobQueue";
import type { ProviderSelector } from "../providers/ProviderSelector";
import type { EditorDispatcher } from "./EditorDispatcher";
import type { BridgeLogger } from "./BridgeLogger";
import type { BridgeConfiguration } from "./BridgeConfiguration";

export interface BridgeContext {
  readonly configuration: BridgeConfiguration; readonly queue: JobQueue; readonly events: EventBus;
  readonly selector: ProviderSelector; readonly dispatcher: EditorDispatcher; readonly logger: BridgeLogger;
  readonly workflow: WorkflowPort; readonly publisher: PublisherPort;
}
