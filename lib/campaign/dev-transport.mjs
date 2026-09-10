// Only imported by the compile-time development branch in the route.
export function developmentRequest(request){
 const url=new URL(request.url);
 if(url.protocol!=='http:'||url.hostname!=='terminal.local'||url.port!=='4173')return request;
 const headers=new Headers(request.headers);
 const cookies=(headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v&&!v.startsWith('__Host-campaign-')).map(v=>v.startsWith('dev-campaign-')?'__Host-campaign-'+v.slice('dev-campaign-'.length):v);
 headers.set('cookie',cookies.join('; '));return new Request(request.url,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:request.body,duplex:'half',redirect:request.redirect});
}
export function developmentResponse(response){
 const headers=new Headers(response.headers),cookies=headers.getSetCookie();headers.delete('set-cookie');
 for(const value of cookies)headers.append('set-cookie',value.startsWith('__Host-campaign-')?value.replace(/^__Host-campaign-/,'dev-campaign-').replace(/;\s*Secure\b/ig,''):value);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
