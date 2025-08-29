import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';

const RobotAvatar = () => (
  <div style={{
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    zIndex: 10
  }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="white" />
      <path d="M14 10V6H10V10H6V14H10V18H14V14H18V10H14Z" fill="#E60000" />
    </svg>
  </div>
);

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};



export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scenarioData, setScenarioData] = useState(location.state || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [dispatchRequested, setDispatchRequested] = useState(false); // Track if we've requested a dispatch
  const dispatchRequestedRef = useRef(false); // Ref to track if dispatch has been requested
  const [isListening, setIsListening] = useState(false); // Voice input state
  const messagesEndRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const rafIdRef = useRef(null);
  const recognitionRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Detect variations of the user indicating they are ready
  const isReadyMessage = (text) => {
    if (!text) return false;
    const normalized = String(text).trim().toLowerCase();
    // Match: "ready", "i'm ready", "im ready", "lets begin", "let's start", "begin", "start timer"
    return (
      /\b(i['’]?m\s*)?ready\b/.test(normalized) ||
      /^ready$/.test(normalized) ||
      /\blet['’]?s\s*(start|begin)\b/.test(normalized) ||
      /\bbegin\b/.test(normalized) ||
      /\bstart\b.*\btimer\b/.test(normalized)
    );
  };

  // Helper to format assistant response for better readability
  const formatAssistantText = (text) => {
    if (!text) return text;
    let result = text;
    // Normalize plain 'Dispatch Information' heading and ensure single colon
    result = result.replace(/^\s*(?:\*\*)?Dispatch Information(?::+)?(?:\*\*)?/i, '**Dispatch Information:**');
    // Replace any variation of Dispatch Information with single colon
    result = result.replace(/\*\*Dispatch Information:+\*\*/i, '**Dispatch Information:**');
    // Remove ellipses from the generated text (e.g., "...")
    result = result.replace(/\.\.\.+/g, '');
    // Convert markdown bold to HTML <strong>
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Remove any extra colon right after the bold heading
    result = result.replace(/(<strong>Dispatch Information:<\/strong>):+/i, '$1');
    // Convert newline to <br/> 
    result = result.replace(/\n/g, '<br/>');
    return result;
  };

  // Generate dispatch note function is no longer used but kept for reference
  // const generateDispatchNote = () => { /* static messages removed */ };

  // Initialize: when scenario data is present, automatically ask the chatbot to generate a dispatch note
  useEffect(() => {
    if (scenarioData && !dispatchRequestedRef.current) {
      dispatchRequestedRef.current = true; // Mark as requested immediately
      setDispatchRequested(true);

      const { subScenario } = scenarioData;
      const prompt = `Generate a ${subScenario} scenario for me.`;

      // Clear any existing messages so we only show the upcoming dispatch
      setMessages([]);

      // Async function to send the prompt to the backend
      (async () => {
        await sendMessageToAPI(prompt);
      })();
    }
  }, [scenarioData]); // Only depend on scenarioData

  useEffect(() => {
    let timer;
    if (isTimerRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, timeLeft]);

  // Auto-scroll to latest message on updates
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Function to send message to backend API
  const sendMessageToAPI = async (message) => {
    try {
      setIsLoading(true);

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversation: conversation,
          scenarioData: scenarioData // Include scenario data
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update scenario data if enhanced data is returned
        if (data.data.scenarioData && data.data.scenarioData.generatedScenario) {
          setScenarioData(data.data.scenarioData);
        }

        // Add user message to conversation
        const updatedConversation = [
          ...conversation,
          { role: 'user', content: message },
          { role: 'assistant', content: data.data.response }
        ];

        setConversation(updatedConversation);

        // Add AI response to messages (formatted for readability)
        const formattedResponse = formatAssistantText(data.data.response);
        setMessages(prev => [...prev, { sender: 'ai', text: formattedResponse }]);

        // Check for readiness message to start timer (safety check on response path)
        if (!isTimerRunning && isReadyMessage(message)) setIsTimerRunning(true);
      } else {
        // Handle API error
        setMessages(prev => [...prev, {
          sender: 'ai',
          text: `Error: ${data.error}. Please try again.`
        }]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Sorry, there was an error connecting to the server. Please check if the backend is running.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-resize the input area as text grows (typing or voice input)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 120; // px, roughly ~6 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [input]);

  // Voice recognition functions
  const stopListening = async () => {
    try {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      // Stop SpeechRecognition first so it doesn't auto-restart
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onstart = null;
        } catch (_) { }
        try { recognitionRef.current.stop(); } catch (_) { }
        try { recognitionRef.current.abort(); } catch (_) { }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch (_) {
      // ignore
    } finally {
      setMicLevel(0);
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) { }
      }
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (_) { }
      }
    };
  }, []);

  const startListening = async () => {
    try {
      // Tear down any prior session
      if (recognitionRef.current) {
        try { recognitionRef.current.onend = null; recognitionRef.current.onerror = null; } catch (_) { }
        try { recognitionRef.current.stop(); } catch (_) { }
        try { recognitionRef.current.abort(); } catch (_) { }
        recognitionRef.current = null;
      }
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        try { await audioContextRef.current.close(); } catch (_) { }
        audioContextRef.current = null;
      }

      // Start microphone stream with recommended constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      // Visual mic meter
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const animate = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for (let i = 0; i < bufferLength; i++) sum += dataArray[i] || 0;
        const avg = sum / bufferLength; setMicLevel(Math.min(1, avg / 180));
        rafIdRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Record with MediaRecorder and send to backend when stopped (push-to-talk)
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      setIsListening(true);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const resp = await fetch('http://localhost:3000/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: `data:audio/webm;base64,${base64}` })
          });
          const data = await resp.json();
          if (data && data.success && data.data && data.data.text) {
            setInput(prev => (prev ? (prev + ' ' + data.data.text).trim() : data.data.text));
          } else {
            console.error('Transcription failed:', data?.error);
          }
        } catch (err) {
          console.error('Transcription error:', err);
        } finally {
          await stopListening();
        }
      };
      rec.start();
      recognitionRef.current = rec; // reuse ref holder for uniform teardown
    } catch (err) {
      console.error('Microphone error:', err);
      stopListening();
    }
  };

  // Removed confirm/cancel voice draft workflow; mic toggles listening and fills input live

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    // If currently recording, stop immediately when sending
    if (isListening) {
      await stopListening();
    }

    const userMessage = { sender: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);

    const messageText = input.trim();
    setInput('');

    // Start timer immediately if the user indicates readiness
    if (!isTimerRunning && isReadyMessage(messageText)) {
      setIsTimerRunning(true);
    }

    // Only repeat the readiness message if the scenario hasn't started yet
    const hasScenarioStarted = messages.some(msg => msg.text && msg.text.includes("You arrive at"));

    if (!isReadyMessage(messageText) && !hasScenarioStarted) {
      setMessages(prev => [...prev, {
        sender: 'ai',
        text: "Let me know when you are ready to begin the scenario. It is recommended that you use voice input to practice your verbal communication skills."
      }]);
    } else {
      // Send message to API
      await sendMessageToAPI(messageText);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1e3a8a',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white'
      }}>
        <Header timeLeft={timeLeft} isTimerRunning={isTimerRunning} />
      </div>
      <div style={{
        marginTop: '76px', // Adjust this value based on your header height
        flexGrow: 1,
        overflowY: 'auto',
        padding: '2rem',
        paddingBottom: '100px'
      }}>

        <div style={{ marginBottom: '2rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              marginBottom: '1rem',
              padding: '0 50px',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
            }}>
              {msg.sender === 'ai' && <RobotAvatar />}
              <div style={{
                maxWidth: 'min(680px, 85%)',
                width: 'fit-content',
                margin: 0,
                backgroundColor: msg.sender === 'user' ? '#E60000' : 'white',
                color: msg.sender === 'user' ? 'white' : '#000000',
                borderRadius: msg.sender === 'user' ? '1.5rem 1.5rem 0.5rem 1.5rem' : '1.5rem 1.5rem 1.5rem 0.5rem',
                padding: '1rem',
                textAlign: 'left',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                wordWrap: 'break-word',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                position: 'relative',
                zIndex: 1
              }}>
                {msg.sender === 'ai' ? (<span dangerouslySetInnerHTML={{ __html: msg.text }} />) : msg.text}
              </div>
              {msg.sender === 'user' && (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  position: 'relative',
                  zIndex: 10
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="#666" />
                  </svg>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />

          {/* Loading indicator */}
          {isLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1rem',
              marginBottom: '1.5rem',
              justifyContent: 'flex-start'
            }}>
              <RobotAvatar />
              <div style={{
                maxWidth: '80%',
                width: 'fit-content',
                backgroundColor: 'white',
                borderRadius: '1.5rem 1.5rem 1.5rem 0.5rem',
                padding: '1rem',
                color: '#000000',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: '#E60000',
                    animation: 'pulse 1.5s ease-in-out infinite'
                  }}></div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'center',
        background: '#1e3a8a',
        zIndex: 1000
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '600px',
            backgroundColor: 'white',
            borderRadius: '25px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isLoading ? "Please wait..." : "Say/type your response"}
              disabled={isLoading}
              rows={1}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                color: '#333',
                fontSize: '13px',
                fontFamily: 'inherit',
                fontWeight: 400,
                lineHeight: '1.5',
                outline: 'none',
                padding: '8px 12px',
                opacity: isLoading ? 0.6 : 1,
                resize: 'none',
                overflowY: 'auto',
              }}
            />
            {/* Voice input button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              style={{
                background: isListening ? '#ffebee' : 'none',
                border: 'none',
                color: isListening ? '#E60000' : (isLoading || isListening ? '#666' : '#666'),
                cursor: isLoading ? 'not-allowed' : 'pointer',
                padding: '8px',
                outline: 'none',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isListening ? `scale(${(1 + Math.min(0.35, micLevel * 0.6)).toFixed(3)})` : 'scale(1)',
                transition: 'transform 80ms linear, background-color 0.2s ease, color 0.2s ease',
                marginRight: '8px',
                animation: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.backgroundColor = '#f0f0f0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor" />
              </svg>
            </button>
            {/* Removed waveform and confirm/cancel controls */}
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                background: 'none',
                border: 'none',
                color: isLoading || !input.trim() ? '#666' : '#E60000',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                padding: '8px',
                outline: 'none',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && input.trim()) {
                  e.target.style.backgroundColor = '#f0f0f0';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && input.trim()) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}