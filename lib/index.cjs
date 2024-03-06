'use strict';

var pkg = require('fast-glob');
var fs = require('fs');

const serializeSircular = (error) => {
    const seen = new WeakSet();
    return JSON.stringify(error, (key, value) => {
        if (value !== null && typeof value === 'object') {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    });
};

class MetaJob {
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
        this.id = job.id || String(Date.now());
        this.type = job.type || 'job';
        this.createdAt = job.createdAt || new Date().toISOString();
        this.updatedAt = job.updatedAt || new Date().toISOString();
        this.meta = job.meta || {};
        this.status = job.status || 'initialized';
        this.log = job.log || [];
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

const { glob } = pkg;
class Job extends MetaJob {
    constructor(service, init) {
        super(init || {});
        this.service = service;
    }
    setMeta(meta) {
        const job = super.setMeta(meta);
        this.service.writeJobToDisk(job, true);
        return job;
    }
    setStatus(status, message) {
        const job = super.setStatus(status, message);
        this.service.writeJobToDisk(job, true);
        return job;
    }
    setError(name, message, stack) {
        const job = super.setError(name, message, stack);
        this.service.writeJobToDisk(this, true);
        return job;
    }
    clearError() {
        const job = super.clearError();
        this.service.writeJobToDisk(this, true);
        return job;
    }
    writeToLog(messages) {
        super.writeToLog(messages);
        this.service.writeJobToDisk(this, true);
        return this;
    }
}
/**
 * Static class to manage jobs on disk and in memory
 */
class JobService {
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir = './jobs', archiveDir = './jobs/archive') {
        this.jobs = [];
        this.getJobFileName = (job) => `${JobService.rootDir}/${job.type}-${job.id}.json`;
        this.getJobArchiveFileName = (job) => `${JobService.archiveDir}/${job.type}-${job.id}.json`;
        this.writeJobToDisk = (job, overwrite) => {
            const fileName = this.getJobFileName(job);
            const exists = fs.existsSync(fileName);
            if (!overwrite && exists) {
                return 'skip';
            }
            fs.writeFileSync(fileName, job.toJSON());
            return exists
                ? 'update'
                : 'create';
        };
        this.deleteJobFromDisk = (job) => {
            const fileName = this.getJobFileName(job);
            fs.unlinkSync(fileName);
        };
        this.moveJobToArchive = (job) => {
            const fileName = this.getJobFileName(job);
            const archiveFileName = this.getJobArchiveFileName(job);
            fs.renameSync(fileName, archiveFileName);
        };
        this.createJob = (init, overwrite = false) => {
            const job = new Job(this, init);
            this.jobs.push(job);
            this.writeJobToDisk(job, overwrite);
            return job;
        };
        /**
         * Returns all jobs, loading from file system if not already loaded
         * @param {Boolean} updateCache
         */
        this.fetchJobs = async (updateCache) => {
            if (this.jobs.length && !updateCache) {
                return this.jobs;
            }
            const files = await glob(`${JobService.rootDir}/*.json`, { ignore: ['node_modules/**'] });
            for (const file of files) {
                this.jobs.push(new Job(this).fromJSON(fs.readFileSync(file, 'utf8')));
            }
            this.jobs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
            return this.jobs;
        };
        /**
         * Returns all jobs matching the type and status, loading from file system if not already loaded
         */
        this.queryJobs = async (type, status, chunkSize) => {
            const jobs = await this.fetchJobs(false);
            const filtered = jobs.filter((job) => {
                const jobType = job.type;
                const currentStatus = job.getStatus();
                return jobType === type && currentStatus === status;
            });
            if (chunkSize) {
                return filtered.slice(0, chunkSize);
            }
            return filtered;
        };
        /**
         * Returns job by type and id, loading from file system if not already loaded
         * @param {String} id
         * @returns {Job}
         */
        this.getJob = async (id, type) => {
            const jobs = await this.fetchJobs(false);
            const job = jobs.find((job) => job.id === id && job.type === type);
            if (job) {
                return job;
            }
            const fileName = this.getJobFileName(new Job(this, { type, id }));
            if (fs.existsSync(fileName)) {
                const job = new Job(this).fromJSON(fs.readFileSync(fileName, 'utf8'));
                this.jobs.push(job);
                return job;
            }
            return null;
        };
        /**
         * Removes job from disk
         * @param {Job} job
         */
        this.removeJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            this.deleteJobFromDisk(job);
        };
        /**
         * Moves job to archive directory
         * @param {Job} job
         */
        this.archiveJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            this.moveJobToArchive(job);
        };
        this.runTask = async (jobType, jobStatus, task, chunkSize) => {
            const jobs = await this.queryJobs(jobType, jobStatus, chunkSize);
            let index = 0;
            let jobForError = null;
            for (const job of jobs) {
                try {
                    jobForError = job;
                    await task(this, job, index, jobs);
                }
                catch (err) {
                    console.log(err);
                    if (!jobForError) {
                        continue;
                    }
                    if (err instanceof Error) {
                        jobForError.setError(err.name, err.message, serializeSircular(err.stack));
                    }
                    else {
                        jobForError.setError('UnknownError', serializeSircular(err), '');
                    }
                }
            }
        };
        this.jobs = [];
        JobService.rootDir = JobService.rootDir || rootDir;
        JobService.archiveDir = JobService.archiveDir || archiveDir;
        fs.mkdirSync(JobService.rootDir, { recursive: true });
        fs.mkdirSync(JobService.archiveDir, { recursive: true });
    }
}
JobService.rootDir = '';
JobService.archiveDir = '';
JobService.setRootDir = (rootDir) => {
    JobService.rootDir = rootDir;
    fs.mkdirSync(JobService.rootDir, { recursive: true });
};
JobService.setArchiveDir = (archiveDir) => {
    JobService.archiveDir = archiveDir;
    fs.mkdirSync(JobService.archiveDir, { recursive: true });
};

exports.Job = Job;
exports.JobService = JobService;
