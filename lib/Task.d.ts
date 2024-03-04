import { Service, Job } from './Service.js';
export type ChunkSize = number | null;
export type Task = (jobService: Service, job: Job, index?: number, jobs?: Job[]) => Promise<void>;
//# sourceMappingURL=Task.d.ts.map