import { MetaJob } from './Job.js';
import type { MetaType, MetaJobInit } from './Job.js';
import type { Task } from './Task.js';
export declare class Job extends MetaJob {
    service: JobService;
    constructor(service: JobService, init?: MetaJobInit);
    setMeta(meta: MetaType): this;
    setStatus(status: string, message?: string): this;
    setError(name: string, message: string, stack: string): this;
    clearError(): this;
    writeToLog(messages: string | string[]): this;
}
/**
 * Static class to manage jobs on disk and in memory
 */
export declare class JobService {
    jobs: Job[];
    static rootDir: string;
    static archiveDir: string;
    getJobFileName: (job: Job) => string;
    getJobArchiveFileName: (job: Job) => string;
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir?: string, archiveDir?: string);
    static setRootDir: (rootDir: string) => void;
    static setArchiveDir: (archiveDir: string) => void;
    writeJobToDisk: (job: Job, overwrite?: boolean) => 'skip' | 'update' | 'create';
    deleteJobFromDisk: (job: Job) => void;
    moveJobToArchive: (job: Job) => void;
    createJob: (init: MetaJobInit, overwrite?: boolean) => Job;
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
    getJob: (type: string, id: string) => Promise<Job | null>;
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
//# sourceMappingURL=JobService.d.ts.map