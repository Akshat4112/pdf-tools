import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { readImageMetadata } from '../engines/imageMetadata'
import { imagePreviewBytes } from '../engines/imagePreviewBytes'
import { concat, jpegExif, png } from './imageFixtures'
it('removes preview EXIF without changing source data, pixel bytes or PNG CRCs', () => {
  const jpg = new Uint8Array(readFileSync('../fixtures/images/F-007-photo.jpg'))
  for (const orientation of [1,2,3,4,5,6,7,8]) {
    for (const source of [jpegExif(jpg,orientation),png(80,40,orientation)]) {
      const before=source.slice(), metadata=readImageMetadata(source)
      const pooled=concat(new Uint8Array(9),source,new Uint8Array(4)).subarray(9,9+source.length)
      const preview=imagePreviewBytes(pooled,metadata.kind)
      expect(readImageMetadata(preview)).toEqual({...metadata,orientation:1})
      expect(source).toEqual(before)
      if(metadata.kind==='jpeg')expect(preview).toEqual(jpg)
      else expect(preview).toEqual(png())
    }
  }
})
