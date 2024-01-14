# rpa-job-man

Has two concepts a Job manager for mananing jobs creation, querying and archiving and a Job to hold the status, state and logs of a single job. By this tool we can create complex processes that are splitted to simple tasks without worrying that the process will fail and lose the progress.

## JobService

Is used to manage Jobs on disk and in memory. Is responsible of creating, querying and archiving of jobs. Is initialized with given root and archive directories.

### Initialization

- rootDir: A static string that represents the root directory where the jobs are stored.
- archiveDir: A static string that represents the archive directory where completed jobs are moved.

## Job

Is used to manage the status, state and loggin of a single job.

### Initialization

