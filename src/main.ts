import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as create_lambda_role from './create-lambda-role';
import * as run_step_functions_lambda_service from './run-step-functions-lambda-service';
import * as transcribe_audio_lambda_service from './transcribe-audio-lambda-service';
import * as transcribe_status_lambda_service from './transcribe-status-lambda-service';
import * as categorize_data_lambda_service from './categorize-data-lambda-service';
import * as meeting_audio_bucket from './meeting-audio-bucket';
import * as step_functions_state_machine from './step-functions-state-machine';
import * as create_transcribe_audio_role from './create-transcribe-audio-role';

export class CategorizeDataStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const stepFunctionsLambdaRole = new create_lambda_role.CreateLambdaRole(this, 'step-functions-lambda-role');
    const transcribeAudioRole = new create_transcribe_audio_role.CreateTranscribeAudioRole(this, 'transcribe-audio-role');

    const transcribeAudioLambda =
      new transcribe_audio_lambda_service.TranscribeAudioLambdaService(this, 'transcribe-audio-lambda',
      transcribeAudioRole.role);

    const transcribeStatusLambda =
      new transcribe_status_lambda_service.TranscribeStatusLambdaService(this, 'transcribe-status-lambda',
      transcribeAudioRole.role);

    const categorizeDataLambda =
      new categorize_data_lambda_service.CategorizeDataLambdaService(this, 'categorize-data-lambda',
      transcribeAudioRole.role);

    const stepFunctionsStateMachine =
      new step_functions_state_machine.StepFunctionsStateMachine(this, 'step-functions-state-machine',
        transcribeAudioLambda.lambdaFunction.functionArn, transcribeStatusLambda.lambdaFunction.functionArn,
        categorizeDataLambda.lambdaFunction.functionArn, stepFunctionsLambdaRole.role.roleArn);

    const runStepFunctionsLambda =
      new run_step_functions_lambda_service.RunStepFunctionsLambdaService(this,
        'run-step-functions-lambda', stepFunctionsStateMachine.stepFunctionsStateMachine.stateMachineArn);

    new meeting_audio_bucket.MeetingAudioBucket(this, 'meeting-audio-bucket',
        runStepFunctionsLambda.lambdaFunction);
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new CategorizeDataStack(app, 'categorize-data-dev', { env: devEnv });
// new CategorizeDataStack(app, 'categorize-data-prod', { env: prodEnv });

app.synth();