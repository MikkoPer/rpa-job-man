import pkg from 'fast-glob';
const { glob } = pkg;
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs';
import { serializeCircular } from './utils.js';
import { MetaJob } from './Job.js';
export class Job extends MetaJob {
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
    writeToLog(message) {
        super.writeToLog(message);
        this.service.writeJobToDisk(this, true);
        return this;
    }
    writeToLogSilent(...args) {
        super.writeToLogSilent(...args);
        this.service.writeJobToDisk(this, true);
    }
}
/**
 * Static class to manage jobs on disk and in memory
 */
export class JobService {
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir = './jobs', archiveDir = './jobs/archive') {
        this.jobs = [];
        this.getJobFileName = (job) => `${JobService.rootDir}/${job.type}-${job.id}.json`;
        this.getJobArchiveFileName = (job) => `${JobService.archiveDir}/${job.type}-${job.id}.json`;
        this.writeJobToDisk = (job, overwrite) => {
            const fileName = this.getJobFileName(job);
            const exists = existsSync(fileName);
            if (!overwrite && exists) {
                return job;
            }
            writeFileSync(fileName, job.toJSON());
            return job;
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
        this.createJob = (init, overwrite = false) => {
            const existing = this.jobs.find((job) => job.id === init.id && job.type === init.type);
            if (!overwrite && existing) {
                return existing;
            }
            const job = new Job(this, init);
            this.jobs.push(job);
            this.writeJobToDisk(job, overwrite);
            return job;
        };
        /**
         * Returns all jobs, loading from file system if not already loaded
         * @param {Boolean} updateCache
         */
        this.fetchJobs = async (updateCache = true) => {
            if (this.jobs.length && !updateCache) {
                return this.jobs;
            }
            this.jobs = [];
            const files = await glob(`${JobService.rootDir}/*.json`, { ignore: ['node_modules/**'] });
            for (const file of files) {
                this.jobs.push(new Job(this).fromJSON(readFileSync(file, 'utf8')));
            }
            this.jobs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
            return this.jobs;
        };
        /**
         * Returns all jobs matching the type and status, loading from file system if not already loaded
         */
        this.queryJobs = async (parms) => {
            const { type, status, chunkSize } = parms;
            const jobs = await this.fetchJobs();
            const filtered = jobs.filter((job) => {
                const jobType = job.type;
                let doesJobTypeMatch = false;
                if (!type) {
                    doesJobTypeMatch = true;
                }
                else if (Array.isArray(type)) {
                    doesJobTypeMatch = type.includes(jobType);
                }
                else {
                    doesJobTypeMatch = jobType === type;
                }
                const jobStatus = job.getStatus();
                let doesJobStatusMatch = false;
                if (!status) {
                    doesJobStatusMatch = true;
                }
                else if (Array.isArray(status)) {
                    doesJobStatusMatch = status.includes(jobStatus);
                }
                else {
                    doesJobStatusMatch = jobStatus === status;
                }
                return doesJobTypeMatch && doesJobStatusMatch;
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
        this.getJob = async (type, id) => {
            const jobs = await this.fetchJobs(false);
            const job = jobs.find((job) => job.id === id && job.type === type);
            if (job) {
                return job;
            }
            const fileName = this.getJobFileName(new Job(this, { type, id }));
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
        this.runSingleTask = async (parms) => {
            const { id, type, meta, task } = parms;
            const job = new Job(this, { id, type, meta });
            try {
                await task(this, job, 0, []);
                return { passed: [job], failed: [] };
            }
            catch (err) {
                console.log(err);
                if (err instanceof Error) {
                    job.setError(err.name, err.message, serializeCircular(err.stack));
                }
                else {
                    job.setError('UnknownError', serializeCircular(err), '');
                }
                return { passed: [], failed: [job] };
            }
        };
        this.runTask = async (parms) => {
            const passed = [];
            const failed = [];
            const { type, status, task, chunkSize } = parms;
            const jobs = await this.queryJobs({ type, status, chunkSize });
            let index = 0;
            for (const job of jobs) {
                try {
                    await task(this, job, index, jobs);
                    passed.push(job);
                }
                catch (err) {
                    console.log(err);
                    if (err instanceof Error) {
                        job.setError(err.name, err.message, serializeCircular(err.stack));
                    }
                    else {
                        job.setError('UnknownError', serializeCircular(err), '');
                    }
                    failed.push(job);
                }
            } // END iterate over jobs
            return { passed, failed };
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
//# sourceMappingURL=JobService.js.map