import type { ContentPackage } from "../types";
import type { BridgeContext } from "../bridge/BridgeContext";
import type { Job } from "./Job";
import type { JobEventType } from "./JobEvents";
import type { JobStatus } from "./JobStatus";

const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "");

/** Exécute le cycle canonique sans connaître aucun SDK fournisseur. */
export class JobExecutor {
  public constructor(private readonly context: BridgeContext, private readonly now = () => new Date()) {}

  public async execute(job: Job): Promise<Job> {
    job.startedAt ??= this.now().toISOString();
    job.attempts++;
    await this.transition(job, "VALIDATING", 5, "JOB_STARTED");
    try {
      await this.transition(job, "SELECT_PROVIDER", 12);
      const provider = await this.context.selector.select(job);
      job.provider = provider.id;
      await this.event(job, "PROVIDER_SELECTED", { provider: provider.id });
      await this.transition(job, "SELECT_EDITOR", 20);
      const editor = this.context.dispatcher.dispatch(job);
      await this.event(job, "EDITOR_SELECTED", { editor: editor.id });
      await this.transition(job, "GENERATE", 32);
      const response = await provider.generate({ prompt: editor.preparePrompt(job), model: this.context.configuration.defaultModel });
      await this.event(job, "TEXT_GENERATED");
      await this.transition(job, "VALIDATE", 44);
      if (!response.content.trim()) throw new Error("EMPTY_CONTENT");
      await this.transition(job, "GENERATE_IMAGES", 54);
      await this.event(job, "IMAGES_GENERATED", { count: 1, simulated: true });
      await this.transition(job, "GENERATE_METADATA", 64);
      await this.event(job, "METADATA_GENERATED");
      await this.transition(job, "PACKAGE", 74);
      let contentPackage = this.package(job, response.content);
      await this.event(job, "PACKAGE_READY", { packageId: contentPackage.id });
      await this.transition(job, "WORKFLOW", 84);
      contentPackage = await this.context.workflow.execute(contentPackage);
      await this.transition(job, "PUBLISH", 92);
      await this.event(job, "PUBLISH_STARTED");
      await this.context.publisher.publish(contentPackage);
      await this.event(job, "PUBLISH_FINISHED");
      job.result = { contentPackage, providerResponse: response.content, published: true };
      await this.finish(job, "SUCCESS", "JOB_SUCCESS");
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.errors.push(message);
      this.context.logger.write("error", message, job);
      await this.finish(job, "FAILED", "JOB_FAILED", { error: message });
      throw error;
    }
  }

  private package(job: Job, markdown: string): ContentPackage {
    const timestamp = this.now().toISOString();
    const slug = slugify(job.topic);
    const image = `images/${job.id}-cover.webp`;
    return {
      id: `pkg-${job.id}`, editor: job.editor, category: job.editor, language: job.language,
      createdAt: timestamp, updatedAt: timestamp, articleMarkdown: markdown,
      sections: [{ heading: job.topic, level: 2, content: markdown, imageReference: `${job.id}-cover` }],
      metadata: { title: job.topic, slug, excerpt: `À découvrir : ${job.topic}.`, description: `Article consacré à ${job.topic}.`,
        keywords: [job.topic], tags: [job.editor, job.language], author: { name: `iFilino ${job.editor}`, type: "ai-editor" },
        category: job.editor, language: job.language, readingTime: 2, difficulty: "beginner", sources: [],
        license: { name: "iFilino editorial" } },
      images: [{ id: `${job.id}-cover`, filename: `${job.id}-cover.webp`, alt: job.topic, caption: job.topic,
        role: "cover", width: 1600, height: 900, format: "webp", relativePath: image, generated: true }],
      seo: { title: job.topic, description: `Découvrez ${job.topic} avec iFilino.`, canonical: `https://ifilino.com/${job.editor}/${slug}`,
        robots: "index,follow", openGraph: { title: job.topic, description: `Découvrez ${job.topic}.`, type: "article", image, siteName: "iFilino" },
        twitter: { card: "summary_large_image", title: job.topic, description: `Découvrez ${job.topic}.`, image } },
      workflow: { editor: job.editor, version: "1.0.0", steps: [{ id: "bridge", name: "AI Bridge", order: 1, status: "completed", requiresHumanReview: false }] },
      version: "1.0.0", status: "approved",
    };
  }

  private async transition(job: Job, status: JobStatus, progress: number, event?: JobEventType): Promise<void> {
    job.status = status; job.progress = progress;
    this.context.logger.write("info", `${status} (${progress}%)`, job);
    await this.event(job, event ?? "JOB_PROGRESS", { status, progress });
  }
  private async finish(job: Job, status: "SUCCESS" | "FAILED", event: JobEventType, payload?: Readonly<Record<string, unknown>>): Promise<void> {
    job.status = status; job.progress = status === "SUCCESS" ? 100 : job.progress; job.finishedAt = this.now().toISOString();
    job.duration = Date.parse(job.finishedAt) - Date.parse(job.startedAt ?? job.createdAt);
    await this.event(job, event, payload);
  }
  private async event(job: Job, type: JobEventType, payload?: Readonly<Record<string, unknown>>): Promise<void> {
    await this.context.events.emit({ type, jobId: job.id, job, payload, timestamp: this.now().toISOString() });
  }
}
