import { Service } from './Service.js';
export type JobStatus = {
    status: string;
    createdAt: string;
    message: string;
};
export type JobMeta = Record<string, any>;
export type LogEntry = {
    ts: string;
    message: string;
};
export type JobError = {
    name: string;
    message: string;
    stack: string;
};
export type NoError = null;
export declare class Job {
    service: Service;
    id: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    meta: Record<string, any>;
    statuses: JobStatus[];
    log: LogEntry[];
    error: JobError | NoError;
    /**
     * @description If true, job changes will not be written to disk
     */
    static simulate: boolean;
    constructor(service: Service, id?: string | null, type?: string | null, meta?: Record<string, any>, statuses?: JobStatus[], log?: LogEntry[], createdAt?: string, updatedAt?: string, error?: JobError);
    toJSON(): string;
    fromJSON(json: string): this;
    getJobService(): Service;
    getId(): string;
    getType(): string;
    getStatus(): string;
    getStatusMessage(): string;
    getMeta(): JobMeta;
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
    setError(name: string, message: string, stack: string): void;
    clearError(): void;
}
//# sourceMappingURL=Job.d.ts.map