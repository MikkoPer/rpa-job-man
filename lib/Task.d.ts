import { JobService, Job } from './JobService.js';
export type ChunkSize = number | null;
export type Task = (jobService: JobService, job: Job, index?: number, jobs?: Job[]) => Promise<void>;
//# sourceMappingURL=Task.d.ts.map