const core = require('@actions/core');
const github = require('@actions/github');

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
    
    // get the ref 
    const ref = getSha(context);
    if (!ref) {
      core.error(`Context: ${JSON.stringify(context, null, 2)}`);
      return process.exit(1);
    }
    
    // create an in-progress check run
    const created = await rest.checks.create({
        // TODO: ...context.repository syntax?
        owner: context.repository.owner.login,
        repo: context.repository.name,
        name: name,
        head_sha: ref,
        status: 'in_progress', // queued, in_progress, completed        
    });
    
    // TODO: determine coverage
    //const reportPath = core.getInput('reportPath', { required: true });
    //const checkRunNameEnvVar = core.getInput('checkRunNameEnvVar', { required: true });
    //const checkRunNameVarPart = process.env[checkRunNameEnvVar];
    var failed = false;
    
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
        owner: context.repository.owner.login,
        repo: context.repository.name,
        check_run_id: created.data.id,
        //name: 'can I change the name??',
        //head_sha: ref,
        status: 'completed',
        conclusion: 'neutral', // success, failure, neutral, cancelled, timed_out, action_required, skipped
        output: { 
            title: `Test Coverage`, 
            summary: `Total test coverage: XX%`, 
            text: 'where would that text go?',
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
