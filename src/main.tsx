import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function bootstrap(){
 // Geçiş alanı eski store/senkronizasyon motorunu başlatmaz.
 let View
 const workspace = new URLSearchParams(window.location.search).get('workspace')
 if(workspace==='register'){
  View=(await import('./components/auth/CrmInviteSignup')).default
 }else if(workspace==='backend'){
  View=(await import('./components/backend/BackendTransitionView')).default
 }else{
  const {enableCentralCrm}=await import('./services/crmRuntime')
  enableCentralCrm()
  await import('./services/zeroStatePurge')
  View=(await import('./App.tsx')).default
 }
 createRoot(document.getElementById('root')!).render(<StrictMode><View/></StrictMode>)
}
void bootstrap().catch(()=>{
 const root=document.getElementById('root')
 if(root)root.textContent='Uygulama başlatılamadı. Sayfayı yenileyin; kayıtlarınız silinmedi.'
})
