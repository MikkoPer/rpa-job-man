import { Service, WriteResult } from '../index.js';
import type { CreateJobResult } from '../index.js';
import type { Task } from '../index.js';

const generator: Task = async (service, job) => {
  const meta = job.getMeta()
  if (!meta.count) {
    return
  }
  if (isNaN(meta.count)) {
    return
  }
  job.writeToLog('# Generating child jobs')

  for (let i = 0; i < meta.count; i++) {
    const id = String(i).padStart(2, '0')
    const type = 'job'
    const result = await service.createJob(id, type, { index: i })
    if (result.writeResult === WriteResult.Skip) {
      job.writeToLog('Child job already exists, skipping')
      continue
    }

    const child = result.job
    child.writeToLog(`Created child ${child.type}-${child.id} by job ${job.type}-${job.id}`)
  }
}

const process: Task = async (service, job) => {
  job.writeToLog('# Processing job')
  job.setMeta({ prop: 'value' })
  job.writeToLog('Setting status to _complete_')
  job.setStatus('complete', 'Job complete')
}

const archive: Task = async (service, job) => {
  job.writeToLog('# Archiving job')
  service.archiveJob(job)
}

const check: Task = async (service, job) => {
  const jobs = await service.queryJobs('job', 'complete')
  const meta = job.getMeta()
  if (meta.count === jobs.length) {
    job.writeToLog('All jobs complete')
    job.setStatus('complete', 'All jobs complete')
    await service.runTask('job', 'complete', archive)
    service.archiveJob(job)
  } else {
    throw new Error('Not all jobs complete')
  }
}

async function main() {
  const service = new Service()
  const createResult = await service
    .createJob('1', 'main', { count: 5 })
  createResult.job.writeToLog('Created main job')
  await service.runTask('main', 'initialized', generator)
  await service.runTask('job', 'initialized', process, 3)
  await service.runTask('main', 'initialized', check)
}
main()