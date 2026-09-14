import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Copy, 
  Check, 
  X, 
  Key, 
  Shield, 
  CheckCircle2, 
  Cpu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import cryptoService from '../services/cryptoService';

export const EncryptionInfoModal = ({ isOpen, onClose, targetUser }) => {
  const { user } = useAuth();
  const { myPublicKey } = useChat();
  const [safetyNumber, setSafetyNumber] = useState('Loading safety number...');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const computeSafetyNumber = async () => {
      const otherKey = targetUser?.publicKey;
      if (myPublicKey && otherKey) {
        const num = await cryptoService.generateSafetyNumber(myPublicKey, otherKey);
        setSafetyNumber(num);
      } else {
        setSafetyNumber('Key verification pending (Recipient has not registered public key yet)');
      }
    };

    computeSafetyNumber();
  }, [isOpen, myPublicKey, targetUser?.publicKey]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const numberBlocks = safetyNumber.split(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="e2ee-modal-title"
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h3 id="e2ee-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
            End-to-End Encrypted
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            Messages with <span className="font-semibold text-slate-700 dark:text-slate-200">{targetUser?.name || 'this contact'}</span> are protected with browser-native encryption.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Safety Number Section */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-500" />
                Safety Number Fingerprint
              </span>
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center space-x-1 transition-all"
                title="Copy safety number"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Formatted Number Grid */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 font-mono text-center">
              {numberBlocks.length === 12 ? (
                <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm font-semibold tracking-wider text-slate-800 dark:text-slate-200">
                  {numberBlocks.map((blk, i) => (
                    <span key={i} className="py-1 px-1.5 rounded-md bg-slate-50 dark:bg-slate-800/80">
                      {blk}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">
                  {safetyNumber}
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Verify this safety number on your contact's screen to ensure your end-to-end encryption is tamper-proof and authentic.
            </p>
          </div>

          {/* Cryptographic Specs Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-2.5">
            <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
              <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Cryptographic Architecture</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between py-1 border-b border-emerald-100/60 dark:border-emerald-900/30">
                <span className="text-slate-500">Key Encapsulation:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">RSA-OAEP 2048-bit (SHA-256)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-emerald-100/60 dark:border-emerald-900/30">
                <span className="text-slate-500">Message Cipher:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">AES-GCM 256-bit (96-bit IV)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-emerald-100/60 dark:border-emerald-900/30">
                <span className="text-slate-500">Platform API:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">W3C Web Crypto API</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Server Knowledge:</span>
                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Zero-Knowledge (Relay only)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default EncryptionInfoModal;
