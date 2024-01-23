import { Job } from './Job.js';
import type { JobMeta } from './Job.js';
import type { Task } from './Task.js';
export declare enum WriteResult {
    Create = 0,
    Read = 1,
    Update = 2,
    Delete = 3,
    Fail = 4,
    Skip = 5
}
type JobResult = {
    job: Job;
};
export type CreateJobResult = JobResult & {
    writeResult: WriteResult.Create | WriteResult.Skip | WriteResult.Fail;
};
export type ReadJobResult = JobResult & {
    writeResult: WriteResult.Read | WriteResult.Fail;
};
export type UpdateJobResult = JobResult & {
    writeResult: WriteResult.Update | WriteResult.Fail;
};
export type DeleteJobResult = JobResult & {
    writeResult: WriteResult.Delete | WriteResult.Fail;
};
export type FetchJobResult = ReadJobResult & {
    count: number;
};
type JobArgument = Job | {
    id: string;
    type: string;
};
/**
 * Static class to manage jobs on disk and in memory
 */
export declare class Service {
    jobs: Job[];
    static rootDir: string;
    static archiveDir: string;
    static getJobFileName: (job: JobArgument) => string;
    static getJobArchiveFileName: (job: JobArgument) => string;
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir?: string, archiveDir?: string);
    static setRootDir: (rootDir: string) => void;
    static setArchiveDir: (archiveDir: string) => void;
    static writeJobToDisk: (job: Job, overwrite?: boolean) => WriteResult.Skip | WriteResult.Update | WriteResult.Create;
    static removeFileFromDisk: (job: Job) => WriteResult.Delete | WriteResult.Fail;
    static moveJobToArchive: (job: Job) => WriteResult.Update | WriteResult.Fail;
    createJob: (id: string, type: string, meta?: JobMeta) => Promise<CreateJobResult>;
    /**
     * Returns all jobs, loading from file system if not already loaded
     * @param {Boolean} updateCache
     */
    fetchJobs: (updateCache: false) => Promise<Job[]>;
    /**
     * Returns all jobs matching the type and status, loading from file system if not already loaded
     */
    queryJobs: (type: string, status: string, chunkSize?: number) => Promise<Job[]>;
    /**
     * Returns job by type and id, loading from file system if not already loaded
     * @param {String} id
     * @returns {Job}
     */
    getJob: (id: string, type: string) => Promise<ReadJobResult>;
    /**
     * Removes job from disk
     * @param {Job} job
     */
    removeJob: (job: Job) => void;
    /**
     * Moves job to archive directory
     * @param {Job} job
     */
    archiveJob: (job: Job) => void;
    runTask: (jobType: string, jobStatus: string, task: Task, chunkSize?: number) => Promise<void>;
}
export {};
//# sourceMappingURL=Service.d.ts.map