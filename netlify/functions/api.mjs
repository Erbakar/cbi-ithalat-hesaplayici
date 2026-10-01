import serverless from 'serverless-http';
import {connectLambda} from '@netlify/blobs';
process.env.CBI_NETLIFY='true';
let serve;
const getServe=async()=>serve||(serve=serverless((await import('../../server.mjs')).requestHandler,{binary:['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}));
export const handler=async(event,context)=>{connectLambda(event);return (await getServe())(event,context);};
