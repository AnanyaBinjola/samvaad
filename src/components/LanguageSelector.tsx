import React from 'react';
import {
  LANGUAGES,
  getAllowedTargets,
} from '../languages';

interface LanguageSelectorProps {
  sourceLang: string;
  targetLang: string;
  onSourceChange: (newSource: string) => void;
  onTargetChange: (newTarget: string) => void;
  disabled?: boolean;
}

// Cultural / Native script labels for conference attendees
const NATIVE_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'العربية',
  zh: '中文',
  en: 'English',
  es: 'Español',
  fa: 'فارسی',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  kk: 'Қазақша',
  ms: 'Bahasa Melayu',
  pt: 'Português',
  ru: 'Русский',
  sw: 'Kiswahili',
  th: 'ไทย',
  uz: "O'zbekcha",
  vi: 'Tiếng Việt',
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  disabled = false,
}) => {
  const allCodes = Object.keys(LANGUAGES);
  const allowedTargets = getAllowedTargets(sourceLang);

  // Check if swapping is allowed by routing rules
  const targetAllowedForCurrentTarget = getAllowedTargets(targetLang);
  const canSwap = targetAllowedForCurrentTarget.includes(sourceLang);

  const handleSourceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSource = e.target.value;
    onSourceChange(newSource);

    // If current target is no longer valid for the new source, pick the first allowed target
    const newAllowedTargets = getAllowedTargets(newSource);
    if (!newAllowedTargets.includes(targetLang)) {
      onTargetChange(newAllowedTargets[0] || 'en');
    }
  };

  const handleTargetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value;
    onTargetChange(newTarget);
  };

  const handleSwap = () => {
    if (!canSwap || disabled) return;
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    onSourceChange(prevTarget);
    onTargetChange(prevSource);
  };

  const currentSourceName = LANGUAGES[sourceLang] || sourceLang;
  const currentTargetName = LANGUAGES[targetLang] || targetLang;
  const currentSourceNative = NATIVE_NAMES[sourceLang] || currentSourceName;
  const currentTargetNative = NATIVE_NAMES[targetLang] || currentTargetName;

  return (
    <div className="language-selector-card" aria-label="Language selection">
      <div className="language-selector-grid">
        {/* Source Language Column ("You speak") */}
        <div className="language-column">
          <div className="language-column-header">
            <span className="language-label-tag source-tag">
              <span className="lang-tag-dot coral-dot" aria-hidden="true"></span>
              You speak
            </span>
            <span className="language-native-badge">{currentSourceNative}</span>
          </div>

          <div className="select-wrapper">
            <select
              id="source-language-select"
              value={sourceLang}
              onChange={handleSourceSelect}
              disabled={disabled}
              className="language-select"
              aria-label="Select your spoken language (source language)"
            >
              {allCodes.map((code) => {
                const name = LANGUAGES[code];
                const native = NATIVE_NAMES[code] || name;
                return (
                  <option key={`src-${code}`} value={code}>
                    {name} ({native})
                  </option>
                );
              })}
            </select>
            <div className="select-chevron" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Swap Control */}
        <div className="swap-control-wrapper">
          <button
            type="button"
            onClick={handleSwap}
            disabled={!canSwap || disabled}
            className={`swap-btn ${!canSwap ? 'disabled' : ''}`}
            title={
              canSwap
                ? `Swap ${currentSourceName} and ${currentTargetName}`
                : `Cannot swap: ${currentTargetName} only translates into English or Hindi`
            }
            aria-label={`Swap ${currentSourceName} and ${currentTargetName}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4" />
              <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Target Language Column ("Translate into") */}
        <div className="language-column">
          <div className="language-column-header">
            <span className="language-label-tag target-tag">
              <span className="lang-tag-dot green-dot" aria-hidden="true"></span>
              Translate into
            </span>
            <span className="language-native-badge">{currentTargetNative}</span>
          </div>

          <div className="select-wrapper">
            <select
              id="target-language-select"
              value={targetLang}
              onChange={handleTargetSelect}
              disabled={disabled}
              className="language-select"
              aria-label="Select destination translation language"
            >
              {allowedTargets.map((code) => {
                const name = LANGUAGES[code];
                const native = NATIVE_NAMES[code] || name;
                return (
                  <option key={`tgt-${code}`} value={code}>
                    {name} ({native})
                  </option>
                );
              })}
            </select>
            <div className="select-chevron" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Concise Routing Notice */}
      <div className="routing-notice">
        {sourceLang === 'en' || sourceLang === 'hi' ? (
          <p className="notice-text">
            <strong>Direct Translation:</strong> {currentSourceName} translates directly into all 15 supported languages.
          </p>
        ) : (
          <p className="notice-text">
            <strong>Pivot Route:</strong> {currentSourceName} translates directly into English or Hindi.
          </p>
        )}
      </div>
    </div>
  );
};
