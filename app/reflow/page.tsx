import {notFound} from 'next/navigation';
// Development-only visual harness. The iframe runs the actual authenticated app.
export default function ReflowCheck(){
 if(import.meta.env.DEV)return <main style={{padding:24}}><h1>390px viewport check</h1><p>Actual campaign UI in a narrow viewport. Production returns 404.</p><iframe title="Phone-sized campaign workspace" src="/" width="390" height="844" style={{border:'1px solid #435269',background:'#0b101b'}} /></main>;
 return notFound();
}
