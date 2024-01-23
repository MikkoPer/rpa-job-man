import pkg from 'fast-glob'
const { glob } = pkg
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs'
import { serializeSircular } from './utils.js'
import { Job } from './Job.js'
import type { JobMeta } from './Job.js'
import type { Task } from './Task.js'

export enum WriteResult { Create, Read, Update, Delete, Fail, Skip }
type JobResult = { job: Job }
export type CreateJobResult = JobResult & { writeResult: WriteResult.Create | WriteResult.Skip | WriteResult.Fail }
export type ReadJobResult = JobResult & { writeResult: WriteResult.Read | WriteResult.Fail }
export type UpdateJobResult = JobResult & { writeResult: WriteResult.Update | WriteResult.Fail }
export type DeleteJobResult = JobResult & { writeResult: WriteResult.Delete | WriteResult.Fail }
export type FetchJobResult = ReadJobResult & { count: number }

type JobArgument = Job | { id: string, type: string }

/**
 * Static class to manage jobs on disk and in memory
 */
export class Service {
  jobs: Job[] = []

  static rootDir: string = ''
  static archiveDir: string = ''
  static getJobFileName = (job: JobArgument) => `${Service.rootDir}/${job.type}-${job.id}.json`
  static getJobArchiveFileName = (job: JobArgument) => `${Service.archiveDir}/${job.type}-${job.id}.json`
  /**
   * Initializes job service with given root and archive directories
   */
  constructor(rootDir: string = './jobs', archiveDir: string = './jobs/archive') {
    this.jobs = []
    Service.rootDir = Service.rootDir || rootDir
    Service.archiveDir = Service.archiveDir || archiveDir
    mkdirSync(Service.rootDir, { recursive: true })
    mkdirSync(Service.archiveDir, { recursive: true })
  }

  static setRootDir = (rootDir: string) => {
    Service.rootDir = rootDir
    mkdirSync(Service.rootDir, { recursive: true })
  }

  static setArchiveDir = (archiveDir: string) => {
    Service.archiveDir = archiveDir
    mkdirSync(Service.archiveDir, { recursive: true })
  }

  static writeJobToDisk = (job: Job, overwrite?: boolean): WriteResult.Skip | WriteResult.Update | WriteResult.Create => {
    const fileName = Service.getJobFileName(job)
    const exists = existsSync(fileName)
    if (!overwrite && exists) {
      return WriteResult.Skip
    }
    writeFileSync(fileName, job.toJSON())
    return exists ? WriteResult.Update :  WriteResult.Create
  }

  static removeFileFromDisk = (job: Job): WriteResult.Delete | WriteResult.Fail => {
    const fileName = Service.getJobFileName(job)
    unlinkSync(fileName)
    return WriteResult.Delete
  }

  static moveJobToArchive = (job: Job): WriteResult.Update | WriteResult.Fail => {
    const fileName = Service.getJobFileName(job)
    const archiveFileName = Service.getJobArchiveFileName(job)
    renameSync(fileName, archiveFileName)
    return WriteResult.Update
  }

  createJob = async (id: string, type: string, meta: JobMeta = {}): Promise<CreateJobResult> => {
    const job = new Job(this, id, type,  meta)
    this.jobs.push(job)
    const writeResult = Service.writeJobToDisk(job, true)
    return { job, writeResult: WriteResult.Create }
  }

  /**
   * Returns all jobs, loading from file system if not already loaded
   * @param {Boolean} updateCache
   */
  fetchJobs = async (updateCache: false) => {
    if (this.jobs.length && !updateCache) {
      return this.jobs
    }

    const files = await glob(`${Service.rootDir}/*.json`, { ignore: ['node_modules/**'] })
    for (const file of files) {
      this.jobs.push(new Job(this).fromJSON(readFileSync(file, 'utf8')))
    }
    this.jobs.sort((a, b) => a.id.localeCompare(b.id))
    return this.jobs
  }

  /**
   * Returns all jobs matching the type and status, loading from file system if not already loaded
   */
  queryJobs = async (type: string, status: string, chunkSize?: number) => {
    const jobs = await this.fetchJobs(false)
    const filtered = jobs.filter((job) => {
      const jobType = job.type
      const currentStatus = job.getStatus()
      return jobType === type && currentStatus === status
    })
    if (chunkSize) {
      return filtered.slice(0, chunkSize)
    }
    return filtered
  }

  /**
   * Returns job by type and id, loading from file system if not already loaded
   * @param {String} id
   * @returns {Job}
   */
  getJob = async (id: string, type: string): Promise<ReadJobResult> => {
    const jobs = await this.fetchJobs(false)
    const job = jobs.find((job) => job.id === id && job.type === type)
    if (job) {
      return { job, writeResult: WriteResult.Read } 
    }
    const fileName = Service.getJobFileName({ id, type })
    if (existsSync(fileName)) {
      const job = new Job(this).fromJSON(readFileSync(fileName, 'utf8'))
      this.jobs.push(job)
      return { job, writeResult: WriteResult.Read }
    }
    return { job: new Job(this), writeResult: WriteResult.Fail }
  }

  /**
   * Removes job from disk
   * @param {Job} job
   */
  removeJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    Service.removeFileFromDisk(job)
  }

  /**
   * Moves job to archive directory
   * @param {Job} job
   */
  archiveJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    job.setMeta({ archivedAt: new Date().toISOString() })
    Service.moveJobToArchive(job)
  }

  runTask = async (
    jobType: string,
    jobStatus: string,
    task: Task,
    chunkSize?: number
    ) => {
    const jobs = await this.queryJobs(jobType, jobStatus, chunkSize)
    let index = 0
    let jobForError = null
    for (const job of jobs) {
      try {
        jobForError = job
        await task(this, job, index, jobs)
      } catch (err) {
        console.log(err)
        if (!jobForError) {
          continue
        }
        if (err instanceof Error) {
          jobForError.setError(
            err.name,
            err.message,
            serializeSircular(err.stack)
          )
        } else {
          jobForError.setError(
            'UnknownError',
            serializeSircular(err),
            ''
          )
        }
      }
    }
  }
}