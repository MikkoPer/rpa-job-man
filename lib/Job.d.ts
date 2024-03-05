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
export type MetaType = Record<string, any>;
export type MetaJobInit = {
    type?: string;
    id?: string;
    meta?: MetaType;
    status?: string;
    message?: string;
    log?: LogEntry[];
    createdAt?: string;
    updatedAt?: string;
    error?: JobError;
};
export declare class MetaJob {
    type: string;
    id: string;
    meta: MetaType;
    status: String;
    message: String;
    log: LogEntry[];
    createdAt: string;
    updatedAt: string;
    error: JobError | NoError;
    constructor(init: MetaJobInit);
    toJSON(): string;
    fromJSON(json: string): this;
    getId(): string;
    getType(): string;
    getStatus(): String;
    getStatusMessage(): String;
    getMeta(): MetaType;
    /**
     * Updates jobs status with message and writes to disk
     */
    setStatus(status: string, message?: string): this;
    /**
     * Combines meta with existing meta and writes to disk
     */
    setMeta(meta: MetaType): this;
    /**
     * Writes to jobs log and updates job on disk
     */
    writeToLog(messages: string | string[]): void;
    setError(name: string, message: string, stack: string): this;
    clearError(): this;
}
//# sourceMappingURL=Job.d.ts.map