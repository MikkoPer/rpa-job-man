import pkg from 'fast-glob';
const { glob } = pkg;
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs';
import { serializeSircular } from './utils.js';
import { Job } from './Job.js';
export var WriteResult;
(function (WriteResult) {
    WriteResult[WriteResult["Create"] = 0] = "Create";
    WriteResult[WriteResult["Read"] = 1] = "Read";
    WriteResult[WriteResult["Update"] = 2] = "Update";
    WriteResult[WriteResult["Delete"] = 3] = "Delete";
    WriteResult[WriteResult["Fail"] = 4] = "Fail";
    WriteResult[WriteResult["Skip"] = 5] = "Skip";
})(WriteResult || (WriteResult = {}));
/**
 * Static class to manage jobs on disk and in memory
 */
export class Service {
    /**
     * Initializes job service with given root and archive directories
     */
    constructor(rootDir = './jobs', archiveDir = './jobs/archive') {
        this.jobs = [];
        this.createJob = async (id, type, meta = {}) => {
            const job = new Job(this, id, type, meta);
            this.jobs.push(job);
            const writeResult = Service.writeJobToDisk(job, true);
            return { job, writeResult: WriteResult.Create };
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
                return { job, writeResult: WriteResult.Read };
            }
            const fileName = Service.getJobFileName({ id, type });
            if (existsSync(fileName)) {
                const job = new Job(this).fromJSON(readFileSync(fileName, 'utf8'));
                this.jobs.push(job);
                return { job, writeResult: WriteResult.Read };
            }
            return { job: new Job(this), writeResult: WriteResult.Fail };
        };
        /**
         * Removes job from disk
         * @param {Job} job
         */
        this.removeJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            Service.removeFileFromDisk(job);
        };
        /**
         * Moves job to archive directory
         * @param {Job} job
         */
        this.archiveJob = (job) => {
            this.jobs = this.jobs.filter((j) => j.id !== job.id);
            job.setMeta({ archivedAt: new Date().toISOString() });
            Service.moveJobToArchive(job);
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
Service.getJobFileName = (job) => `${Service.rootDir}/${job.type}-${job.id}.json`;
Service.getJobArchiveFileName = (job) => `${Service.archiveDir}/${job.type}-${job.id}.json`;
Service.setRootDir = (rootDir) => {
    Service.rootDir = rootDir;
    mkdirSync(Service.rootDir, { recursive: true });
};
Service.setArchiveDir = (archiveDir) => {
    Service.archiveDir = archiveDir;
    mkdirSync(Service.archiveDir, { recursive: true });
};
Service.writeJobToDisk = (job, overwrite) => {
    const fileName = Service.getJobFileName(job);
    const exists = existsSync(fileName);
    if (!overwrite && exists) {
        return WriteResult.Skip;
    }
    writeFileSync(fileName, job.toJSON());
    return exists ? WriteResult.Update : WriteResult.Create;
};
Service.removeFileFromDisk = (job) => {
    const fileName = Service.getJobFileName(job);
    unlinkSync(fileName);
    return WriteResult.Delete;
};
Service.moveJobToArchive = (job) => {
    const fileName = Service.getJobFileName(job);
    const archiveFileName = Service.getJobArchiveFileName(job);
    renameSync(fileName, archiveFileName);
    return WriteResult.Update;
};
//# sourceMappingURL=Service.js.map