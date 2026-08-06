import type { AIBridge } from "../bridge/AIBridge";
import { WEBSOCKET_EVENT_NAMES } from "../bridge/BridgeEvents";
import type { JobEvent } from "../jobs/JobEvents";
export interface WebSocketEmitter { emit(event: string, payload: unknown): void; }
export class DashboardNotificationService {
  private unsubscribe?: () => void;
  public constructor(private readonly bridge: AIBridge, private readonly socket: WebSocketEmitter) {}
  public start(): void { this.unsubscribe ??= this.bridge.on("*", event => this.forward(event)); }
  public stop(): void { this.unsubscribe?.(); this.unsubscribe = undefined; }
  private forward(event: JobEvent): void {
    const mapped = WEBSOCKET_EVENT_NAMES[event.type as keyof typeof WEBSOCKET_EVENT_NAMES];
    if (mapped) this.socket.emit(mapped, event);
    if (["PROVIDER_SELECTED", "EDITOR_SELECTED", "TEXT_GENERATED", "IMAGES_GENERATED", "METADATA_GENERATED", "PACKAGE_READY", "PUBLISH_STARTED", "PUBLISH_FINISHED"].includes(event.type)) this.socket.emit("job-progress", event);
  }
}
