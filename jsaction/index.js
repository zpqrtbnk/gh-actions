const core = require('@actions/core');
const github = require('@actions/github');
//const fs = require('fs').promises;

async function run() {
    
  try {

    // get inputs
    const ghtoken = core.getInput("githubToken", { required: true });
    const annotationText = core.getInput("text", { required: true });
    
    // get the REST api
    const octokit = github.getOctokit(ghtoken);
    const rest = octokit.rest;
    
    // get the context
    const context = github.context;
    core.debug(`Context: ${JSON.stringify(context, null, 2)}`);
    
    // get the workflow
    const workflow = context.workflow;
    
    //const reportPath = core.getInput('reportPath', { required: true });
    //const checkRunNameEnvVar = core.getInput('checkRunNameEnvVar', { required: true });
    //const checkRunNameVarPart = process.env[checkRunNameEnvVar];

    // get the ref SHA
    const ref = getSha(context);
    if (!ref) {
      core.error(`Context: ${JSON.stringify(context, null, 2)}`);
      return process.exit(1);
    }
    core.debug(`REF: ${ref}`);
    
    // get the run id
    const run_id = context.runId;
    core.debug(`RUN: ${run_id}`);

    // get check-runs associated with the ref
    core.debug('get checks');
    const r_checks = await rest.checks.listForRef({
        owner: 'zpqrtbnk',
        repo: 'test-repo',
        ref: ref
    });
    r_checks.data.check_runs.forEach((cr) => {        
        core.debug(`- ${cr.id} '${cr.name}' (${cr.status})`);
    });

    // get 'the' check-run    
    core.debug('get check');
    const exp_id = r_checks.data.check_runs
        .filter(cr => cr.status === 'in_progress' && cr.name === 'Experiment')[0].id;
    core.debug(`- ${exp_id}`);

    // create annotations
    
    const annotations = [
        {
            path: ".github", // required - GitHub uses .github when unknown
            start_line: 1, // required - GitHub uses 1 when unknown
            end_line: 1, // required - same
            annotation_level: "notice", // notice, warning or failure
            message: "message/" + annotationText,
            title: "title/" + annotationText
            // raw_details (string)
        },
        {
            path: ".github", // required - GitHub uses .github when unknown
            start_line: 1, // required - GitHub uses 1 when unknown
            end_line: 1, // required - same
            annotation_level: "warning", // notice, warning or failure
            message: "w/message/" + annotationText,
            title: "w/title/" + annotationText
            // raw_details (string)
        }
    ];
    
    // create a check run - but how is that linked to the SHA?
    // -> err: "For 'links/0/schema', nil is not an object."
    core.debug('create check');
    const r_create = await rest.checks.create({
        owner: 'zpqrtbnk',
        repo: 'test-repo',
        name: 'c name',
        head_sha: ref,
        status: 'completed', // queued, in_progress, or completed        
        conclusion: 'success'
    });
    core.debug(r_create.data);
    
    // can we update that one?
    const exp2_id = r_create.data.id;
    
    // update the check-run
    core.debug('update check');

    // this adds the annotations, but github only displays the warning (not the notice)
    // and all the 'output' stuff is gone
    const r_update = await rest.checks.update({
        owner: 'zpqrtbnk',
        repo: 'test-repo',
        check_run_id: exp2_id,
        name: 'can I change the name??',
        head_sha: ref,
        status: 'completed',
        conclusion: 'neutral', // ["success", "failure", "neutral", "cancelled", "timed_out", "action_required", "skipped"]
        output: { 
            title: `${workflow} Check Run`, 
            summary: `1 annotation`, 
            text: 'where would that text go?',
            annotations 
        }
    });
    
    core.debug(r_update);

    //await rest.checks.update({
    //    ...context.repo,
    //    exp_id,
    //    output: { title: `${workflow} Check Run`, summary: `1 annotation`, annotations }
    //});

    /*
    //The Github Checks API requires that Annotations are not submitted in batches of more than 50
    const batchedReports = batchIt(50, reports);
    core.info(`Adding ${reports.length} error(s) as annotations to check run with id ${check_run_id}`);

    for (const reports of batchedReports) {

      const annotations = reports.map(r => ({
        path: r.file,
        start_line: r.line,
        end_line: r.line,
        annotation_level: "failure",
        message: r.message,
        title: r.title
      }));


      await octokit.checks.update({
        ...context.repo,
        check_run_id,
        output: { title: `${workflow} Check Run`, summary: `${annotations.length} errors(s) found`, annotations }
      });

      core.info(`Finished adding ${annotations.length} annotations.`);
    }
    */
    
    core.info(`Finished adding all annotations.`);
  }
  catch (error) {
    core.error(`Context: ${JSON.stringify(github.context, null, 2)}`)
    core.setFailed(error.message);
  }
}

const batchIt = (size, inputs) => inputs.reduce((batches, input) => {
  const current = batches[batches.length - 1];

  current.push(input);

  if (current.length == size) {
    batches.push([]);
  }

  return batches;
}, [[]]);

const getSha = (context) => {
  if (context.eventName === "pull_request") {
    return context.payload.pull_request.head.sha || context.payload.after;
  } else {
    return context.sha;
  }
};

run();
