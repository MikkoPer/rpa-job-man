export class MetaJob {
    constructor(init) {
        this.type = '';
        this.id = '';
        this.meta = {};
        this.status = 'initialized';
        this.message = '';
        this.log = [];
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        const { type, id, meta, status, message, log, createdAt, updatedAt, error } = init;
        const ts = new Date();
        this.type = type || 'job';
        this.id = id || ts.getTime().toString();
        const iso = ts.toISOString();
        this.createdAt = createdAt || iso;
        this.updatedAt = updatedAt || iso;
        this.meta = meta || {};
        this.status = status || 'initialized';
        this.message = message || '';
        this.log = log || [];
        this.error = error || null;
        return this;
    }
    toJSON() {
        const { id, type, createdAt, updatedAt, meta, status, message, log, error } = this;
        return JSON.stringify({
            id,
            type,
            createdAt,
            updatedAt,
            meta,
            status,
            message,
            log,
            error,
        });
    }
    fromJSON(json) {
        const job = JSON.parse(json);
        this.id = job.id || String(Date.now());
        this.type = job.type || 'job';
        this.createdAt = job.createdAt || new Date().toISOString();
        this.updatedAt = job.updatedAt || new Date().toISOString();
        this.meta = job.meta || {};
        this.status = job.status || 'initialized';
        this.message = job.message || '';
        this.log = job.log || [];
        this.error = job.error || null;
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
    writeToLog(...args) {
        console.log(...args);
        this.writeToLogSilent(...args);
    }
    writeToLogSilent(...args) {
        const message = args.join(' ');
        this.log.push({ ts: new Date().toISOString(), message });
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