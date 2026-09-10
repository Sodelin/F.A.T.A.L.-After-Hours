import {env} from 'cloudflare:workers';
export function campaignDb(){if(!env.DB)throw new Error('Campaign storage unavailable.');return env.DB;}
