import { jobs as seedJobs } from '../data/mockData';
import type { EditorId, Job, Priority } from '../types';

let store = seedJobs.map((job) => ({ ...job }));
const wait = (milliseconds = 320) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

export const mockAIService = {
  async listJobs(): Promise<Job[]> {
    await wait();
    return store.map((job) => ({ ...job }));
  },
  async createJob(input: { title: string; editor: EditorId; priority: Priority; model: string }): Promise<Job> {
    await wait(520);
    const job: Job = {
      id: `JOB-${1050 + store.length}`,
      ...input,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString()
    };
    store = [job, ...store];
    return { ...job };
  },
  async updateStatus(id: string, status: Job['status']): Promise<Job | undefined> {
    await wait(180);
    store = store.map((job) => job.id === id ? { ...job, status, progress: status === 'success' ? 100 : job.progress } : job);
    return store.find((job) => job.id === id);
  }
};
