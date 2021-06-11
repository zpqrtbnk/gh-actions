const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs').promises;

async function run() {
    
  try {

    core.info('Begin');

    // get inputs
    const token = core.getInput('token', { required: true });
    const name = core.getInput('name', { required: true });
    const path = core.getInput('path', { required: true });
    
    // get the REST api
    const octokit = github.getOctokit(token);
    const rest = octokit.rest;
    
    // get the context, the workflow...
    const context = github.context;
    const workflow = context.workflow;
    const repository = context.payload.repository;
    
    // get the ref 
    const ref = getSha(context);
    if (!ref) {
      core.error(`Context: ${JSON.stringify(context, null, 2)}`);
      return process.exit(1);
    }
    
    // create an in-progress check run
    const created = await rest.checks.create({
        // TODO: ...context.repository syntax?
        owner: repository.owner.login,
        repo: repository.name,
        name: name,
        head_sha: ref,
        status: 'in_progress', // queued, in_progress, completed        
    });
    
    // TODO: determine coverage
    // TODO: group Linux & Windows in one check run?    
    var failed = false;
    var summary = 'Total test coverage:'; // TODO + linux/windows
    
    try {
        const fpath = process.cwd() + '/' + path;
        const dirs = await fs.readdir(fpath);
        for (const dir of dirs) {
            const content = await fs.readFile(`${fpath}/${dir}/cover.json`, 'utf8');
            core.warning(content);
            const report = JSON.parse(content);
            const target = dir.substr('cover-'.length);
            const percent = report.CoveragePercent;
            summary += `\n* ${target}: ${percent}%`;
        }
    }
    catch (error) {
        summary = `Failed: ${error.message}`;
        failed = true;
    }
    
    var annotations = [];
    if (failed) {
        annotations = [{
            path: ".github", // required - GitHub uses .github when unknown
            start_line: 1, // required - GitHub uses 1 when unknown
            end_line: 1, // required - same
            annotation_level: "failure", // notice, warning or failure
            title: "Failed to process test coverage (title)",
            message: "Failed to process test coverage (message)"
            // raw_details (string)
        }];
    }
    
    // update the check run
    const r_update = await rest.checks.update({
        owner: repository.owner.login,
        repo: repository.name,
        check_run_id: created.data.id,
        //name: 'can I change the name??',
        //head_sha: ref,
        status: 'completed',
        conclusion: failed ? 'failure' : 'success', // success, failure, neutral, cancelled, timed_out, action_required, skipped
        output: { 
            title: `Test Coverage`, 
            summary: summary, 
            //text: 'where would that text go?',
            annotations
        }
    });
   
    core.info('Completed.');
  }
  catch (error) {
    //core.error(`Context: ${JSON.stringify(github.context, null, 2)}`)
    core.setFailed(error.message);
  }
}

const getSha = (context) => {
  if (context.eventName === "pull_request") {
    return context.payload.pull_request.head.sha || context.payload.after;
  } else {
    return context.sha;
  }
};

run();
