import {useEffect,useRef,useState} from 'react'
import {createWordFrame,documentBytes,pdfPages,renderWord} from './documents'
import type {Contract} from './contracts'

export function ContractReader({doc}:{doc:Contract}) {
  const host=useRef<HTMLDivElement>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{
    const el=host.current!
    let active=true,resize:ResizeObserver|undefined
    el.replaceChildren();setLoading(true);setError('')
    async function render(){
      if(doc.format==='pdf'){
        const bytes=await documentBytes(doc,'pdf')
        if(!active)return
        for await(const canvas of pdfPages(bytes)){if(!active)break;el.append(canvas)}
      }else{
        const bytes=await documentBytes(doc,'docx')
        if(!active)return
        const frame=createWordFrame();el.append(frame)
        const content=await renderWord(frame,bytes)
        if(!active)return
        const sheet=content.querySelector<HTMLElement>('section.docx')
        if(!sheet)throw Error('Word sayfaları görüntülenemedi.')
        const width=sheet.offsetWidth
        const fit=()=>{if(frame.contentDocument)frame.contentDocument.body.style.zoom=String(Math.min(1,Math.max(.1,(el.clientWidth-22)/width)))}
        fit();resize=new ResizeObserver(fit);resize.observe(el)
      }
    }
    render().catch(e=>{if(active)setError(e.message||'Belge görüntülenemedi.')}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false;resize?.disconnect();el.replaceChildren()}
  },[doc])
  return <>{loading&&<p role="status">Belge açılıyor…</p>}{error&&<p role="alert">{error}</p>}<div className="contract-paper" ref={host}/></>
}
