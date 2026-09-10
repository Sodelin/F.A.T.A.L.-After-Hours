import {handleCampaignRequest} from '@/lib/campaign/api.mjs';
import {fateAdapter} from '@/lib/fate/adapter.mjs';
import {campaignDb} from '@/lib/campaign/db';
async function handle(request:Request){try{
 if(import.meta.env.DEV){
  const url=new URL(request.url);
  if(url.protocol==='http:'&&url.hostname==='terminal.local'&&url.port==='4173'){
   const {developmentRequest,developmentResponse}=await import('@/lib/campaign/dev-transport.mjs');
   return developmentResponse(await handleCampaignRequest(developmentRequest(request),campaignDb(),fateAdapter));
  }
 }
 return await handleCampaignRequest(request,campaignDb(),fateAdapter);
}catch(error){if(import.meta.env.DEV)console.error(error instanceof Error?error.message:"Campaign route error");return Response.json({error:import.meta.env.DEV && error instanceof Error?error.message:'Campaign storage is temporarily unavailable. Your changes have not been saved.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export const GET=handle;
export const POST=handle;
