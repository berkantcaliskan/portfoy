interface Box {x:number; y:number; width:number; height:number}
interface Page {
  getCropBox(): Box
  getMediaBox(): Box
  getHeight(): number
  getWidth(): number
  setMediaBox(x:number,y:number,width:number,height:number): void
  setCropBox(x:number,y:number,width:number,height:number): void
  drawImage(image:object, options:Box): void
}
export class PDFDocument {
  static create():Promise<PDFDocument>
  static load(data:Uint8Array):Promise<PDFDocument>
  getPages():Page[]
  getPageCount():number
  addPage(size:[number,number]):Page
  embedPng(data:string):Promise<object>
  embedJpg(data:string):Promise<object>
  save():Promise<Uint8Array<ArrayBuffer>>
}
