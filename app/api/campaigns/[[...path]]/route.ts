import {handleCampaignRequest} from '@/lib/campaign/api.mjs';
import {fateAdapter} from '@/lib/fate/adapter.mjs';
import {campaignDb} from '@/lib/campaign/db';
async function handle(request:Request){try{return await handleCampaignRequest(request,campaignDb(),fateAdapter);}catch{return Response.json({error:'Campaign storage is temporarily unavailable. Your changes have not been saved.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export const GET=handle;
export const POST=handle;
