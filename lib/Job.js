import { Service } from './Service.js';
export class MetaJob {
    constructor(id = null, type = null, meta = {}, status, message, log, createdAt, updatedAt, error) {
        this.id = '';
        this.type = '';
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.meta = {};
        this.status = 'initialized';
        this.message = '';
        this.log = [];
        const ts = new Date();
        this.id = id || ts.getTime().toString();
        this.type = type || 'job';
        const iso = ts.toISOString();
        this.createdAt = createdAt || iso;
        this.updatedAt = updatedAt || iso;
        this.meta = meta;
        this.status = status || 'initialized';
        this.message = message || '';
        this.log = log || [];
        this.error = error || null;
        return this;
    }
    toJSON() {
        const { id, type, createdAt, updatedAt, meta, status, log, error } = this;
        return JSON.stringify({
            id,
            type,
            createdAt,
            updatedAt,
            meta,
            status,
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
        this.status = job.status;
        this.log = job.log;
        return this;
    }
    getId() {
        return this.id;
    }
    getType() {
        return this.type;
    }
    getStatus() {
        return this.status;
    }
    getStatusMessage() {
        return this.message;
    }
    getMeta() {
        return this.meta;
    }
    /**
     * Updates jobs status with message and writes to disk
     */
    setStatus(status, message = '') {
        this.updatedAt = new Date().toISOString();
        this.status = status;
        this.message = message;
        return this;
    }
    /**
     * Combines meta with existing meta and writes to disk
     */
    setMeta(meta) {
        this.updatedAt = new Date().toISOString();
        if (Object(meta) === meta) {
            this.meta = { ...this.meta, ...meta };
        }
        else {
            this.meta = meta;
        }
        return this;
    }
    /**
     * Writes to jobs log and updates job on disk
     */
    writeToLog(messages) {
        console.log(...arguments);
        messages = Object.values(arguments);
        this.log.push({ ts: new Date().toISOString(), message: messages.join(' ') });
    }
    setError(name, message, stack) {
        this.error = { name, message, stack };
        return this;
    }
    clearError() {
        this.error = null;
        return this;
    }
}
//# sourceMappingURL=Job.js.map