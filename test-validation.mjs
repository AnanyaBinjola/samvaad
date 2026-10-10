import {
  validateWavBuffer,
  formatTime,
  formatFileSize,
  MAX_UPLOAD_SIZE_BYTES
} from './src/utils/wavValidator.ts';

function createWavBuffer({
  numChannels = 1,
  sampleRate = 16000,
  bitsPerSample = 16,
  audioFormat = 1,
  numSamples = 16000,
  extraChunks = []
} = {}) {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  // Calculate size of extra chunks
  let extraChunksSize = 0;
  for (const chunk of extraChunks) {
    extraChunksSize += 8 + chunk.data.byteLength + (chunk.data.byteLength % 2);
  }

  const headerSize = 44 + extraChunksSize;
  const totalSize = headerSize + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'

  // file length - 8
  view.setUint32(4, totalSize - 8, true);

  // WAVE identifier
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  let offset = 12;

  // Write any extra chunks before fmt
  for (const chunk of extraChunks.filter(c => c.position === 'before_fmt')) {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, chunk.id.charCodeAt(i));
    view.setUint32(offset + 4, chunk.data.byteLength, true);
    new Uint8Array(buffer, offset + 8, chunk.data.byteLength).set(new Uint8Array(chunk.data));
    const pad = chunk.data.byteLength % 2;
    offset += 8 + chunk.data.byteLength + pad;
  }

  // fmt subchunk
  view.setUint8(offset, 0x66);     // 'f'
  view.setUint8(offset + 1, 0x6D); // 'm'
  view.setUint8(offset + 2, 0x74); // 't'
  view.setUint8(offset + 3, 0x20); // ' '
  view.setUint32(offset + 4, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(offset + 8, audioFormat, true);
  view.setUint16(offset + 10, numChannels, true);
  view.setUint32(offset + 12, sampleRate, true);
  view.setUint32(offset + 16, byteRate, true);
  view.setUint16(offset + 20, blockAlign, true);
  view.setUint16(offset + 22, bitsPerSample, true);
  offset += 24;

  // Write any extra chunks after fmt (e.g. LIST or ID3)
  for (const chunk of extraChunks.filter(c => c.position !== 'before_fmt')) {
    for (let i = 0; i < 4; i++) view.setUint8(offset + i, chunk.id.charCodeAt(i));
    view.setUint32(offset + 4, chunk.data.byteLength, true);
    new Uint8Array(buffer, offset + 8, chunk.data.byteLength).set(new Uint8Array(chunk.data));
    const pad = chunk.data.byteLength % 2;
    offset += 8 + chunk.data.byteLength + pad;
  }

  // data subchunk
  view.setUint8(offset, 0x64);     // 'd'
  view.setUint8(offset + 1, 0x61); // 'a'
  view.setUint8(offset + 2, 0x74); // 't'
  view.setUint8(offset + 3, 0x61); // 'a'
  view.setUint32(offset + 4, dataSize, true);

  return buffer;
}

