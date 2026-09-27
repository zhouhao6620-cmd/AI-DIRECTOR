#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2) {
      fprintf(stderr, "usage: generate-video OUTPUT.mp4\n");
      return 2;
    }
    NSString *outputPath = [NSString stringWithUTF8String:argv[1]];
    NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
    [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];
    NSError *error = nil;
    AVAssetWriter *writer = [AVAssetWriter assetWriterWithURL:outputURL fileType:AVFileTypeMPEG4 error:&error];
    if (!writer) { fprintf(stderr, "%s\n", error.localizedDescription.UTF8String); return 1; }

    const int width = 320, height = 180, fps = 30;
    NSDictionary *settings = @{
      AVVideoCodecKey: AVVideoCodecTypeH264,
      AVVideoWidthKey: @(width),
      AVVideoHeightKey: @(height),
    };
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
    input.expectsMediaDataInRealTime = NO;
    NSDictionary *attributes = @{
      (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
      (NSString *)kCVPixelBufferWidthKey: @(width),
      (NSString *)kCVPixelBufferHeightKey: @(height),
    };
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor
      assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input
      sourcePixelBufferAttributes:attributes];
    if (![writer canAddInput:input]) { fprintf(stderr, "cannot add video input\n"); return 1; }
    [writer addInput:input];
    if (![writer startWriting]) { fprintf(stderr, "%s\n", writer.error.localizedDescription.UTF8String); return 1; }
    [writer startSessionAtSourceTime:kCMTimeZero];

    for (int frame = 0; frame < 60; frame += 1) {
      while (!input.readyForMoreMediaData) [NSThread sleepForTimeInterval:0.002];
      CVPixelBufferRef buffer = NULL;
      CVReturn created = CVPixelBufferPoolCreatePixelBuffer(NULL, adaptor.pixelBufferPool, &buffer);
      if (created != kCVReturnSuccess || !buffer) { fprintf(stderr, "pixel buffer allocation failed\n"); return 1; }
      CVPixelBufferLockBaseAddress(buffer, 0);
      uint8_t *pixels = CVPixelBufferGetBaseAddress(buffer);
      size_t bytesPerRow = CVPixelBufferGetBytesPerRow(buffer);
      uint8_t color = (uint8_t)(40 + (frame % 20) * 4);
      for (int y = 0; y < height; y += 1) {
        for (int x = 0; x < width; x += 1) {
          size_t offset = (size_t)y * bytesPerRow + (size_t)x * 4;
          pixels[offset] = color;
          pixels[offset + 1] = 105;
          pixels[offset + 2] = 255;
          pixels[offset + 3] = 255;
        }
      }
      CVPixelBufferUnlockBaseAddress(buffer, 0);
      BOOL appended = [adaptor appendPixelBuffer:buffer withPresentationTime:CMTimeMake(frame, fps)];
      CVPixelBufferRelease(buffer);
      if (!appended) { fprintf(stderr, "%s\n", writer.error.localizedDescription.UTF8String); return 1; }
    }
    [input markAsFinished];
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{ dispatch_semaphore_signal(semaphore); }];
    dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
    if (writer.status != AVAssetWriterStatusCompleted) {
      fprintf(stderr, "%s\n", writer.error.localizedDescription.UTF8String);
      return 1;
    }
  }
  return 0;
}
