import type {
  AiPublisherDatabase,
  AiPublisherDatabaseTransaction,
  AiPublisherRecord,
} from "../AiPublisherRepository";

/** Double transactionnel strict utilisé uniquement par les tests. */
export class TestDatabase implements AiPublisherDatabase {
  public readonly records: AiPublisherRecord[] = [];
  public beginCount = 0;
  public commitCount = 0;
  public rollbackCount = 0;
  public failCreate = false;
  public failCommit = false;

  public async beginTransaction(): Promise<AiPublisherDatabaseTransaction> {
    this.beginCount += 1;
    const pending: AiPublisherRecord[] = [];
    return {
      create: async (_target, record) => {
        if (this.failCreate) throw new Error("create failed");
        pending.push(structuredClone(record));
        return { id: `record-${this.records.length + pending.length}` };
      },
      commit: async () => {
        if (this.failCommit) throw new Error("commit failed");
        this.records.push(...pending);
        pending.length = 0;
        this.commitCount += 1;
      },
      rollback: async () => {
        pending.length = 0;
        this.rollbackCount += 1;
      },
    };
  }
}
