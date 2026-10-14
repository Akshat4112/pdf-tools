import { zlibSync } from 'fflate'
import { pngCrc } from '../engines/imageMetadata'
export function concat(...parts: Uint8Array[]) { const out = new Uint8Array(parts.reduce((s,p) => s+p.length,0)); let at=0; for(const p of parts){out.set(p,at);at+=p.length} return out }
export function exif(orientation: number, little = true) {
  const out = new Uint8Array(26), v = new DataView(out.buffer)
  out.set(little ? [73,73] : [77,77]); v.setUint16(2,42,little); v.setUint32(4,8,little)
  v.setUint16(8,1,little); v.setUint16(10,0x112,little); v.setUint16(12,3,little); v.setUint32(14,1,little); v.setUint16(18,orientation,little)
  return out
}
export function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(data.length+12), v = new DataView(out.buffer)
  v.setUint32(0,data.length); out.set(new TextEncoder().encode(type),4); out.set(data,8); v.setUint32(out.length-4,pngCrc(out.subarray(4,out.length-4))); return out
}
export function png(width = 80, height = 40, orientation?: number, transparent = false) {
  const header = new Uint8Array(13), v = new DataView(header.buffer); v.setUint32(0,width);v.setUint32(4,height);header[8]=8;header[9]=6
  const raw = new Uint8Array((width*4+1)*height)
  const colors = [[255,0,0],[0,255,0],[0,0,255],[255,255,0]]
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const at=y*(width*4+1)+1+x*4, color=colors[(y>=height/2?2:0)+(x>=width/2?1:0)]
    raw.set([...color, transparent && x<width/2 ? 0 : 255],at)
  }
  return concat(new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),...(orientation ? [chunk('eXIf',exif(orientation))] : []),chunk('IDAT',zlibSync(raw)),chunk('IEND',new Uint8Array()))
}
export function jpegExif(bytes: Uint8Array, orientation: number, little = true) {
  const data=concat(new Uint8Array([69,120,105,102,0,0]),exif(orientation,little)), segment=new Uint8Array(data.length+4)
  segment.set([255,225]);new DataView(segment.buffer).setUint16(2,data.length+2);segment.set(data,4)
  return concat(bytes.subarray(0,2),segment,bytes.subarray(2))
}
