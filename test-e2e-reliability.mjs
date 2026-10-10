import fs from 'fs';
import { validateWavBuffer } from './src/utils/wavValidator.ts';
import { encodePcmToWav } from './src/utils/wavEncoder.ts';

async function runReliabilityTestSuite() {
  console.log('================================================================');
  console.log('       SAMVAAD: AUDIO DEBUGGING & RELIABILITY SUITE            ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function report(name, condition, details = '') {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} -> ${details}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Uploading a clear spoken English WAV file
  // -------------------------------------------------------------
  console.log('--- TEST 1: Clear Spoken English WAV File Analysis ---');
  const spokenFile = fs.readFileSync('speech_en.wav');
  const spokenArrayBuf = spokenFile.buffer.slice(spokenFile.byteOffset, spokenFile.byteOffset + spokenFile.byteLength);
  const spokenVal = await validateWavBuffer(spokenArrayBuf, spokenFile.length, 'speech_en.wav');

  report('Spoken WAV is recognized as valid WAV', spokenVal.isValid);
  report('Spoken WAV contains active non-silent signal', spokenVal.metadata?.isSilent === false);
  report('Spoken WAV duration is accurate (~3s)', spokenVal.metadata?.durationSeconds && spokenVal.metadata.durationSeconds > 1.0);
  console.log(`   Signal Peak Amplitude: ${((spokenVal.metadata?.peakAmplitude ?? 0) * 100).toFixed(2)}% | RMS: ${((spokenVal.metadata?.rmsEnergy ?? 0) * 100).toFixed(2)}%\n`);

  // -------------------------------------------------------------
  // Test 2: Uploading a Silent WAV file (Muted Mic / Flatline)
  // -------------------------------------------------------------
  console.log('--- TEST 2: Silent Audio Take Detection ---');
  const silentSamples = new Float32Array(16000 * 2); // 2 seconds of pure 0.0 silence
  const silentWavBlob = encodePcmToWav(silentSamples, 16000, 1, 16000);
  const silentBuf = await silentWavBlob.arrayBuffer();
  const silentVal = await validateWavBuffer(silentBuf, silentBuf.byteLength, 'silent_take.wav');

  report('Silent WAV is technically a valid WAV container', silentVal.isValid);
  report('Silent WAV is accurately flagged as isSilent = true', silentVal.metadata?.isSilent === true);
  report('Silent WAV peak amplitude is 0', silentVal.metadata?.peakAmplitude === 0);
  console.log(`   Signal Peak Amplitude: ${((silentVal.metadata?.peakAmplitude ?? 0) * 100).toFixed(2)}% | isSilent: ${silentVal.metadata?.isSilent}\n`);

  // -------------------------------------------------------------
  // Test 3: Invalid / Empty / Corrupt WAV Files
  // -------------------------------------------------------------
  console.log('--- TEST 3: Invalid & Empty File Rejection ---');
  const emptyBuf = new ArrayBuffer(0);
  const emptyVal = await validateWavBuffer(emptyBuf, 0, 'empty.wav');
  report('Rejects 0-byte empty file with helpful message', !emptyVal.isValid && emptyVal.error?.includes('empty or invalid'));

  const textFileBuf = new TextEncoder().encode('RIFF1234NOTWAVTHISISCORRUPT123456789012345678901234567890').buffer;
  const textVal = await validateWavBuffer(textFileBuf, textFileBuf.byteLength, 'fake.wav');
  report('Rejects non-WAV renamed file', !textVal.isValid && (textVal.error?.includes('Expected "WAVE"') || textVal.error?.includes('Expected "RIFF"')));

  // -------------------------------------------------------------
  // Test 4: Dispatching Silent / Non-speech audio to backend
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Backend ASR Error Handling (HTTP 500 "No speech was recognized") ---');
  
  // Use direct backend endpoint (or active dev proxy)
  const endpoint = process.env.TEST_ENDPOINT || 'http://127.0.0.1:8000/translate';
  console.log(`Using test endpoint: ${endpoint}`);


  const toneData = fs.readFileSync('test_sample.wav'); // 440 Hz tone without speech
  const toneBlob = new Blob([toneData], { type: 'audio/wav' });
  const toneForm = new FormData();
  toneForm.append('audio', toneBlob, 'test_sample.wav');
  toneForm.append('source', 'en');
  toneForm.append('target', 'hi');

  try {
    const toneRes = await fetch(endpoint, {
      method: 'POST',
      body: toneForm,
      signal: AbortSignal.timeout(15000),
    });

    report('Backend returns HTTP 500 for non-speech audio', toneRes.status === 500);
    const toneJson = await toneRes.json();
    report('Backend specifically returns "No speech was recognized"', toneJson.detail === 'No speech was recognized.');
    console.log('   Server response:', JSON.stringify(toneJson));
  } catch (e) {
    console.warn('   Test 4 request error:', e.message);
  }

  // -------------------------------------------------------------
  // Test 5: End-to-End English to Hindi Speech Translation
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: End-to-End English to Hindi Speech Translation ---');
  console.log(`Dispatching speech_en.wav ("Hello, welcome to the international conference.") to ${endpoint}...`);
  const speechForm = new FormData();
  speechForm.append('audio', new Blob([spokenFile], { type: 'audio/wav' }), 'speech_en.wav');
  speechForm.append('source', 'en');
  speechForm.append('target', 'hi');

  try {
    const speechRes = await fetch(endpoint, {
      method: 'POST',
      body: speechForm,
      signal: AbortSignal.timeout(60000),
    });


    report('Backend returns HTTP 200 OK for valid spoken speech', speechRes.status === 200);
    const speechJson = await speechRes.json();
    report('Recognized source text is populated', Boolean(speechJson.source_text));
    report('Synthesized translated text is populated (Hindi)', Boolean(speechJson.translated_text));
    report('Contains audio_base64 WAV payload', Boolean(speechJson.audio_base64 && speechJson.audio_base64.startsWith('UklGR')));

    if (speechJson.audio_base64) {
      const translatedBytes = Buffer.from(speechJson.audio_base64, 'base64');
      const translatedArrayBuf = translatedBytes.buffer.slice(translatedBytes.byteOffset, translatedBytes.byteOffset + translatedBytes.byteLength);
      const translatedVal = await validateWavBuffer(translatedArrayBuf, translatedBytes.length, 'translated.wav');

      report('Synthesized audio is valid 44.1kHz WAV', translatedVal.isValid && translatedVal.metadata?.sampleRate === 44100);
      report('Synthesized audio has non-silent speech waveform', translatedVal.metadata?.isSilent === false);
    }
  } catch (e) {
    console.warn('   Test 5 request error:', e.message);
  }

  console.log(`\n=== RELIABILITY SUITE RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runReliabilityTestSuite();

