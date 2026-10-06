// Encodes a folder of JPEG frames plus a WAV soundtrack into an H.264 / AAC MP4.
// swift encode.swift <framesDir> <fps> <audio.wav> <out.mp4>
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count == 5, let fps = Int32(args[2]) else {
  print("usage: swift encode.swift <framesDir> <fps> <audio.wav> <out.mp4>")
  exit(1)
}
let framesDir = URL(fileURLWithPath: args[1])
let audioURL = URL(fileURLWithPath: args[3])
let outURL = URL(fileURLWithPath: args[4])
try? FileManager.default.removeItem(at: outURL)

let frames = try FileManager.default.contentsOfDirectory(at: framesDir, includingPropertiesForKeys: nil)
  .filter { $0.pathExtension == "jpg" }
  .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard let first = frames.first,
      let firstSource = CGImageSourceCreateWithURL(first as CFURL, nil),
      let firstImage = CGImageSourceCreateImageAtIndex(firstSource, 0, nil) else {
  print("no frames")
  exit(1)
}
let width = firstImage.width
let height = firstImage.height

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264,
  AVVideoWidthKey: width,
  AVVideoHeightKey: height,
  AVVideoCompressionPropertiesKey: [
    AVVideoAverageBitRateKey: 12_000_000,
    AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
  ],
])
videoInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: videoInput, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
  kCVPixelBufferWidthKey as String: width,
  kCVPixelBufferHeightKey as String: height,
])
writer.add(videoInput)

let audioAsset = AVURLAsset(url: audioURL)
var audioTrack: AVAssetTrack?
let tracksLoaded = DispatchSemaphore(value: 0)
audioAsset.loadTracks(withMediaType: .audio) { tracks, _ in
  audioTrack = tracks?.first
  tracksLoaded.signal()
}
tracksLoaded.wait()
var audioInput: AVAssetWriterInput?
var reader: AVAssetReader?
var readerOutput: AVAssetReaderTrackOutput?
if let track = audioTrack {
  let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
    AVFormatIDKey: kAudioFormatMPEG4AAC,
    AVSampleRateKey: 48_000,
    AVNumberOfChannelsKey: 2,
    AVEncoderBitRateKey: 192_000,
  ])
  input.expectsMediaDataInRealTime = false
  writer.add(input)
  audioInput = input
  let r = try AVAssetReader(asset: audioAsset)
  let output = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
  r.add(output)
  r.startReading()
  reader = r
  readerOutput = output
}

writer.startWriting()
writer.startSession(atSourceTime: .zero)
let videoDuration = CMTime(value: Int64(frames.count), timescale: fps)
let group = DispatchGroup()

group.enter()
var frameIndex = 0
videoInput.requestMediaDataWhenReady(on: DispatchQueue(label: "video")) {
  while videoInput.isReadyForMoreMediaData {
    if frameIndex >= frames.count {
      videoInput.markAsFinished()
      group.leave()
      return
    }
    autoreleasepool {
      guard let source = CGImageSourceCreateWithURL(frames[frameIndex] as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
            let pool = adaptor.pixelBufferPool else { return }
      var buffer: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
      guard let pixels = buffer else { return }
      CVPixelBufferLockBaseAddress(pixels, [])
      let context = CGContext(
        data: CVPixelBufferGetBaseAddress(pixels), width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixels), space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
      context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      CVPixelBufferUnlockBaseAddress(pixels, [])
      adaptor.append(pixels, withPresentationTime: CMTime(value: Int64(frameIndex), timescale: fps))
    }
    frameIndex += 1
    if frameIndex % 300 == 0 { print("  video \(frameIndex)/\(frames.count)") }
  }
}

if let input = audioInput, let output = readerOutput {
  group.enter()
  input.requestMediaDataWhenReady(on: DispatchQueue(label: "audio")) {
    while input.isReadyForMoreMediaData {
      guard let sample = output.copyNextSampleBuffer(),
            CMTimeCompare(CMSampleBufferGetPresentationTimeStamp(sample), videoDuration) < 0 else {
        input.markAsFinished()
        group.leave()
        return
      }
      input.append(sample)
    }
  }
}

group.wait()
writer.endSession(atSourceTime: videoDuration)
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
  print("failed: \(String(describing: writer.error))")
  exit(1)
}
reader?.cancelReading()
print("wrote \(outURL.path) — \(frames.count) frames, \(String(format: "%.2f", videoDuration.seconds))s, \(width)x\(height)")
