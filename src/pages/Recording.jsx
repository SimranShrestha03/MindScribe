import { useState } from 'react';
import { useJournal } from '../context/JournalContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { processTranscription } from '../services/llmService';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Recording() {
  const {
    navigate,
    setCurrentEntry,
    pendingCategory,
    pendingMood,
    setPendingMood,
  } = useJournal();

  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    isSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const [hasStarted, setHasStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);

  const handleStart = () => {
    setHasStarted(true);
    startListening();
  };

  const handleStop = async () => {
    stopListening();
    const fullTranscript = (transcript + ' ' + interimTranscript).trim();

    if (!fullTranscript) {
      navigate('home');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    try {
      const result = await processTranscription(fullTranscript, { mood: pendingMood });
      const { cleaned_text, ...rest } = result;
      setCurrentEntry({ user_text: cleaned_text || fullTranscript, type: pendingCategory, ...rest });
      setPendingMood(null);
      navigate('results');
    } catch (err) {
      setProcessingError(err.message);
      setIsProcessing(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm fade-up">
          <div className="text-5xl mb-4">🎤</div>
          <h2 className="text-xl font-bold text-white mb-2">Not Supported</h2>
          <p className="text-slate-400 mb-6">
            Web Speech API requires Chrome or Edge. Please switch browsers and try again.
          </p>
          <Button variant="secondary" onClick={() => navigate('home')}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="Analysing your thoughts..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <button
        onClick={() => navigate('home')}
        className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="w-full max-w-lg text-center fade-up">
        {!hasStarted ? (
          <>
            <div className="mb-8">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-900/50 mb-6">
                <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-violet-400 capitalize tracking-wider mb-2">
                {pendingCategory}
              </p>
              <h2 className="text-2xl font-bold text-white mb-2">Ready to listen</h2>
              <p className="text-slate-400">
                Share whatever is on your mind; no structure needed, just speak freely.
              </p>
            </div>
            <Button variant="primary" onClick={handleStart} className="w-full py-4 text-base">
              Start Recording
            </Button>
          </>
        ) : (
          <>
            <div className="mb-8">
              {isListening ? (
                <>
                  <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-violet-600/20 ring-pulse" />
                    <div className="absolute inset-2 rounded-full bg-violet-600/10 ring-pulse" style={{ animationDelay: '0.5s' }} />
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4z" />
                        <path d="M19 11a7 7 0 01-14 0H3a9 9 0 0018 0h-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-center mb-3 h-8">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <p className="text-violet-400 font-semibold text-lg">Listening...</p>
                  <p className="text-slate-600 text-sm mt-1">Click stop when you're done</p>
                </>
              ) : (
                <p className="text-slate-400">Stopping...</p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 text-left min-h-[80px]">
              <p className="text-sm text-slate-300 leading-relaxed">
                {transcript}
                <span className="text-slate-500">{interimTranscript}</span>
                {!transcript && !interimTranscript && (
                  <span className="text-slate-700 italic">Your words will appear here...</span>
                )}
              </p>
            </div>

            {(speechError || processingError) && (
              <p className="text-red-400 text-sm mb-4">{speechError || processingError}</p>
            )}

            {isListening && (
              <Button
                variant="danger"
                onClick={handleStop}
                className="w-full py-4 text-base"
                icon={<div className="w-3 h-3 rounded-sm bg-red-300" />}
              >
                Stop Recording
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
