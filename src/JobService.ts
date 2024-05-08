import pkg from 'fast-glob'
const { glob } = pkg
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs'
import { serializeSircular } from './utils.js'
import { MetaJob } from './Job.js'
import type { MetaType, MetaJobInit } from './Job.js'
import type { Task } from './Task.js'

export class Job extends MetaJob {
  service: JobService
  constructor(
    service: JobService,
    init?: MetaJobInit
  ) {
    super(init || {})
    this.service = service
  }

  setMeta(meta: MetaType) {
    const job = super.setMeta(meta)
    this.service.writeJobToDisk(job, true)
    return job
  }

  setStatus(status: string, message?: string): this {
    const job = super.setStatus(status, message)
    this.service.writeJobToDisk(job, true)
    return job
  }

  setError(name: string, message: string, stack: string) {
    const job = super.setError(name, message, stack)
    this.service.writeJobToDisk(this, true)
    return job
  }

  clearError(): this {
    const job = super.clearError()
    this.service.writeJobToDisk(this, true)
    return job
  }
  
  writeToLog(message: string, silent: boolean = false) {
    super.writeToLog(message, silent)
    this.service.writeJobToDisk(this, true)
    return this
  }
}

/**
 * Static class to manage jobs on disk and in memory
 */
export class JobService {
  jobs: Job[] = []

  static rootDir: string = ''
  static archiveDir: string = ''
  getJobFileName = (job: Job) => `${JobService.rootDir}/${job.type}-${job.id}.json`
  getJobArchiveFileName = (job: Job) => `${JobService.archiveDir}/${job.type}-${job.id}.json`
  /**
   * Initializes job service with given root and archive directories
   */
  constructor(rootDir: string = './jobs', archiveDir: string = './jobs/archive') {
    this.jobs = []
    JobService.rootDir = JobService.rootDir || rootDir
    JobService.archiveDir = JobService.archiveDir || archiveDir
    mkdirSync(JobService.rootDir, { recursive: true })
    mkdirSync(JobService.archiveDir, { recursive: true })
  }

  static setRootDir = (rootDir: string) => {
    JobService.rootDir = rootDir
    mkdirSync(JobService.rootDir, { recursive: true })
  }

  static setArchiveDir = (archiveDir: string) => {
    JobService.archiveDir = archiveDir
    mkdirSync(JobService.archiveDir, { recursive: true })
  }

  writeJobToDisk = (job: Job, overwrite?: boolean): Job => {
    const fileName = this.getJobFileName(job)
    const exists = existsSync(fileName)
    if (!overwrite && exists) {
      return job
    }
    writeFileSync(fileName, job.toJSON())
    return job
  }

  deleteJobFromDisk = (job: Job) => {
    const fileName = this.getJobFileName(job)
    unlinkSync(fileName)
  }

  moveJobToArchive = (job: Job) => {
    const fileName = this.getJobFileName(job)
    const archiveFileName = this.getJobArchiveFileName(job)
    renameSync(fileName, archiveFileName)
  }

  createJob = (init: MetaJobInit, overwrite: boolean = false) => {
    const existing = this.jobs.find((job) => job.id === init.id && job.type === init.type)
    if (!overwrite && existing) {
      return existing
    }
    const job = new Job(this, init)
    this.jobs.push(job)
    this.writeJobToDisk(job, overwrite)
    return job
  }

  /**
   * Returns all jobs, loading from file system if not already loaded
   * @param {Boolean} updateCache
   */
  fetchJobs = async (updateCache: boolean = true) => {
    if (this.jobs.length && !updateCache) {
      return this.jobs
    }
    this.jobs = []
    const files = await glob(`${JobService.rootDir}/*.json`, { ignore: ['node_modules/**'] })
    for (const file of files) {
      this.jobs.push(new Job(this).fromJSON(readFileSync(file, 'utf8')))
    }
    this.jobs.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    return this.jobs
  }

  /**
   * Returns all jobs matching the type and status, loading from file system if not already loaded
   */
  queryJobs = async (
    parms: {
      type?: string | Array<string>,
      status?: string | Array<string>,
      chunkSize?: number
    }) => {
    const { type, status, chunkSize } = parms
    const jobs = await this.fetchJobs()
    const filtered = jobs.filter((job) => {
      const jobType = job.type
      let doesJobTypeMatch = false
      if (!type) {
        doesJobTypeMatch = true
      } else if (Array.isArray(type)) {
        doesJobTypeMatch = type.includes(jobType)
      } else {
        doesJobTypeMatch = jobType === type
      }

      const jobStatus = job.getStatus()
      let doesJobStatusMatch = false
      if (!status) {
        doesJobStatusMatch = true
      } else if (Array.isArray(status)) {
        doesJobStatusMatch = status.includes(jobStatus)
      } else {
        doesJobStatusMatch = jobStatus === status
      }
      return doesJobTypeMatch && doesJobStatusMatch
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
  getJob = async (type: string, id: string): Promise<Job | null> => {
    const jobs = await this.fetchJobs(false)
    const job = jobs.find((job) => job.id === id && job.type === type)
    if (job) {
      return job
    }
    const fileName = this.getJobFileName(new Job(this, { type, id }))
    if (existsSync(fileName)) {
      const job = new Job(this).fromJSON(readFileSync(fileName, 'utf8'))
      this.jobs.push(job)
      return job
    }
    return null
  }

  /**
   * Removes job from disk
   * @param {Job} job
   */
  removeJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    this.deleteJobFromDisk(job)
  }

  /**
   * Moves job to archive directory
   * @param {Job} job
   */
  archiveJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    this.moveJobToArchive(job)
  }

  runTask = async (
    parms: {
      type?: string | Array<string>,
      status?: string | Array<string>,
      task: Task,
      chunkSize?: number
    }) => {
    const { type, status, task, chunkSize } = parms
    const jobs = await this.queryJobs({ type, status, chunkSize })
    let index = 0
    let jobForError: Job | null = null
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