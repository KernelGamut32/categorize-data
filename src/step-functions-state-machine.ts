import { Construct } from "constructs";
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import { Role } from "aws-cdk-lib/aws-iam";
import * as logs from 'aws-cdk-lib/aws-logs';

export class StepFunctionsStateMachine extends Construct {
  public stepFunctionsStateMachine: stepfunctions.StateMachine;

  constructor(scope: Construct, id: string, transcribeAudioLambdaArn: string,
    transcribeStatusLambdaArn: string, categorizeDataLambdaArn: string,
    delegatedRoleArn: string) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, 'categorize-data-log-group');

    this.stepFunctionsStateMachine = new stepfunctions.StateMachine(this, 'categorize-data', {
      stateMachineName: "Categorize-Audio-Data-Pipeline",
      definitionBody: stepfunctions.DefinitionBody.fromString(`
{
"Comment": "Categorize audio clips by the content of their transcripts",
"StartAt": "Transcribe Audio",
"States": {
"Transcribe Audio": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": {
    "FunctionName": "${transcribeAudioLambdaArn}:$LATEST",
    "Payload": {
      "Input.$": "$"
    }
  },
  "Next": "Wait for Transcribe"
},
"Wait for Transcribe": {
  "Type": "Wait",
  "Seconds": 60,
  "Next": "Check Transcribe Status"
},
"Check Transcribe Status": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": {
    "FunctionName": "${transcribeStatusLambdaArn}:$LATEST",
    "Payload": {
      "Input.$": "$"
    }
  },
  "Next": "Is Transcribe Finished"
},
"Is Transcribe Finished": {
  "Type": "Choice",
  "Choices": [
    {
      "Variable": "$.Payload.TranscriptionJobStatus",
      "StringEquals": "COMPLETED",
      "Next": "Categorize Data"
    },
    {
      "Variable": "$.Payload.TranscriptionJobStatus",
      "StringEquals": "FAILED",
      "Next": "Transcribe Failed"
    }
  ],
  "Default": "Wait for Transcribe"
},
"Categorize Data": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": {
    "FunctionName": "${categorizeDataLambdaArn}:$LATEST",
    "Payload": {
      "Input.$": "$"
    }
  },
  "End": true
},
"Transcribe Failed": {
  "Type": "Fail"
}
}
}
`),
      role: Role.fromRoleArn(this, id, delegatedRoleArn),
      stateMachineType: stepfunctions.StateMachineType.STANDARD,
      logs: {
        destination: logGroup,
        level: stepfunctions.LogLevel.ALL
      }
    });
  }
}
