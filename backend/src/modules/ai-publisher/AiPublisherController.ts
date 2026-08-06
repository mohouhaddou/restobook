import type { ContentPackage } from "../../../../ai/types";
import { AiPublisherValidationError } from "./AiPublisherErrors";
import { AiPublisherService } from "./AiPublisherService";
import type { PublishReport } from "./PublishReport";

/** Requête indépendante de tout framework HTTP. */
export interface AiPublisherRequest {
  readonly body: unknown;
}

/** Réponse transportable qu'une future route pourra adapter. */
export interface AiPublisherResponse {
  readonly status: number;
  readonly body: PublishReport | {
    readonly code: string;
    readonly message: string;
  };
}

/** Contrôleur isolé ; aucune route Express n'est créée automatiquement. */
export class AiPublisherController {
  public constructor(private readonly service: AiPublisherService) {}

  public async publish(request: AiPublisherRequest): Promise<AiPublisherResponse> {
    if (!this.isContentPackage(request.body)) {
      const error = new AiPublisherValidationError(["Le body doit être un ContentPackage."]);
      return { status: 400, body: { code: error.code, message: error.message } };
    }
    const report = await this.service.publish(request.body);
    return { status: report.status === "SUCCESS" ? 201 : 422, body: report };
  }

  private isContentPackage(value: unknown): value is ContentPackage {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<ContentPackage>;
    return typeof candidate.id === "string"
      && typeof candidate.editor === "string"
      && typeof candidate.articleMarkdown === "string"
      && Boolean(candidate.metadata)
      && Array.isArray(candidate.images)
      && Boolean(candidate.seo);
  }
}
