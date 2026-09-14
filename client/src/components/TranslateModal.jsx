import React, { useState } from 'react';
import { X, Globe, Check, Loader2 } from 'lucide-react';

const LANGUAGES = [
  { code: 'es', name: 'Spanish', flag: '????' },
  { code: 'fr', name: 'French', flag: '????' },
  { code: 'de', name: 'German', flag: '????' },
  { code: 'it', name: 'Italian', flag: '????' },
  { code: 'pt', name: 'Portuguese', flag: '????' },
  { code: 'ru', name: 'Russian', flag: '????' },
  { code: 'ja', name: 'Japanese', flag: '????' },
  { code: 'zh', name: 'Chinese', flag: '????' },
  { code: 'hi', name: 'Hindi', flag: '????' },
  { code: 'ar', name: 'Arabic', flag: '????' },
];

export const TranslateModal = ({ isOpen, onClose, message, onTranslate }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('Spanish');
  const [isTranslating, setIsTranslating] = useState(false);

  // Handle Escape key
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const handleConfirm = async () => {
    setIsTranslating(true);
    try {
      await onTranslate(message, selectedLanguage);
      onClose();
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="translate-modal-title"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 id="translate-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Translate Message
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select target language
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="p-3 mx-4 mt-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 italic line-clamp-2 border border-slate-200/60 dark:border-slate-700/60">
          "{message.text}"
        </div>

        {/* Language Grid */}
        <div className="p-4 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.name;
            return (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.name)}
                className={`flex items-center justify-between p-2 rounded-xl text-xs font-medium border transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 px-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isTranslating}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Translating...</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>Translate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TranslateModal;
