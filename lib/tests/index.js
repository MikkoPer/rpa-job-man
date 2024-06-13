import { JobService, Job } from '../index.js';
const generator = async (service, job) => {
    const meta = job.getMeta();
    if (!meta.count) {
        return;
    }
    if (isNaN(meta.count)) {
        return;
    }
    job.writeToLog('# Generating child jobs');
    for (let i = 0; i < meta.count; i++) {
        const id = String(i).padStart(2, '0');
        const type = 'job';
        let child = await service.getJob(id, type);
        console.log('child exists', child);
        if (!child) {
            child = service.createJob({ type, id, meta: { index: i } });
        }
        child.writeToLog(`Created child ${child.type}-${child.id} by job ${job.type}-${job.id}`);
    }
};
const process = async (service, job) => {
    job.writeToLog('# Processing job');
    job.setMeta({ prop: 'value' });
    job.writeToLog('Setting status to _complete_');
    job.setStatus('complete', 'Job complete');
};
const archive = async (service, job) => {
    job.writeToLog('# Archiving job');
    service.archiveJob(job);
};
const check = async (service, job) => {
    const jobs = await service.queryJobs({ type: 'job', status: 'complete' });
    const meta = job.getMeta();
    if (meta.count === jobs.length) {
        job.writeToLog('All jobs complete');
        job.setStatus('complete', 'All jobs complete');
        await service.runTask({ type: 'job', status: 'complete', task: archive });
        service.archiveJob(job);
    }
    else {
        throw new Error('Not all jobs complete');
    }
};
const isErrors = async (service, job) => {
    if (job.error) {
        console.log('ALERT!!! We have an error', job.error);
    }
};
async function main() {
    const service = new JobService();
    const job = service.createJob({ type: 'main', id: '1', meta: { count: 5 } });
    job.writeToLog('Created main job');
    await service.runTask({ type: 'main', status: 'initialized', task: generator });
    await service.runTask({ type: 'job', status: 'initialized', task: process, chunkSize: 3 });
    await service.runTask({ type: 'main', status: 'initialized', task: check });
    await service.runTask({ task: isErrors });
}
main();
//# sourceMappingURL=index.js.map