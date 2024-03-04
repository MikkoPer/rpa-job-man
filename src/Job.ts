export type JobStatus = { status: string, createdAt: string, message: string }
export type JobMeta = Record<string, any>
export type LogEntry = { ts: string, message: string }
export type JobError = { name: string, message: string, stack: string }
export type NoError = null

export type MetaType = Record<string, any>

export class MetaJob {
  id: string = ''
  type: string = ''
  createdAt: string = new Date().toISOString()
  updatedAt: string = new Date().toISOString()
  meta: MetaType = {}
  status: String = 'initialized'
  message: String = ''
  log: LogEntry[] = []
  error: JobError | NoError

  constructor(
    id: string | null = null,
    type: string | null = null,
    meta: MetaType = {},
    status?: string,
    message?: string,
    log?: LogEntry[],
    createdAt?: string,
    updatedAt?: string,
    error?: JobError
  ) {
    const ts = new Date()
    this.id = id || ts.getTime().toString()
    this.type = type || 'job'
    const iso = ts.toISOString()
    this.createdAt = createdAt || iso
    this.updatedAt = updatedAt || iso
    this.meta = meta
    this.status = status || 'initialized'
    this.message = message || ''
    this.log = log || []
    this.error = error || null
    return this
  }

  toJSON(): string {
    const { id, type, createdAt, updatedAt, meta, status, log, error } = this
    return JSON.stringify({
      id,
      type,
      createdAt,
      updatedAt,
      meta,
      status,
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
    this.status = job.status
    this.log = job.log
    return this
  }

  getId() {
    return this.id
  }

  getType() {
    return this.type
  }

  getStatus() {
    return this.status
  }

  getStatusMessage() {
    return this.message
  }

  getMeta() {
    return this.meta
  }

  /**
   * Updates jobs status with message and writes to disk
   */
  setStatus(status: string, message: string = '') {
    this.updatedAt = new Date().toISOString()
    this.status = status
    this.message = message
    return this
  }

  /**
   * Combines meta with existing meta and writes to disk
   */
  setMeta (meta: MetaType) {
    this.updatedAt = new Date().toISOString()
    if (Object(meta) === meta) {
      this.meta = { ...this.meta, ...meta }
    } else {
      this.meta = meta
    }
    return this
  }

  /**
   * Writes to jobs log and updates job on disk
   */
  writeToLog(messages: string | string[]) {
    console.log(...arguments)
    messages = Object.values(arguments)
    this.log.push({ ts: new Date().toISOString(), message: messages.join(' ') })
  }

  setError(name: string, message: string, stack: string) {
    this.error = { name, message, stack }
    return this
  }

  clearError() {
    this.error = null
    return this
  }
}
