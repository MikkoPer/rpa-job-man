import { Service } from './Service.js'

export type JobStatus = { status: string, createdAt: string, message: string }
export type JobMeta = Record<string, any>
export type LogEntry = { ts: string, message: string }
export type JobError = { name: string, message: string, stack: string }
export type NoError = null

export class Job {
  service: Service
  id: string = ''
  type: string = ''
  createdAt: string = new Date().toISOString()
  updatedAt: string = new Date().toISOString()
  meta: Record<string, any> = {}
  statuses: JobStatus[] = []
  log: LogEntry[] = []
  error: JobError | NoError

  /**
   * @description If true, job changes will not be written to disk
   */
  static simulate: boolean = false

  constructor(
    service: Service,
    id: string | null = null,
    type: string | null = null,
    meta: Record<string, any> = {},
    statuses?: JobStatus[],
    log?: LogEntry[],
    createdAt?: string,
    updatedAt?: string,
    error?: JobError
  ) {
    this.service = service
    const ts = new Date()
    this.id = id || ts.getTime().toString()
    this.type = type || 'job'
    const iso = ts.toISOString()
    this.createdAt = createdAt || iso
    this.updatedAt = updatedAt || iso
    this.meta = meta || {}
    this.statuses = statuses || [{ status: 'initialized', createdAt: iso, message: '' }]
    this.log = log || []
    this.error = error || null
    return this
  }

  toJSON(): string {
    const { id, type, createdAt, updatedAt, meta, statuses, log, error } = this
    return JSON.stringify({
      id,
      type,
      createdAt,
      updatedAt,
      meta,
      statuses,
      log,
      error,
    })
  }

  fromJSON(json: string) {
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

  getJobService() {
    return this.service
  }

  getId() {
    return this.id
  }

  getType() {
    return this.type
  }

  getStatus() {
    return this.statuses.slice(-1)[0].status
  }

  getStatusMessage() {
    return this.statuses.slice(-1)[0].message
  }

  getMeta(): JobMeta {
    return this.meta
  }

  /**
   * Updates jobs status with message and writes to disk
   */
  setStatus = (status: string, message: string = '') => {
    this.updatedAt = new Date().toISOString()
    this.statuses.push({ status, message, createdAt: new Date().toISOString() })
    if (!Job.simulate) {
      Service.writeJobToDisk(this, true)
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
      Service.writeJobToDisk(this, true)
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
      Service.writeJobToDisk(this, true)
    }
  }

  setError(name: string, message: string, stack: string) {
    this.error = { name, message, stack }
    Service.writeJobToDisk(this, true)
  }

  clearError() {
    this.error = null
    Service.writeJobToDisk(this, true)
  }
}
