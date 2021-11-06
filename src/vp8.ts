import { Buffer } from 'buffer';
import { getBits } from './utils';

enum FrameTagOffsets {
  Tag = 0,
  StartCode = 3,
  HorizontalSizeCode = 6,
  VerticalSizeCode = 8,
}

type ColorSpace = 'YUV' | 'unknown';

enum VP8Constants {
  StartCode = 0x9d012a
}

export type VP8ResolutionInfo = {
  width: number;
  widthScale: number;
  height: number;
  heightScale: number;
}

export type VP8FrameTagInfo = {
  keyframe: boolean;
  version: number;
  isExperimental: boolean;
  showFrame: boolean;
  partSize: number;
  resolution?: VP8ResolutionInfo
};

export type VP8FrameHeaderInfo = {
  goldenFrameRefresh?: boolean;
  altrefFrameRefresh?: boolean;
};

export type VP8FrameInfo = {
  keyframe: boolean;
  version: number;
  isExperimental: boolean;
  showFrame: boolean;
  partSize: number;
  resolution?: VP8ResolutionInfo;
  goldenFrameRefresh?: boolean;
  altrefFrameRefresh?: boolean;
}


export class VP8FrameBuffer {
  private readonly buffer: Buffer;
  private keyframe?: boolean;
  private version?: number;
  private isExperimental?: boolean;
  private showFrame?: boolean;
  private partSize?: number;
  private resolution?: VP8ResolutionInfo;

  constructor (buffer: Buffer) {
    this.buffer = buffer;

    this.parseFrameTag();
  } 


  dump () : VP8FrameTagInfo {
    return {
      keyframe: this.keyframe!,
      version: this.version!,
      isExperimental: this.isExperimental!,
      showFrame: this.showFrame!,
      partSize: this.partSize!,
      ...( this.resolution ? { resolution: this.resolution } : undefined )
    }
  }

  private parseFrameTag () : void {    
    const headerTag = this.buffer.readUIntLE(FrameTagOffsets.Tag, 3);

    this.keyframe = !getBits(headerTag, 0, 1);
    this.version = getBits(headerTag, 1, 2);
    this.isExperimental = !!getBits(headerTag, 3, 1);
    this.showFrame = !!getBits(headerTag, 4, 1);
    this.partSize = getBits(headerTag, 5, 19);

    if (this.keyframe) {
      const startCode = this.buffer.readUIntBE(FrameTagOffsets.StartCode, 3);
      if (startCode !== VP8Constants.StartCode) {
        throw new Error("Unsupported bitstream!");
      }

      const horizontalSizeCode = this.buffer.readUIntLE(FrameTagOffsets.HorizontalSizeCode, 2);
      const width = getBits(horizontalSizeCode,  0, 14);
      const widthScale = getBits(horizontalSizeCode,  14, 2);

      const verticalSizeCode = this.buffer.readUIntLE(FrameTagOffsets.VerticalSizeCode, 2);
      const height = getBits(verticalSizeCode,  0, 14);
      const heightScale = getBits(verticalSizeCode,  14, 2);

      this.resolution = {
        width, widthScale,
        height, heightScale
      } as VP8ResolutionInfo;
    }
  }

  private parseFrameHeader () : void {
    let bitsOffset: number = 0;
    const headerBytesOffset: number = (this.keyframe ? 10 : 3);

    if (this.keyframe) {
      /**
       * color_space    | L(1) |
       * clamping_type  | L(1) | 
       **/
      bitsOffset += 2;
    }

    const segmentationOffset = !!getBits(this.buffer.readUIntLE(headerBytesOffset, 1), bitsOffset, 1)
    if (segmentationOffset) {


    }
  }
}
