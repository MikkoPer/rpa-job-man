import pkg from 'fast-glob';
const { glob } = pkg;
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs';
import { serializeSircular } from './utils.js';
import { MetaJob } from './Job.js';
export class Job extends MetaJob {
    constructor(service, id = null, type = null, meta = {}, status, message, log, createdAt, updatedAt, error) {
        super(id, type, meta, status, message, log, createdAt, updatedAt, error);
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
export class Service {
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir = './jobs', archiveDir = './jobs/archive') {
        this.jobs = [];
        this.getJobFileName = (job) => `${Service.rootDir}/${job.type}-${job.id}.json`;
        this.getJobArchiveFileName = (job) => `${Service.archiveDir}/${job.type}-${job.id}.json`;
        this.writeJobToDisk = (job, overwrite) => {
            const fileName = this.getJobFileName(job);
            const exists = existsSync(fileName);
            if (!overwrite && exists) {
                return 'skip';
            }
            writeFileSync(fileName, job.toJSON());
            return exists
                ? 'update'
                : 'create';
        };
        this.deleteJobFromDisk = (job) => {
            const fileName = this.getJobFileName(job);
            unlinkSync(fileName);
        };
        this.moveJobToArchive = (job) => {
            const fileName = this.getJobFileName(job);
            const archiveFileName = this.getJobArchiveFileName(job);
            renameSync(fileName, archiveFileName);
        };
        this.createJob = (id, type, meta) => {
            const job = new Job(this, id, type, meta);
            this.jobs.push(job);
            this.writeJobToDisk(job, true);
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
            const files = await glob(`${Service.rootDir}/*.json`, { ignore: ['node_modules/**'] });
            for (const file of files) {
                this.jobs.push(new Job(this).fromJSON(readFileSync(file, 'utf8')));
            }
            this.jobs.sort((a, b) => a.id.localeCompare(b.id));
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
            const fileName = this.getJobFileName(new Job(this, id, type));
            if (existsSync(fileName)) {
                const job = new Job(this).fromJSON(readFileSync(fileName, 'utf8'));
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
        Service.rootDir = Service.rootDir || rootDir;
        Service.archiveDir = Service.archiveDir || archiveDir;
        mkdirSync(Service.rootDir, { recursive: true });
        mkdirSync(Service.archiveDir, { recursive: true });
    }
}
Service.rootDir = '';
Service.archiveDir = '';
Service.setRootDir = (rootDir) => {
    Service.rootDir = rootDir;
    mkdirSync(Service.rootDir, { recursive: true });
};
Service.setArchiveDir = (archiveDir) => {
    Service.archiveDir = archiveDir;
    mkdirSync(Service.archiveDir, { recursive: true });
};
//# sourceMappingURL=Service.js.map