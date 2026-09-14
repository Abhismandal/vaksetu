import React, { useState, useRef } from 'react';
import { 
  Send, 
  Smile, 
  Paperclip, 
  Image as ImageIcon, 
  Mic, 
  Sparkles, 
  X,
  FileText,
  Loader2,
  AlertCircle,
  Check, 
  Undo2, 
  Wand2,
  Lock,
  Unlock
} from 'lucide-react';
import { useChat } from '../context/ChatContext';
import chatService from '../services/chatService';
import SmartRepliesBar from './SmartRepliesBar';
import VoiceRecorderBar from './VoiceRecorderBar';

const REWRITE_STYLES = [
  { id: 'professional', label: 'Professional', desc: 'Polite & business-ready', icon: '💼' },
  { id: 'casual', label: 'Casual', desc: 'Warm & conversational', icon: '😊' },
  { id: 'concise', label: 'Concise', desc: 'Brief & direct', icon: '⚡' },
  { id: 'fix_grammar', label: 'Fix Grammar', desc: 'Correct typos & grammar', icon: '✨' },
];

export const MessageInput = () => {
  const { 
    activeConversation, 
    sendMessage, 
    replyingTo, 
    setReplyingTo,
    sendTypingStart,
    sendTypingStop,
    activeMessages,
    isE2EEEnabled,
    setIsE2EEEnabled
  } = useChat();

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]); // items: { tempId, name, size, type, url, filename, status, progress, error }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showRewriteMenu, setShowRewriteMenu] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [undoText, setUndoText] = useState(null);
  const [activeRewriteStyle, setActiveRewriteStyle] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const emojis = ['😀', '😂', '😍', '🔥', '👍', '🎉', '🚀', '❤️', '💡', '✨', '🙏', '🙌', '💯', '🤔'];

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;

    // Trigger typing event
    sendTypingStart();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop();
    }, 2000);
  };

  const handleSend = (e) => {
    if (e) e.preventDefault();

    const isUploadingAny = attachments.some((a) => a.status === 'uploading');
    if (isUploadingAny) return;

    const completedAttachments = attachments
      .filter((a) => a.status === 'done')
      .map(({ url, name, size, type, filename }) => ({
        url,
        name,
        size,
        type,
        filename,
      }));

    if (!text.trim() && completedAttachments.length === 0) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendTypingStop();

    sendMessage(text.trim(), completedAttachments, replyingTo);

    setText('');
    setAttachments([]);
    setErrorMessage('');
    setShowEmojiPicker(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (replyingTo) setReplyingTo(null);
      if (showEmojiPicker) setShowEmojiPicker(false);
      if (showRewriteMenu) setShowRewriteMenu(false);
    }
  };

  // Upload file handler
  const handleFiles = async (filesList) => {
    if (!filesList || filesList.length === 0) return;
    setErrorMessage('');

    const maxFileSize = 25 * 1024 * 1024; // 25 MB
    const fileArray = Array.from(filesList);

    const validFiles = [];
    for (const f of fileArray) {
      if (f.size > maxFileSize) {
        setErrorMessage(`"${f.name}" exceeds the 25 MB file size limit`);
        return;
      }
      validFiles.push(f);
    }

    // Add files to state with 'uploading' status and preview URL
    const newItems = validFiles.map((file, idx) => ({
      tempId: `${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      url: URL.createObjectURL(file),
      status: 'uploading',
      progress: 0,
      file,
    }));

    setAttachments((prev) => [...prev, ...newItems]);

    // Upload files sequentially or concurrently
    for (const item of newItems) {
      try {
        const res = await chatService.uploadFile(item.file, (percent) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.tempId === item.tempId ? { ...a, progress: percent } : a
            )
          );
        });

        if (res.success && res.file) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.tempId === item.tempId
                ? {
                    ...a,
                    status: 'done',
                    progress: 100,
                    url: res.file.url,
                    filename: res.file.filename,
                  }
                : a
            )
          );
        } else {
          throw new Error(res.message || 'Upload failed');
        }
      } catch (err) {
        console.error('File upload error:', err);
        setAttachments((prev) =>
          prev.map((a) =>
            a.tempId === item.tempId
              ? {
                  ...a,
                  status: 'error',
                  error: err.response?.data?.message || err.message || 'Upload failed',
                }
              : a
          )
        );
      }
    }
  };

  const handleFileSelect = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const removeAttachment = async (tempId, filename) => {
    setAttachments((prev) => prev.filter((a) => a.tempId !== tempId));
    if (filename) {
      try {
        await chatService.deleteUploadedFile(filename);
      } catch (err) {
        // silent cleanup failure
      }
    }
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const isUploadingAny = attachments.some((a) => a.status === 'uploading');

  const handleRewrite = async (style) => {
    if (!text.trim()) return;
    try {
      setIsRewriting(true);
      setErrorMessage('');
      const res = await chatService.rewriteMessage(text.trim(), style);
      if (res.success && res.result) {
        setUndoText(text);
        setActiveRewriteStyle(style);
        setText(res.result);
        setShowRewriteMenu(false);
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      } else {
        setErrorMessage(res.message || 'Failed to rewrite message');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Rewriting failed');
    } finally {
      setIsRewriting(false);
    }
  };

  const handleUndoRewrite = () => {
    if (undoText !== null) {
      setText(undoText);
      setUndoText(null);
      setActiveRewriteStyle(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
      }
    }
  };

  const handleSendVoiceMessage = async ({ file, duration }) => {
    try {
      setIsRecordingVoice(false);
      setErrorMessage('');
      const uploadRes = await chatService.uploadFile(file);
      if (uploadRes.success && uploadRes.file) {
        const attachment = {
          url: uploadRes.file.url,
          name: uploadRes.file.name || file.name,
          type: uploadRes.file.type || file.type || 'audio/webm',
          size: uploadRes.file.size || file.size,
          duration,
        };
        const formatSecs = (s) => `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;
        sendMessage(`🎙️ Voice message (${formatSecs(duration)})`, [attachment], replyingTo, 'voice');
      } else {
        setErrorMessage(uploadRes.message || 'Failed to upload voice message');
      }
    } catch (err) {
      console.error('Voice send error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to send voice message');
    }
  };

  if (isRecordingVoice) {
    return (
      <div className="flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 transition-all">
        <VoiceRecorderBar
          onSendVoice={handleSendVoiceMessage}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 transition-all">
      {/* Step 15: AI Contextual Smart Replies Bar */}
      <SmartRepliesBar
        conversationId={activeConversation?._id}
        messages={activeMessages}
        onSelectReply={(suggestion) => {
          setText(suggestion);
          setUndoText(null);
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = 'auto';
          }
        }}
      />

      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-3 sm:p-4 transition-all ${
          isDragging
            ? 'ring-2 ring-indigo-500 ring-inset bg-indigo-50/40 dark:bg-indigo-950/40'
            : ''
        }`}
      >
        {/* Drag & Drop Visual Overlay Cue */}
        {isDragging && (
          <div className="mb-2 p-3 rounded-2xl border-2 border-dashed border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-300 animate-pulse">
            Drop files here to upload
          </div>
        )}

        {/* AI Rewrite Undo Notification Banner */}
        {undoText && (
          <div className="mb-2 p-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 animate-in fade-in">
            <div className="flex items-center space-x-1.5 truncate">
              <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
              <span>
                Rewritten with AI (<strong>{activeRewriteStyle}</strong>)
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={handleUndoRewrite}
                className="inline-flex items-center space-x-1 font-semibold text-purple-700 dark:text-purple-300 hover:underline"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
              <button
                onClick={() => setUndoText(null)}
                className="p-0.5 text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="mb-2 p-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
          <div className="flex items-center space-x-2 truncate">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="p-1 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="mb-2 p-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-between border-l-4 border-indigo-600 text-xs">
          <div className="min-w-0 pr-2">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 block truncate">
              Replying to {replyingTo.sender?.name || 'User'}
            </span>
            <p className="text-slate-500 dark:text-slate-400 truncate">
              {replyingTo.text}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment Previews with Upload Progress */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2.5 mb-2.5">
          {attachments.map((att) => {
            const isImage = att.type?.startsWith('image/');
            const isUploading = att.status === 'uploading';
            const hasError = att.status === 'error';

            return (
              <div
                key={att.tempId}
                className="relative group p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center space-x-2 text-xs overflow-hidden"
              >
                {/* Thumbnail / Icon */}
                <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  {isImage ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-6 h-6 text-indigo-500" />
                  )}

                  {/* Uploading overlay */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
                      <Loader2 className="w-4 h-4 animate-spin mb-0.5" />
                      <span className="text-[9px] font-bold">{att.progress}%</span>
                    </div>
                  )}

                  {/* Error overlay */}
                  {hasError && (
                    <div className="absolute inset-0 bg-rose-600/80 flex items-center justify-center text-white">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="max-w-[130px] pr-5 truncate">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                    {att.name}
                  </p>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                    <span>{(att.size / 1024).toFixed(1)} KB</span>
                    {att.status === 'done' && (
                      <span className="text-emerald-500 flex items-center">
                        • <Check className="w-3 h-3 ml-0.5" />
                      </span>
                    )}
                    {hasError && (
                      <span className="text-rose-500 font-semibold">• Error</span>
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.tempId, att.filename)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 hover:bg-rose-500 hover:text-white transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="mb-2 p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl flex flex-wrap gap-1.5 max-w-xs animate-in fade-in zoom-in-95">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-lg hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Main Input Controls Row */}
      <div className="flex items-end space-x-2">
        {/* Media & Attachment Buttons */}
        <div className="flex items-center space-x-1 pb-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            aria-label="Add emoji"
            className={`p-2 rounded-xl transition-colors ${
              showEmojiPicker
                ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            aria-label="Upload image"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Upload Image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Attach Document / File (up to 25 MB)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* E2EE Lock Toggle Button */}
          {!activeConversation?.isAi && (
            <button
              type="button"
              onClick={() => setIsE2EEEnabled(!isE2EEEnabled)}
              aria-label="Toggle end-to-end encryption"
              className={`p-2 rounded-xl transition-all ${
                isE2EEEnabled
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={
                isE2EEEnabled
                  ? 'End-to-End Encryption active (Click to pause)'
                  : 'End-to-End Encryption paused (Click to enable)'
              }
            >
              {isE2EEEnabled ? (
                <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Unlock className="w-5 h-5 text-slate-400" />
              )}
            </button>
          )}

          {/* AI Message Rewriter Button & Popover */}
          <div className="relative">
            <button
              type="button"
              disabled={isRewriting}
              onClick={() => setShowRewriteMenu(!showRewriteMenu)}
              aria-label="AI message rewriter"
              className={`p-2 rounded-xl transition-all ${
                showRewriteMenu || isRewriting
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 ring-1 ring-purple-400'
                  : 'text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950/50'
              }`}
              title="AI Message Rewriter (Professional, Casual, Concise, Fix Grammar)"
            >
              {isRewriting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>

            {/* Rewrite Tone Selector Popover */}
            {showRewriteMenu && (
              <div className="absolute bottom-full mb-2 left-0 z-30 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 text-xs animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>AI Rewrite Tone</span>
                  <Sparkles className="w-3 h-3 text-purple-500" />
                </div>
                <div className="py-1 space-y-0.5">
                  {REWRITE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      disabled={isRewriting || !text.trim()}
                      onClick={() => handleRewrite(style.id)}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center space-x-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-600 dark:hover:text-purple-300 disabled:opacity-40 transition-colors"
                    >
                      <span className="text-base">{style.icon}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {style.label}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {style.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {!text.trim() && (
                  <p className="px-2.5 py-1 text-[10px] text-amber-500 italic text-center">
                    Type message text first to rewrite
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            aria-label="Message text"
            placeholder={
              activeConversation?.isAi
                ? 'Ask VakSetu AI anything...'
                : 'Type a message (Enter to send, Shift+Enter for new line)...'
            }
            className="w-full py-2.5 px-4 text-sm rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none max-h-36 transition-all"
          />
        </div>

        {/* Action button: Mic or Send */}
        <div className="pb-1 flex items-center space-x-1">
          {text.trim() || attachments.length > 0 ? (
            <button
              disabled={isUploadingAny}
              onClick={handleSend}
              aria-label="Send message"
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              title={isUploadingAny ? 'Uploading attachments...' : 'Send Message'}
            >
              {isUploadingAny ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecordingVoice(!isRecordingVoice)}
              aria-label="Record voice message"
              className={`p-2.5 rounded-xl transition-all ${
                isRecordingVoice
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Voice message (Step 16)"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};

export default MessageInput;
