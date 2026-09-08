// src/components/common/FeedbackButton.jsx
"use client";

import React, { useMemo, useState, useRef } from 'react';
import {
  MessageSquarePlus,
  X,
  Bug,
  Lightbulb,
  MessageCircle,
  Camera,
  Trash2,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { validateFileBasics } from '@/lib/uploads/validation';

const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' },
  { id: 'idea', label: 'Feature Idea', icon: Lightbulb, color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/30' },
  { id: 'opinion', label: 'Feedback', icon: MessageCircle, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/30' },
];

const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];
const SCREENSHOT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

const DEFAULT_PAGE_LABEL = 'General';

const safeString = (value, maxLen) => {
  if (value == null) return '';
  let s = String(value);
  // Remove null bytes and other low control chars.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (typeof maxLen === 'number' && maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
};

const FeedbackButton = ({
  currentPageInfo = null,
  team = null,
  user = null,
  activeEnvironment = null,
  activeStrategy = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [pageLabel, setPageLabel] = useState(DEFAULT_PAGE_LABEL);
  const [pageTouched, setPageTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const getBase64ByteLength = (base64 = '') => {
    const sanitized = String(base64).replace(/\s+/g, '');
    const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
    return Math.floor((sanitized.length * 3) / 4) - padding;
  };

  const validateScreenshotFile = (file) => {
    const options = {
      allowedMimeTypes: SCREENSHOT_MIME_TYPES,
      maxBytes: SCREENSHOT_MAX_BYTES,
      allowMissingType: true
    };
    if (file?.name) {
      options.allowedExtensions = SCREENSHOT_EXTENSIONS;
    }
    return validateFileBasics(file, options);
  };

  const resetForm = () => {
    setFeedbackType('bug');
    setTitle('');
    setDescription('');
    setScreenshot(null);
    setPageLabel(DEFAULT_PAGE_LABEL);
    setPageTouched(false);
    setSubmitStatus(null);
    setErrorMessage('');
  };

  const effectivePageSuggestion = useMemo(() => {
    const label =
      safeString(currentPageInfo?.label, 80) ||
      safeString(currentPageInfo?.id, 80) ||
      '';
    return label || '';
  }, [currentPageInfo]);

  const maybeAutoSelectPage = () => {
    // Default is "General". Only auto-select once we have a concrete signal (screenshot action),
    // and only if the user hasn't edited the field.
    if (pageTouched) return;
    if (pageLabel !== DEFAULT_PAGE_LABEL) return;
    if (!effectivePageSuggestion) return;
    setPageLabel(effectivePageSuggestion);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Reset after animation
    setTimeout(resetForm, 200);
  };

  const handleScreenshotUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateScreenshotFile(file);
      if (error) {
        setErrorMessage(error);
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot({
          data: event.target.result,
          name: file.name,
          type: file.type
        });
        maybeAutoSelectPage();
        setErrorMessage('');
      };
      reader.readAsDataURL(file);
    }
  };

  const captureScreenshot = async () => {
    // Store form state before hiding modal
    const currentType = feedbackType;
    const currentTitle = title;
    const currentDescription = description;

    // Hide modal before capture
    setIsOpen(false);

    // Wait for modal to disappear
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // Use Screen Capture API to grab the screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        preferCurrentTab: true
      });

      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Wait a moment for video to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      const base64Payload = dataUrl.split(',')[1] || '';
      const dataUrlBytes = getBase64ByteLength(base64Payload);
      if (dataUrlBytes > SCREENSHOT_MAX_BYTES) {
        throw new Error('Captured image is too large. Please capture a smaller area.');
      }

      // Restore modal with screenshot
      setIsOpen(true);
      setFeedbackType(currentType);
      setTitle(currentTitle);
      setDescription(currentDescription);
      setScreenshot({
        data: dataUrl,
        name: 'screen-capture.png',
        type: 'image/png'
      });
      maybeAutoSelectPage();
      setErrorMessage('');
    } catch (err) {
      // Restore modal even on error
      setIsOpen(true);
      setFeedbackType(currentType);
      setTitle(currentTitle);
      setDescription(currentDescription);

      if (err.name === 'NotAllowedError') {
        setErrorMessage('Screen capture was cancelled. You can also paste an image or upload a file.');
      } else {
        setErrorMessage('Screen capture not supported. Please paste or upload an image instead.');
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const error = validateScreenshotFile(file);
            if (error) {
              setErrorMessage(error);
              return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
              setScreenshot({
                data: event.target.result,
                name: 'pasted-screenshot.png',
                type: file.type
              });
              maybeAutoSelectPage();
              setErrorMessage('');
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const trimmedPageLabel = (pageLabel || '').trim() || DEFAULT_PAGE_LABEL;
      const sanitizedPageLabel = safeString(trimmedPageLabel, 80) || DEFAULT_PAGE_LABEL;

      // Keep URL info useful but avoid leaking long query strings/tokens.
      const safeUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : null;

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: feedbackType,
          title: title.trim(),
          description: description.trim(),
          screenshot: screenshot?.data || null,
          page: sanitizedPageLabel,
          appContext: {
            page: {
              id: safeString(currentPageInfo?.id, 80) || null,
              label: safeString(currentPageInfo?.label, 80) || null,
              sectionId: safeString(currentPageInfo?.sectionId, 80) || null,
              sectionLabel: safeString(currentPageInfo?.sectionLabel, 80) || null,
            },
            team: {
              id: safeString(team?.id, 80) || safeString(team?._id, 80) || null,
              name: safeString(team?.name, 120) || null,
            },
            reporter: {
              id: safeString(user?.id, 80) || safeString(user?._id, 80) || null,
              name: safeString(user?.name, 120) || null,
              email: safeString(user?.email, 160) || null,
            },
            activeEnvironment: {
              id: safeString(activeEnvironment?.id, 80) || safeString(activeEnvironment?._id, 80) || null,
              name: safeString(activeEnvironment?.name, 120) || null,
            },
            activeStrategy: activeStrategy ? {
              id: safeString(activeStrategy?.id, 120) || null,
              name: safeString(activeStrategy?.name, 200) || null,
              domain: safeString(activeStrategy?.protocol, 40) || null,
            } : null,
          },
          context: {
            url: safeUrl,
            pathname: typeof window !== 'undefined' ? window.location.pathname : null,
            userAgent: safeString(typeof navigator !== 'undefined' ? navigator.userAgent : '', 512) || null,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit feedback');
      }

      setSubmitStatus('success');
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      setErrorMessage(err.message);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = FEEDBACK_TYPES.find(t => t.id === feedbackType);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 bg-primary hover:bg-primary/90 text-primary-text rounded-full shadow-lg hover:shadow-xl transition-all group"
        title="Send Feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Send Feedback
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div
            className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200"
            onPaste={handlePaste}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Send Feedback</h2>
              <button
                onClick={handleClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success State */}
            {submitStatus === 'success' ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Thank you!</h3>
                <p className="text-slate-400">Your feedback has been submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Feedback Type Selection */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">What type of feedback?</label>
                  <div className="flex gap-2">
                    {FEEDBACK_TYPES.map(type => {
                      const Icon = type.icon;
                      const isSelected = feedbackType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFeedbackType(type.id)}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                            isSelected
                              ? `${type.bgColor} ${type.borderColor} ${type.color}`
                              : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={feedbackType === 'bug' ? 'Brief description of the issue' : 'Brief summary'}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      feedbackType === 'bug'
                        ? 'Steps to reproduce, expected vs actual behavior...'
                        : feedbackType === 'idea'
                        ? 'Describe your idea and how it would help...'
                        : 'Share your thoughts...'
                    }
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none h-28"
                    maxLength={2000}
                  />
                  <div className="text-xs text-slate-500 text-right mt-1">
                    {description.length}/2000
                  </div>
                </div>

                {/* Screenshot */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Screenshot <span className="text-slate-500">(optional)</span>
                  </label>

                  {screenshot ? (
                    <div className="relative border border-slate-600 rounded-lg overflow-hidden">
                      <img
                        src={screenshot.data}
                        alt="Screenshot preview"
                        className="w-full max-h-40 object-contain bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm">Upload image</span>
                      </button>
                      <button
                        type="button"
                        onClick={captureScreenshot}
                        className="flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
                        title="Capture screenshot"
                      >
                        <Camera className="w-4 h-4" />
                        <span className="text-sm">Capture</span>
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={handleScreenshotUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Tip: Take a screenshot and paste it here (Ctrl/Cmd + V)
                  </p>
                </div>

                {/* Page */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Page</label>
                  <input
                    type="text"
                    value={pageLabel}
                    onChange={(e) => {
                      setPageLabel(e.target.value);
                      setPageTouched(true);
                    }}
                    placeholder={DEFAULT_PAGE_LABEL}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    maxLength={80}
                  />
                  {!pageTouched && effectivePageSuggestion && pageLabel === DEFAULT_PAGE_LABEL && (
                    <div className="mt-1 text-xs text-slate-500">
                      Tip: add a screenshot to auto-select <span className="text-slate-300">{effectivePageSuggestion}</span>.
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {errorMessage && (
                  <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-text font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
