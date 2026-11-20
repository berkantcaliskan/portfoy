interface Viewport {width:number; height:number}
interface Page {
  getViewport(options:{scale:number}):Viewport
  render(options:{canvas:HTMLCanvasElement;viewport:Viewport}):{promise:Promise<void>}
  cleanup():void
}
export const GlobalWorkerOptions:{workerPort:Worker|null}
export function getDocument(options:{data:Uint8Array;useSystemFonts:boolean;disableFontFace:boolean;useWasm:boolean}):{
  promise:Promise<{numPages:number;getPage(number:number):Promise<Page>}>
  destroy():Promise<void>
}
