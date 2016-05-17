var exec = require('child_process').exec;
var expandTilde = require('expand-tilde');
var Promise = require('bluebird');


function run(slackbot, bundle, verb, target) {
  slackbot.send({
    channel: bundle.msg.channel,
    text: `i'm on it! 👍`
  })
    .then(execSequence.bind(null, verb.sequence, target))
    .then(processResult)
    .then(sendOutput.bind(null, {slackbot, bundle}));
}

module.exports = {run};

function execSequence(sequence, target) {
  var outs = []; // stdouts and stderrs
  var promiseArray = [];

  // prepare the function-wrapped promise array
  sequence.forEach(cmd => {
    promiseArray.push(function() {
      return executeInShell({
        binary: cmd[0],
        args: cmd.slice(1),
        target
      });
    });
  })

  // kick off the unwrap step
  // console.log(unwrapPromises({arr: promiseArray}));
  return unwrapPromises({arr: promiseArray});
}

function unwrapPromises({arr, i = 0, results = []}) {
  var fn = arr[i];
  if(arr[i+1]) {
    return fn()
      .then(res => {
        results.push(res);
        return unwrapPromises({arr, i: i + 1, results});
      });
  } else {
    return fn()
      .then(res => {
        results.push(res);
        return new Promise(r => r(results));
      });
  }
}

function executeInShell({binary, args, target}) {
  return new Promise((resolve, reject) => {
    exec(`${binary} ${args.join(' ')}`, {
      cwd: expandTilde(target.workingDir),
      shell: true
    }, (error, stdout, stderr) => resolve({error, stdout, stderr, cmd: `${binary} ${args.join(' ')}`}));
  })
}

function processResult(outputs) {
  console.log(outputs);

  var isSuccessful = true;
  var outputLog = '';

  outputs.forEach(output => {
    outputLog += `>>> ${output.cmd} \n`;

    if(output.error === null) {
      outputLog += `${output.stdout.toString()}`;
      if(output.stderr) {
        outputLog += (output.stderr.toString())
      }
    } else {
      outputLog += (`${output.stderr ? output.stderr.toString() : output.error}`);
      isSuccessful = false;
    }
  })

  return {outputLog, isSuccessful};
}

function sendOutput({slackbot, bundle}, {outputLog, isSuccessful}) {
  if (isSuccessful) {
    // report a sequence success
    slackbot.createPost({
      content: outputLog,
      comment: `<@${bundle.msg.user}> \`${bundle.cmd.join(' ')}\` succeeded!`,
      filename: `${bundle.cmd.join(' ')} at ${Date()}`
    });
  } else {
    slackbot.createPost({
      content: outputLog,
      comment: `<@${bundle.msg.user}> \`${bundle.cmd.join(' ')}\` failed.`,
      filename: `${bundle.cmd.join(' ')} at ${Date()}`
    });
  }
}
