import { glob } from 'fast-glob'
import { mkdirSync, existsSync, writeFileSync, unlinkSync, renameSync, readFileSync } from 'fs'

/**
 * Static class to manage jobs on disk and in memory
 */
export class JobService {
  jobs: Job[] = []

  static rootDir: string = ''
  static archiveDir: string = ''

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

  static writeJobToDisk = (job: Job, overwrite: boolean = true) => {
    const fileName = `${JobService.rootDir}/${job.id}.json`
    if (!overwrite) {
      const exists = existsSync(fileName)
      if (exists) {
        return
      }
    }
    writeFileSync(fileName, job.serialize())
  }

  static removeFileFromDisk = (job: Job) => {
    unlinkSync(`${JobService.rootDir}/${job.id}.json`)
  }

  static moveJobToArchive = (job: Job) => {
    renameSync(`${JobService.rootDir}/${job.id}.json`, `${JobService.archiveDir}/${job.id}.json`)
  }

  createJob = async (id: string, type: string, meta: JobMeta = {}, overwrite = true) => {
    const job = new Job(id,type,  meta)
    this.jobs.push(job)
    JobService.writeJobToDisk(job, overwrite)
    return job
  }

  /**
   * Loads all jobs from file system
   */
  loadJobs = async () => {
    const files = await glob(`${JobService.rootDir}/*.json`, { ignore: ['node_modules/**'] })
    for (const file of files) {
      this.jobs.push(new Job().deserialize(readFileSync(file, 'utf8')))
    }
    this.jobs.sort((a, b) => a.id.localeCompare(b.id))
  }

  /**
   * Returns all jobs, loading from file system if not already loaded
   */
  getAllJobs = async () => {
    if (!this.jobs.length) {
      await this.loadJobs()
    }
    return this.jobs
  }

  /**
   * Returns all jobs with status, loading from file system if not already loaded
   */
  getJobsByStatus = async (status: string) => {
    const jobs = await this.getAllJobs()
    return jobs.filter((job) => {
      const currentStatus = job.statuses.slice(-1)[0]
      return currentStatus.status === status
    })
  }

  /**
   * Returns job by id, loading from file system if not already loaded
   * @param {String} id
   * @returns {Job}
   */
  getJobById = async (id: string) => {
    const jobs = await this.getAllJobs()
    return jobs.find((job) => job.id === id)
  }

  /**
   * Removes job from disk
   * @param {Job} job
   */
  removeJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    JobService.removeFileFromDisk(job)
  }

  /**
   * Moves job to archive directory
   * @param {Job} job
   */
  archiveJob = (job: Job) => {
    this.jobs = this.jobs.filter((j) => j.id !== job.id)
    job.setMeta({ archivedAt: new Date().toISOString() })
    JobService.moveJobToArchive(job)
  }
}

type JobStatus = {
  status: string
  createdAt: string
  message: string
}

type JobMeta = Record<string, any>

type LogEntry = {
  ts: string,
  message: string
}

class Job {
  id: string = ''
  type: string = ''
  createdAt: string = new Date().toISOString()
  updatedAt: string = new Date().toISOString()
  meta: Record<string, any> = {}
  statuses: JobStatus[] = []
  log: LogEntry[] = []

  /**
   * @description If true, job changes will not be written to disk
   */
  static simulate: boolean = false

  constructor(
    id: string | null = null,
    type: string | null = null,
    meta: Record<string, any> = {},
    statuses: JobStatus[] | null = [],
    log: LogEntry[] | null = [],
    createdAt: string | null = null,
    updatedAt: string | null = null,
  ) {
    const ts = new Date()
    this.id = id || ts.getTime().toString()
    this.type = type || 'job'
    const iso = ts.toISOString()
    this.createdAt = createdAt || iso
    this.updatedAt = updatedAt || iso
    this.meta = meta || {}
    this.statuses = statuses || [{ status: 'initialized', createdAt: iso, message: '' }]
    this.log = log || []
    return this
  }

  serialize() {
    return JSON.stringify(this)
  }

  deserialize(json: string) {
    const job = JSON.parse(json)
    this.id = job.id
    this.type = job.type
    this.createdAt = job.createdAt
    this.updatedAt = job.updatedAt
    this.meta = job.meta
    this.statuses = job.statuses
    this.log = job.log
    return this
  }

  /**
   * Updates jobs status with message and writes to disk
   */
  setStatus = (status: string, message: string = '') => {
    this.updatedAt = new Date().toISOString()
    this.statuses.push({ status, message, createdAt: new Date().toISOString() })
    if (!Job.simulate) {
      JobService.writeJobToDisk(this)
    }
    return this
  }

  /**
   * Combines meta with existing meta and writes to disk
   */
  setMeta = (meta: JobMeta) => {
    this.updatedAt = new Date().toISOString()
    this.meta = { ...this.meta, ...meta }
    if (!Job.simulate) {
      JobService.writeJobToDisk(this)
    }
    return this
  }

  /**
   * Writes to jobs log and updates job on disk
   */
  writeToLog(messages: string | string[]) {
    console.log(...arguments)
    if (!Job.simulate) {
      messages = Object.values(arguments)
      this.log.push({ ts: new Date().toISOString(), message: messages.join(' ') })
      JobService.writeJobToDisk(this)
    }
  }
}
