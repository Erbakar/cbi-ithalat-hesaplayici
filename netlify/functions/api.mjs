import serverless from 'serverless-http';
import {connectLambda} from '@netlify/blobs';
import {requestHandler} from '../../server.mjs';
const serve=serverless(requestHandler,{binary:['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']});
export const handler=async(event,context)=>{connectLambda(event);return serve(event,context);};
