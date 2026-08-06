import {
  DiscoverImporter,
  GamingImporter,
  KidsImporter,
  SportsImporter,
  StoriesImporter,
} from "./importers";
import {
  DEFAULT_AI_PUBLISHER_CONFIGURATION,
  type AiPublisherConfiguration,
} from "./AiPublisherConfiguration";
import { AiPublisherController } from "./AiPublisherController";
import {
  AiPublisherRepository,
  type AiPublisherDatabase,
} from "./AiPublisherRepository";
import {
  AiPublisherService,
  type AiPublisherServiceOptions,
} from "./AiPublisherService";
import { AiPublisherValidator } from "./AiPublisherValidator";

export interface AiPublisherModuleOptions extends AiPublisherServiceOptions {
  readonly configuration?: AiPublisherConfiguration;
}

/**
 * Racine de composition explicite du module.
 * Sa construction ne modifie ni routes, modèles ou application existante.
 */
export class AiPublisherModule {
  public readonly repository: AiPublisherRepository;
  public readonly validator: AiPublisherValidator;
  public readonly service: AiPublisherService;
  public readonly controller: AiPublisherController;

  public constructor(database: AiPublisherDatabase, options: AiPublisherModuleOptions = {}) {
    this.repository = new AiPublisherRepository(database);
    this.validator = new AiPublisherValidator(
      options.configuration ?? DEFAULT_AI_PUBLISHER_CONFIGURATION,
    );
    this.service = new AiPublisherService(this.repository, this.validator, options);
    this.service.registerImporter(new DiscoverImporter());
    this.service.registerImporter(new SportsImporter());
    this.service.registerImporter(new KidsImporter());
    this.service.registerImporter(new StoriesImporter());
    this.service.registerImporter(new GamingImporter());
    this.controller = new AiPublisherController(this.service);
  }
}
