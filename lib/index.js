import { glob } from 'fast-glob';
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs';
import { serializeError } from './utils.js';
/**
 * Static class to manage jobs on disk and in memory
 */
export class JobService {
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir = './jobs', archiveDir = './jobs/archive') {
        this.jobs = [];
        this.createJob = async (id, type, meta = {}, overwrite = true) => {
            const job = new Job(id, type, meta);
            this.jobs.push(job);
            JobService.writeJobToDisk(job, overwrite);
            return job;
        };
        /**
         * Loads all jobs from file system
         */
        this.loadJobs = async () => {
            const files = await glob(`${JobService.rootDir}/*.json`, { ignore: ['node_modules/**'] });
            for (const file of files) {
                this.jobs.push(new Job().deserialize(readFileSync(file, 'utf8')));
            }
            this.jobs.sort((a, b) => a.id.localeCompare(b.id));
        };
        /**
         * Returns all jobs, loading from file system if not already loaded
         */
        this.getAllJobs = async () => {
            if (!this.jobs.length) {
                await this.loadJobs();
            }
            return this.jobs;
        };
        /**
         * Returns all jobs with status, loading from file system if not already loaded
         */
        this.queryJobs = async (type, status, chunkSize = null) => {
            const jobs = await this.getAllJobs();
            const filtered = jobs.filter((job) => {
                const jobType = job.type;
                const currentStatus = job.statuses.slice(-1)[0];
                return jobType === type && currentStatus.status === status;
            });
            if (chunkSize) {
                return filtered.slice(0, chunkSize);
            }
            return filtered;
        };
        /**
         * Returns job by id, loading from file system if not already loaded
         * @param {String} id
         * @returns {Job}
         */
        this.getJobById = async (id) => {
            const jobs = await this.getAllJobs();
            return jobs.find((job) => job.id === id);
        };
        /**
         * Removes job from disk
         * @param {Job} job
         */
        this.removeJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            JobService.removeFileFromDisk(job);
        };
        /**
         * Moves job to archive directory
         * @param {Job} job
         */
        this.archiveJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            job.setMeta({ archivedAt: new Date().toISOString() });
            JobService.moveJobToArchive(job);
        };
        this.processJobs = async (jobType, jobStatus, handler, chunkSize = null) => {
            const jobs = await this.queryJobs(jobType, jobStatus, chunkSize);
            let index = 0;
            let jobForError = null;
            for (const job of jobs) {
                try {
                    jobForError = job;
                    await handler(job, index, jobs);
                }
                catch (err) {
                    if (!jobForError) {
                        continue;
                    }
                    jobForError.error = { isError: true, message: serializeError(err) };
                }
            }
        };
        this.jobs = [];
        JobService.rootDir = JobService.rootDir || rootDir;
        JobService.archiveDir = JobService.archiveDir || archiveDir;
        mkdirSync(JobService.rootDir, { recursive: true });
        mkdirSync(JobService.archiveDir, { recursive: true });
    }
}
JobService.rootDir = '';
JobService.archiveDir = '';
JobService.setRootDir = (rootDir) => {
    JobService.rootDir = rootDir;
    mkdirSync(JobService.rootDir, { recursive: true });
};
JobService.setArchiveDir = (archiveDir) => {
    JobService.archiveDir = archiveDir;
    mkdirSync(JobService.archiveDir, { recursive: true });
};
JobService.writeJobToDisk = (job, overwrite = true) => {
    const fileName = `${JobService.rootDir}/${job.id}.json`;
    if (!overwrite) {
        const exists = existsSync(fileName);
        if (exists) {
            return;
        }
    }
    writeFileSync(fileName, job.serialize());
};
JobService.removeFileFromDisk = (job) => {
    unlinkSync(`${JobService.rootDir}/${job.id}.json`);
};
JobService.moveJobToArchive = (job) => {
    renameSync(`${JobService.rootDir}/${job.id}.json`, `${JobService.archiveDir}/${job.id}.json`);
};
class Job {
    constructor(id = null, type = null, meta = {}, statuses = [], log = [], createdAt = null, updatedAt = null, error = { isError: false, message: '' }) {
        this.id = '';
        this.type = '';
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.meta = {};
        this.statuses = [];
        this.log = [];
        this.error = { isError: false, message: '' };
        /**
         * Updates jobs status with message and writes to disk
         */
        this.setStatus = (status, message = '') => {
            this.updatedAt = new Date().toISOString();
            this.statuses.push({ status, message, createdAt: new Date().toISOString() });
            if (!Job.simulate) {
                JobService.writeJobToDisk(this);
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
                JobService.writeJobToDisk(this);
            }
            return this;
        };
        const ts = new Date();
        this.id = id || ts.getTime().toString();
        this.type = type || 'job';
        const iso = ts.toISOString();
        this.createdAt = createdAt || iso;
        this.updatedAt = updatedAt || iso;
        this.meta = meta || {};
        this.statuses = statuses || [{ status: 'initialized', createdAt: iso, message: '' }];
        this.log = log || [];
        this.error = error || { isError: false, message: '' };
        return this;
    }
    serialize() {
        return JSON.stringify(this);
    }
    deserialize(json) {
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
    /**
     * Writes to jobs log and updates job on disk
     */
    writeToLog(messages) {
        console.log(...arguments);
        if (!Job.simulate) {
            messages = Object.values(arguments);
            this.log.push({ ts: new Date().toISOString(), message: messages.join(' ') });
            JobService.writeJobToDisk(this);
        }
    }
    setError(error) {
        this.error = { isError: true, message: serializeError(error) };
    }
}
/**
 * @description If true, job changes will not be written to disk
 */
Job.simulate = false;
//# sourceMappingURL=index.js.map