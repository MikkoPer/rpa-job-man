import { Service } from './Service.js';
export class Job {
    constructor(service, id = null, type = null, meta = {}, statuses, log, createdAt, updatedAt, error) {
        this.id = '';
        this.type = '';
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.meta = {};
        this.statuses = [];
        this.log = [];
        /**
         * Updates jobs status with message and writes to disk
         */
        this.setStatus = (status, message = '') => {
            this.updatedAt = new Date().toISOString();
            this.statuses.push({ status, message, createdAt: new Date().toISOString() });
            if (!Job.simulate) {
                Service.writeJobToDisk(this, true);
            }
            return this;
        };
        /**
         * Combines meta with existing meta and writes to disk
         */
        this.setMeta = (meta) => {
            this.updatedAt = new Date().toISOString();
            this.meta = { ...this.meta, ...meta };
            if (!Job.simulate) {
                Service.writeJobToDisk(this, true);
            }
            return this;
        };
        this.service = service;
        const ts = new Date();
        this.id = id || ts.getTime().toString();
        this.type = type || 'job';
        const iso = ts.toISOString();
        this.createdAt = createdAt || iso;
        this.updatedAt = updatedAt || iso;
        this.meta = meta || {};
        this.statuses = statuses || [{ status: 'initialized', createdAt: iso, message: '' }];
        this.log = log || [];
        this.error = error || null;
        return this;
    }
    toJSON() {
        const { id, type, createdAt, updatedAt, meta, statuses, log, error } = this;
        return JSON.stringify({
            id,
            type,
            createdAt,
            updatedAt,
            meta,
            statuses,
            log,
            error,
        });
    }
    fromJSON(json) {
        const job = JSON.parse(json);
        this.id = job.id;
        this.type = job.type;
        this.createdAt = job.createdAt;
        this.updatedAt = job.updatedAt;
        this.meta = job.meta;
        this.statuses = job.statuses;
        this.log = job.log;
        return this;
    }
    getJobService() {
        return this.service;
    }
    getId() {
        return this.id;
    }
    getType() {
        return this.type;
    }
    getStatus() {
        return this.statuses.slice(-1)[0].status;
    }
    getStatusMessage() {
        return this.statuses.slice(-1)[0].message;
    }
    getMeta() {
        return this.meta;
    }
    /**
     * Writes to jobs log and updates job on disk
     */
    writeToLog(messages) {
        console.log(...arguments);
        if (!Job.simulate) {
            messages = Object.values(arguments);
            this.log.push({ ts: new Date().toISOString(), message: messages.join(' ') });
            Service.writeJobToDisk(this, true);
        }
    }
    setError(name, message, stack) {
        this.error = { name, message, stack };
        Service.writeJobToDisk(this, true);
    }
    clearError() {
        this.error = null;
        Service.writeJobToDisk(this, true);
    }
}
/**
 * @description If true, job changes will not be written to disk
 */
Job.simulate = false;
//# sourceMappingURL=Job.js.map