async function runTests() {
  console.log('=== STARTING SAMVAAD WAV VALIDATION TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} -> ${details}`);
      failed++;
    }
  }

  // Test 1: Standard 16-bit 16kHz Mono PCM WAV
  const standardWav = createWavBuffer({ numChannels: 1, sampleRate: 16000, bitsPerSample: 16, numSamples: 16000 });
  const res1 = await validateWavBuffer(standardWav, standardWav.byteLength, 'speech_sample.wav');
  assert('Standard 16-bit 16kHz Mono WAV is valid', res1.isValid && res1.metadata?.sampleRate === 16000 && res1.metadata?.channels === 1 && Math.abs(res1.metadata?.durationSeconds - 1.0) < 0.01, JSON.stringify(res1));

  // Test 2: .wave extension support
  const res2 = await validateWavBuffer(standardWav, standardWav.byteLength, 'recording_take.wave');
  assert('Supports .wave extension', res2.isValid, JSON.stringify(res2));

  // Test 3: Non-WAV extension rejection
  const res3 = await validateWavBuffer(standardWav, standardWav.byteLength, 'speech.mp3');
  assert('Rejects non-WAV extension (.mp3)', !res3.isValid && res3.error?.includes('Please choose a WAV audio file'), JSON.stringify(res3));

  // Test 4: Renamed file (MP3/text file with .wav extension - invalid RIFF header)
  const fakeWav = new TextEncoder().encode('ID3\x03\x00\x00\x00... this is actually an MP3 or text file').buffer;
  const res4 = await validateWavBuffer(fakeWav, fakeWav.byteLength, 'fake_audio.wav');
  assert('Rejects renamed non-WAV file (bad RIFF magic)', !res4.isValid && res4.error?.includes('Invalid container structure: Expected "RIFF"'), JSON.stringify(res4));

  // Test 5: Empty / 0-byte file
  const emptyBuf = new ArrayBuffer(0);
  const res5 = await validateWavBuffer(emptyBuf, 0, 'empty.wav');
  assert('Rejects 0-byte empty file', !res5.isValid && res5.error?.includes('empty or invalid'), JSON.stringify(res5));

  // Test 6: Truncated header (< 44 bytes)
  const shortBuf = new ArrayBuffer(20);
  const res6 = await validateWavBuffer(shortBuf, 20, 'short.wav');
  assert('Rejects truncated file (< 44 bytes)', !res6.isValid && res6.error?.includes('too small'), JSON.stringify(res6));

  // Test 7: WAV with arbitrary extra chunks before and after fmt chunk (e.g. LIST metadata or Broadcast bext)
  const dummyChunkData = new Uint8Array([0x49, 0x4E, 0x46, 0x4F, 0x00]).buffer; // "INFO\0"
  const chunkedWav = createWavBuffer({
    numChannels: 2,
    sampleRate: 44100,
    bitsPerSample: 24,
    numSamples: 88200,
    extraChunks: [
      { id: 'bext', data: dummyChunkData, position: 'before_fmt' },
      { id: 'LIST', data: dummyChunkData, position: 'after_fmt' }
    ]
  });
  const res7 = await validateWavBuffer(chunkedWav, chunkedWav.byteLength, 'broadcast_take.wav');
  assert('Correctly parses WAV with dynamic chunk offsets (bext, LIST)', res7.isValid && res7.metadata?.channels === 2 && res7.metadata?.sampleRate === 44100 && res7.metadata?.bitDepth === 24 && Math.abs(res7.metadata?.durationSeconds - 2.0) < 0.05, JSON.stringify(res7));

  // Test 8: Unsupported compression format (e.g. A-law code 6)
  const aLawWav = createWavBuffer({ audioFormat: 6, numSamples: 8000 });
  const res8 = await validateWavBuffer(aLawWav, aLawWav.byteLength, 'alaw_recording.wav');
  assert('Reports clear error for unsupported compression formats (A-law)', !res8.isValid && res8.error?.includes('Unsupported compression format (A-law compression)'), JSON.stringify(res8));

  // Test 9: File exceeding MAX_UPLOAD_SIZE_BYTES (25 MB)
  const res9 = await validateWavBuffer(standardWav, MAX_UPLOAD_SIZE_BYTES + 1024, 'huge_file.wav');
  assert('Rejects file exceeding max upload size limit', !res9.isValid && res9.error?.includes('exceeds the current upload limit'), JSON.stringify(res9));

  // Test 10: Helper formatters
  assert('formatTime converts seconds to MM:SS', formatTime(65) === '01:05' && formatTime(0) === '00:00' && formatTime(3600) === '60:00', `formatTime(65) returned ${formatTime(65)}`);
  assert('formatFileSize displays human-readable units', formatFileSize(1024 * 1024 * 5) === '5.00 MB' && formatFileSize(1024 * 50) === '50.0 KB', `formatFileSize returned ${formatFileSize(1024 * 1024 * 5)}`);

  console.log(`\n=== TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
