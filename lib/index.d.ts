/**
 * Static class to manage jobs on disk and in memory
 */
export declare class JobService {
    jobs: Job[];
    static rootDir: string;
    static archiveDir: string;
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir?: string, archiveDir?: string);
    static setRootDir: (rootDir: string) => void;
    static setArchiveDir: (archiveDir: string) => void;
    static writeJobToDisk: (job: Job, overwrite?: boolean) => void;
    static removeFileFromDisk: (job: Job) => void;
    static moveJobToArchive: (job: Job) => void;
    createJob: (id: string, type: string, meta?: JobMeta, overwrite?: boolean) => Promise<Job>;
    /**
     * Loads all jobs from file system
     */
    loadJobs: () => Promise<void>;
    /**
     * Returns all jobs, loading from file system if not already loaded
     */
    getAllJobs: () => Promise<Job[]>;
    /**
     * Returns all jobs with status, loading from file system if not already loaded
     */
    queryJobs: (type: string, status: string, chunkSize?: ChunkSize) => Promise<Job[]>;
    /**
     * Returns job by id, loading from file system if not already loaded
     * @param {String} id
     * @returns {Job}
     */
    getJobById: (id: string) => Promise<Job | undefined>;
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
    processJobs: (jobType: string, jobStatus: string, handler: JobHandler, chunkSize?: ChunkSize) => Promise<void>;
}
type ChunkSize = number | null;
type JobHandler = (job: Job, index?: number, jobs?: Job[]) => Promise<void>;
type JobStatus = {
    status: string;
    createdAt: string;
    message: string;
};
type JobMeta = Record<string, any>;
type LogEntry = {
    ts: string;
    message: string;
};
type SerializedError = {
    isError: boolean;
    message: string;
};
declare class Job {
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    meta: Record<string, any>;
    statuses: JobStatus[];
    log: LogEntry[];
    error: SerializedError;
    /**
     * @description If true, job changes will not be written to disk
     */
    static simulate: boolean;
    constructor(id?: string | null, type?: string | null, meta?: Record<string, any>, statuses?: JobStatus[] | null, log?: LogEntry[] | null, createdAt?: string | null, updatedAt?: string | null, error?: SerializedError);
    serialize(): string;
    deserialize(json: string): this;
    /**
     * Updates jobs status with message and writes to disk
     */
    setStatus: (status: string, message?: string) => this;
    /**
     * Combines meta with existing meta and writes to disk
     */
    setMeta: (meta: JobMeta) => this;
    /**
     * Writes to jobs log and updates job on disk
     */
    writeToLog(messages: string | string[]): void;
    setError(error: any): void;
}
export {};
//# sourceMappingURL=index.d.ts.map