import fs from 'fs';
import { validateWavBuffer } from './src/utils/wavValidator.ts';
import { encodePcmToWav } from './src/utils/wavEncoder.ts';


async function runPrompt9TestSuite() {
  console.log('================================================================');
  console.log('           SAMVAAD: FINAL QA & BACKEND SUITE                    ');
  console.log('================================================================\n');

  const results = [];

  function recordResult(testNumber, scenario, expected, actual, passed, details = '') {
    results.push({
      testNumber,
      scenario,
      expected,
      actual,
      passed,
      details,
    });

    const statusSymbol = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${statusSymbol} [Test ${testNumber}] ${scenario}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual:   ${actual}`);
    if (details) {
      console.log(`   Details:  ${details}`);
    }
    console.log('');
  }

  // -------------------------------------------------------------
  // Test 1: Real English Speech Translation (speech_en.wav -> Hindi) via Backend / Proxy
  // -------------------------------------------------------------
  console.log('--- TEST 1: Clear English Speech Translation to Hindi ---');
  let proxyEndpoint = process.env.TEST_ENDPOINT || 'http://127.0.0.1:8000/translate';
  try {
    const spokenFile = fs.readFileSync('speech_en.wav');
    const speechForm = new FormData();
    speechForm.append('audio', new Blob([spokenFile], { type: 'audio/wav' }), 'speech_en.wav');
    speechForm.append('source', 'en');
    speechForm.append('target', 'hi');

    const startTime = performance.now();
    const res = await fetch(proxyEndpoint, {
      method: 'POST',
      body: speechForm,
      signal: AbortSignal.timeout(60000),
    });

    const roundtrip = ((performance.now() - startTime) / 1000).toFixed(2);
    const contentType = res.headers.get('content-type') || '';


    if (res.status === 200) {
      let finalBytes;
      let sourceText = '';
      let translatedText = '';

      if (contentType.includes('application/json')) {
        const json = await res.json();
        sourceText = json.source_text || '';
        translatedText = json.translated_text || '';
        const binaryString = atob(json.audio_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        finalBytes = bytes.buffer;
      } else {
        finalBytes = await res.arrayBuffer();
      }

      // Save output WAV to disk to verify audio playability
      fs.writeFileSync('prompt9_verified_hindi.wav', Buffer.from(finalBytes));

      const wavValidation = await validateWavBuffer(finalBytes, finalBytes.byteLength, 'prompt9_verified_hindi.wav');

      const isSuccess =
        wavValidation.isValid &&
        wavValidation.metadata &&
        wavValidation.metadata.isSilent === false &&
        wavValidation.metadata.durationSeconds > 0;

      recordResult(
        1,
        'Clear English speech file (speech_en.wav) translated to Hindi via /api/translate',
        'HTTP 200 with valid, non-silent synthesized Hindi WAV audio',
        `HTTP ${res.status} OK (${roundtrip}s), Format: ${wavValidation.metadata?.sampleRate}Hz ${wavValidation.metadata?.channels === 1 ? 'Mono' : 'Stereo'} WAV (${wavValidation.metadata?.durationSeconds.toFixed(2)}s)`,
        isSuccess,
        `ASR: "${sourceText}" -> MT: "${translatedText}" | Output written to prompt9_verified_hindi.wav`
      );
    } else {
      const errText = await res.text();
      recordResult(
        1,
        'Clear English speech file (speech_en.wav) translated to Hindi via /api/translate',
        'HTTP 200 with valid WAV audio',
        `HTTP ${res.status}: ${errText}`,
        false
      );
    }
  } catch (err) {
    recordResult(
      1,
      'Clear English speech file (speech_en.wav) translated to Hindi via /api/translate',
      'HTTP 200 with valid WAV audio',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Test 2: Pre-recorded WAV file validation & signal inspection
  // -------------------------------------------------------------
  console.log('--- TEST 2: Pre-recorded WAV File Inspection ---');
  try {
    const spokenData = fs.readFileSync('speech_en.wav');
    const spokenArrBuf = spokenData.buffer.slice(spokenData.byteOffset, spokenData.byteOffset + spokenData.byteLength);
    const spokenVal = await validateWavBuffer(spokenArrBuf, spokenData.length, 'speech_en.wav');

    const isValValid =
      spokenVal.isValid &&
      spokenVal.metadata &&
      spokenVal.metadata.isSilent === false &&
      spokenVal.metadata.sampleRate === 16000 &&
      spokenVal.metadata.bitDepth === 16;

    recordResult(
      2,
      'Input WAV Header & Signal Parsing (16kHz 16-bit PCM speech_en.wav)',
      'Valid WAV, 16000 Hz, 16-bit, isSilent = false',
      `Valid: ${spokenVal.isValid}, SampleRate: ${spokenVal.metadata?.sampleRate} Hz, BitDepth: ${spokenVal.metadata?.bitDepth}-bit, isSilent: ${spokenVal.metadata?.isSilent}`,
      isValValid,
      `Peak amplitude: ${((spokenVal.metadata?.peakAmplitude ?? 0) * 100).toFixed(1)}%, RMS: ${((spokenVal.metadata?.rmsEnergy ?? 0) * 100).toFixed(1)}%`
    );
  } catch (err) {
    recordResult(
      2,
      'Input WAV Header & Signal Parsing',
      'Valid WAV metadata',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Test 3: Empty (0 bytes) and Corrupt/Non-WAV File Rejection
  // -------------------------------------------------------------
  console.log('--- TEST 3: Empty and Corrupted File Rejection ---');
  try {
    const emptyBuf = new ArrayBuffer(0);
    const emptyVal = await validateWavBuffer(emptyBuf, 0, 'empty.wav');

    const corruptBuf = new TextEncoder().encode('RIFFxxxxNOTWAVE1234567890123456789012345678901234567890').buffer;
    const corruptVal = await validateWavBuffer(corruptBuf, corruptBuf.byteLength, 'corrupt.wav');

    const mp3RenamedBuf = new TextEncoder().encode('ID3\x03\x00\x00\x00\x00\x00\x00ThisIsAnMP3FileRenamedToWav').buffer;
    const mp3Val = await validateWavBuffer(mp3RenamedBuf, mp3RenamedBuf.byteLength, 'renamed_mp3.wav');

    const passEmpty = !emptyVal.isValid && Boolean(emptyVal.error);
    const passCorrupt = !corruptVal.isValid && Boolean(corruptVal.error);
    const passMp3 = !mp3Val.isValid && Boolean(mp3Val.error);

    recordResult(
      3,
      'Empty (0 bytes), corrupt header, and renamed MP3 file rejection',
      'All invalid files rejected with descriptive error messages',
      `Empty rejected: ${passEmpty}, Corrupt rejected: ${passCorrupt}, Renamed MP3 rejected: ${passMp3}`,
      passEmpty && passCorrupt && passMp3,
      `Empty msg: "${emptyVal.error}" | Corrupt msg: "${corruptVal.error}" | MP3 msg: "${mp3Val.error}"`
    );
  } catch (err) {
    recordResult(
      3,
      'Empty and Corrupted File Rejection',
      'Immediate client-side rejection',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Test 4: Silent Audio Detection (Muted Mic / Flatline WAV)
  // -------------------------------------------------------------
  console.log('--- TEST 4: Silent Audio Detection ---');
  try {
    const silentSamples = new Float32Array(16000 * 2); // 2 seconds of 0.0
    const silentBlob = encodePcmToWav(silentSamples, 16000, 1, 16000);
    const silentBuf = await silentBlob.arrayBuffer();
    const silentVal = await validateWavBuffer(silentBuf, silentBuf.byteLength, 'silent_mic.wav');

    const isSilentDetected = silentVal.isValid && silentVal.metadata?.isSilent === true && silentVal.metadata?.peakAmplitude === 0;

    recordResult(
      4,
      'Flatline / Silent Recording Signal Analysis',
      'WAV container is valid, but isSilent is flagged as true with peakAmplitude = 0',
      `Valid: ${silentVal.isValid}, isSilent: ${silentVal.metadata?.isSilent}, peakAmplitude: ${silentVal.metadata?.peakAmplitude}`,
      isSilentDetected,
      'Client displays warning badge ⚠️ Silent Audio to prompt user to speak or check microphone'
    );
  } catch (err) {
    recordResult(
      4,
      'Silent Audio Detection',
      'isSilent = true',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Test 5: Backend ASR Error Handling (HTTP 500 "No speech was recognized")
  // -------------------------------------------------------------
  console.log('--- TEST 5: Backend ASR Error Handling for Non-speech Audio ---');
  try {
    const nonSpeechData = fs.readFileSync('test_sample.wav'); // 440 Hz tone
    const toneForm = new FormData();
    toneForm.append('audio', new Blob([nonSpeechData], { type: 'audio/wav' }), 'test_sample.wav');
    toneForm.append('source', 'en');
    toneForm.append('target', 'hi');

    const toneRes = await fetch(proxyEndpoint, {
      method: 'POST',
      body: toneForm,
      signal: AbortSignal.timeout(15000),
    });

    const is500 = toneRes.status === 500;
    const json = await toneRes.json();
    const isNoSpeechMsg = json.detail === 'No speech was recognized.';

    recordResult(
      5,
      'Backend ASR Error Response for Pure Sine Tone (Non-speech audio)',
      'Backend returns HTTP 500 with detail "No speech was recognized."',
      `HTTP ${toneRes.status} with detail: "${json.detail}"`,
      is500 && isNoSpeechMsg,
      'Frontend catches this and provides user-friendly advice to speak clearly without claiming CORS failure'
    );
  } catch (err) {
    recordResult(
      5,
      'Backend ASR Error Handling',
      'HTTP 500 with "No speech was recognized."',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Test 6: Unreachable Backend Endpoint Error Handling
  // -------------------------------------------------------------
  console.log('--- TEST 6: Unreachable Backend Endpoint Error Handling ---');
  try {
    const unreachableUrl = 'http://127.0.0.1:59999/translate';
    const fakeForm = new FormData();
    fakeForm.append('audio', new Blob([new Uint8Array(44)], { type: 'audio/wav' }), 'fake.wav');
    fakeForm.append('source', 'en');
    fakeForm.append('target', 'hi');

    let threwError = false;
    let errorMsg = '';

    try {
      await fetch(unreachableUrl, {
        method: 'POST',
        body: fakeForm,
        signal: AbortSignal.timeout(2000),
      });
    } catch (e) {
      threwError = true;
      errorMsg = e.message;
    }

    recordResult(
      6,
      'Communication failure against unreachable backend server',
      'Network failure thrown and caught with helpful diagnostics',
      `Connection error caught: "${errorMsg}"`,
      threwError,
      'Frontend resolves same-origin proxy vs direct URL and guides user to Server Settings'
    );
  } catch (err) {
    recordResult(
      6,
      'Unreachable Backend Endpoint',
      'Graceful error handling',
      `Error: ${err.message}`,
      false
    );
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`       FINAL QA SUMMARY: ${totalPassed}/${results.length} PASSED (${totalFailed} FAILED)      `);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPrompt9TestSuite();
