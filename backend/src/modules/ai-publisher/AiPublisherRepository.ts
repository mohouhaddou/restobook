import type { EditorId } from "../../../../ai/types";
import { AiPublisherTransactionError } from "./AiPublisherErrors";

/** Données préparées et indépendantes des modèles ORM. */
export interface AiPublisherRecord {
  readonly packageId: string;
  readonly editor: EditorId;
  readonly target: string;
  readonly slug: string;
  readonly category: string;
  readonly language: string;
  readonly title: string;
  readonly markdown: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly seo: Readonly<Record<string, unknown>>;
  readonly images: readonly Readonly<Record<string, unknown>>[];
}

/** Port transactionnel minimal à implémenter par un adapter Sequelize futur. */
export interface AiPublisherDatabaseTransaction {
  create(target: string, record: AiPublisherRecord): Promise<{ readonly id: string }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** Port de base de données injecté dans le repository. */
export interface AiPublisherDatabase {
  beginTransaction(): Promise<AiPublisherDatabaseTransaction>;
}

export interface AiPublisherTransactionScope {
  readonly id: string;
  save(record: AiPublisherRecord): Promise<{ readonly id: string }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Seul composant autorisé à dialoguer avec le port de base de données.
 * Aucun modèle Sequelize n'est importé par ce module.
 */
export class AiPublisherRepository {
  private transactionSequence = 0;

  public constructor(private readonly database: AiPublisherDatabase) {}

  public async createTransaction(): Promise<AiPublisherTransactionScope> {
    const transaction = await this.database.beginTransaction();
    const id = `ai-publisher-tx-${++this.transactionSequence}`;
    let state: "ACTIVE" | "COMMITTED" | "ROLLED_BACK" = "ACTIVE";
    return {
      id,
      save: async (record) => {
        if (state !== "ACTIVE") {
          throw new AiPublisherTransactionError(`Transaction ${id} inactive.`);
        }
        return transaction.create(record.target, record);
      },
      commit: async () => {
        if (state !== "ACTIVE") {
          throw new AiPublisherTransactionError(`Transaction ${id} inactive.`);
        }
        await transaction.commit();
        state = "COMMITTED";
      },
      rollback: async () => {
        if (state !== "ACTIVE") return;
        await transaction.rollback();
        state = "ROLLED_BACK";
      },
    };
  }
}
