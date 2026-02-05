import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Connect to Socket.IO through Vite's proxy
// Empty string makes it connect to the same host/port as the page (with proper protocol)
const socket = io('', {
  path: '/socket.io/',
  transports: ['websocket', 'polling']
});

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '🎉', '👋', '🙏', '💀', '🤡', '😱', '🥺', '😴', '🤯', '💩', '👀', '🚀'];

// STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam', icon: '📧' },
  { id: 'harassment', label: 'Harassment', icon: '⚠️' },
  { id: 'inappropriate', label: 'Inappropriate content', icon: '🔞' },
  { id: 'other', label: 'Other', icon: '❓' }
];

function App() {
  const [status, setStatus] = useState('idle'); // idle, nickname, searching, matched
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [nickname, setNickname] = useState('');
  const [partnerNickname, setPartnerNickname] = useState('Stranger');
  const [mySocketId, setMySocketId] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [reportFeedback, setReportFeedback] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  // Video call states
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallFrom, setIncomingCallFrom] = useState('');
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isRemoteAudioEnabled, setIsRemoteAudioEnabled] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Load chat history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }

    // Always show nickname screen on load, but pre-fill saved nickname
    const savedNickname = localStorage.getItem('nickname');
    if (savedNickname) {
      setNickname(savedNickname);
    }
    setStatus('nickname');
  }, []);

  // Save chat history to localStorage
  const saveToHistory = useCallback((newMessages) => {
    const historyItem = {
      id: Date.now(),
      date: new Date().toISOString(),
      partner: partnerNickname,
      messages: newMessages
    };
    const updatedHistory = [historyItem, ...chatHistory].slice(0, 50); // Keep last 50 chats
    setChatHistory(updatedHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedHistory));
  }, [chatHistory, partnerNickname]);

  useEffect(() => {
    // Store my socket ID
    setMySocketId(socket.id);

    socket.on('connect', () => {
      setMySocketId(socket.id);
    });

    // Searching state
    socket.on('searching', () => {
      setStatus('searching');
      setPartnerTyping(false);
    });

    // Matched with someone
    socket.on('matched', ({ roomId, partnerNickname: name }) => {
      setStatus('matched');
      setMessages([]);
      setPartnerTyping(false);
      setReportFeedback('');
      setPartnerNickname(name || 'Stranger');
    });

    // Partner left
    socket.on('partner_left', () => {
      // Save chat before clearing
      if (messages.length > 0) {
        saveToHistory(messages);
      }
      setMessages([]);
      setStatus('searching');
      setPartnerTyping(false);
      setReportFeedback('');
      socket.emit('start');
    });

    // Receive message
    socket.on('message', (msg) => {
      setPartnerTyping(false);
      setMessages((prev) => [...prev, msg]);
    });

    // Partner typing indicator
    socket.on('partner_typing', (isTyping) => {
      setPartnerTyping(isTyping);
    });

    // Report submitted confirmation
    socket.on('report_submitted', ({ count, reason }) => {
      const reasonLabel = REPORT_REASONS.find(r => r.id === reason)?.label || reason;
      setReportFeedback(`Report submitted: ${reasonLabel} (${count}/3)`);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setReportFeedback('');
      }, 3000);
    });

    // Partner was banned
    socket.on('partner_banned', ({ nickname: name }) => {
      // Save chat before clearing
      if (messages.length > 0) {
        saveToHistory(messages);
      }
      setReportFeedback(`${name || 'Partner'} has been banned!`);
      setMessages([]);
      setStatus('searching');
      setPartnerTyping(false);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setReportFeedback('');
        socket.emit('start');
      }, 2000);
    });

    // User is banned
    socket.on('banned', () => {
      setIsBanned(true);
      setStatus('idle');
    });

    // WebRTC: Receive offer from partner
    socket.on('webrtc_offer', async ({ offer }) => {
      if (!peerConnectionRef.current) {
        const stream = await startLocalVideo();
        createPeerConnection(stream);
      }
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit('webrtc_answer', { answer });
      setIsVideoCallActive(true);
      // Flush buffered ICE candidates
      if (peerConnectionRef.current.iceBuffer) {
        for (const candidate of peerConnectionRef.current.iceBuffer) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        peerConnectionRef.current.iceBuffer = [];
      }
    });

    // WebRTC: Receive answer from partner
    socket.on('webrtc_answer', async ({ answer }) => {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      // Flush buffered ICE candidates
      if (peerConnectionRef.current.iceBuffer) {
        for (const candidate of peerConnectionRef.current.iceBuffer) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        peerConnectionRef.current.iceBuffer = [];
      }
    });

    // WebRTC: Receive ICE candidate from partner
    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (peerConnectionRef.current) {
        // Wait for remote description to be set before adding ICE candidates
        if (peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Buffer candidates until remote description is ready
          if (!peerConnectionRef.current.iceBuffer) {
            peerConnectionRef.current.iceBuffer = [];
          }
          peerConnectionRef.current.iceBuffer.push(candidate);
        }
      }
    });

    // Video call: Incoming call request
    socket.on('incoming_video_call', ({ from, nickname: callerName }) => {
      setIsIncomingCall(true);
      setIncomingCallFrom(callerName || 'Stranger');
    });

    // Video call: Response to our call request
    socket.on('video_call_response', async ({ accepted }) => {
      if (accepted) {
        // Only create peer connection if not already created (for caller)
        if (!peerConnectionRef.current) {
          await startLocalVideo();
          createPeerConnection();
        }
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit('webrtc_offer', { offer });
        setIsVideoCallActive(true);
      } else {
        setReportFeedback('Video call declined');
        setTimeout(() => setReportFeedback(''), 3000);
      }
    });

    // Video call: Partner ended the call
    socket.on('video_call_ended', () => {
      endVideoCall();
      setReportFeedback('Partner ended the video call');
      setTimeout(() => setReportFeedback(''), 3000);
    });

    return () => {
      socket.off('connect');
      socket.off('searching');
      socket.off('matched');
      socket.off('partner_left');
      socket.off('message');
      socket.off('partner_typing');
      socket.off('report_submitted');
      socket.off('partner_banned');
      socket.off('banned');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
      socket.off('incoming_video_call');
      socket.off('video_call_response');
      socket.off('video_call_ended');
    };
  }, [messages, partnerNickname]); // Added dependencies to save history properly

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Emit typing event with debounce
  const emitTyping = useCallback((isTyping) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', true);
      }, 300);
    } else {
      socket.emit('typing', false);
      typingTimeoutRef.current = null;
    }
  }, []);

  const handleSetNickname = () => {
    const trimmed = nickname.trim().substring(0, 20);
    if (trimmed) {
      localStorage.setItem('nickname', trimmed);
      socket.emit('set_nickname', trimmed);
      setStatus('idle');
    }
  };

  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);

    if (newText.trim()) {
      emitTyping(true);
    } else {
      emitTyping(false);
    }
  };

  const handleStart = () => {
    setMessages([]);
    setPartnerTyping(false);
    setReportFeedback('');
    setIsBanned(false);
    socket.emit('start');
  };

  const handleNext = () => {
    // Save current chat before moving to next
    if (messages.length > 0) {
      saveToHistory(messages);
    }
    // End video call if active
    if (isVideoCallActive) {
      endVideoCall();
      socket.emit('video_call_end');
    }
    setMessages([]);
    setPartnerTyping(false);
    setReportFeedback('');
    setIsIncomingCall(false);
    socket.emit('next');
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      emitTyping(false);
      socket.emit('message', { text: inputText.trim(), type: 'text' });
      setInputText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiClick = (emoji) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 2MB for safety)
    if (file.size > 2 * 1024 * 1024) {
      setReportFeedback('Image too large (max 2MB)');
      setTimeout(() => setReportFeedback(''), 3000);
      return;
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setReportFeedback('Please select an image file');
      setTimeout(() => setReportFeedback(''), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64 = reader.result;
        if (base64 && typeof base64 === 'string') {
          emitTyping(false);
          socket.emit('message', { text: '', type: 'image', image: base64 });
        }
      } catch (err) {
        console.error('Error processing image:', err);
        setReportFeedback('Failed to send image');
        setTimeout(() => setReportFeedback(''), 3000);
      }
    };
    reader.onerror = () => {
      setReportFeedback('Failed to read image');
      setTimeout(() => setReportFeedback(''), 3000);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReport = (reason) => {
    socket.emit('report', reason);
    setShowReportModal(false);
  };

  const clearHistory = () => {
    setChatHistory([]);
    localStorage.removeItem('chatHistory');
  };

  // WebRTC: Start local video
  const startLocalVideo = async () => {
    // Check if mediaDevices is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = 'Camera/mic access requires HTTPS or localhost. Use localhost for testing.';
      console.error(errorMsg);
      setReportFeedback(errorMsg);
      setTimeout(() => setReportFeedback(''), 5000);
      throw new Error(errorMsg);
    }

    try {
      // Try to get both video and audio first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Explicitly play for iOS Safari
        localVideoRef.current.play().catch(err => console.log('Local video play error:', err));
      }
      return stream;
    } catch (err) {
      console.error('Error accessing video:', err);
      // Fallback to audio only if video fails (e.g., camera already in use)
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        setLocalStream(audioStream);
        setReportFeedback('Camera unavailable - audio only');
        setTimeout(() => setReportFeedback(''), 3000);
        return audioStream;
      } catch (audioErr) {
        console.error('Error accessing audio:', audioErr);
        setReportFeedback('Could not access camera or microphone');
        setTimeout(() => setReportFeedback(''), 3000);
        throw audioErr;
      }
    }
  };

  // WebRTC: Create peer connection
  const createPeerConnection = (stream = null) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream tracks to peer connection
    const tracksToAdd = stream || localStream;
    if (tracksToAdd) {
      tracksToAdd.getTracks().forEach(track => {
        pc.addTrack(track, tracksToAdd);
      });
      console.log('Added local tracks to peer connection:', tracksToAdd.getTracks().map(t => t.kind));
    } else {
      console.warn('No local stream available when creating peer connection');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, 'streams:', event.streams.length);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        // Explicitly play for iOS Safari
        remoteVideoRef.current.play().catch(err => console.log('Remote video play error:', err));
        console.log('Remote video srcObject set');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', { candidate: event.candidate });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected') {
        endVideoCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // WebRTC: Start video call
  const handleStartVideoCall = async () => {
    try {
      const stream = await startLocalVideo();
      createPeerConnection(stream);
      socket.emit('video_call_request');
    } catch (err) {
      console.error('Error starting video call:', err);
    }
  };

  // WebRTC: Accept incoming call
  const handleAcceptCall = async () => {
    setIsIncomingCall(false);
    socket.emit('video_call_response', { accepted: true });
    try {
      const stream = await startLocalVideo();
      createPeerConnection(stream);
      setIsVideoCallActive(true);
    } catch (err) {
      console.error('Error accepting call:', err);
      setReportFeedback('Could not access camera - check if another app is using it');
      setTimeout(() => setReportFeedback(''), 4000);
    }
  };

  // WebRTC: Reject incoming call
  const handleRejectCall = () => {
    setIsIncomingCall(false);
    socket.emit('video_call_response', { accepted: false });
  };

  // WebRTC: End video call
  const endVideoCall = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsVideoCallActive(false);
    setIsIncomingCall(false);
    setIsCameraEnabled(true);
    setIsMicEnabled(true);
  };

  // WebRTC: Toggle camera
  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraEnabled(videoTrack.enabled);
      }
    }
  };

  // WebRTC: Toggle microphone
  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicEnabled(audioTrack.enabled);
      }
    }
  };

  // Banned screen
  if (isBanned) {
    return (
      <div className="app">
        <div className="container">
          <header>
            <h1>Random Chat</h1>
          </header>
          <div className="idle-screen">
            <p style={{ color: '#ef4444', fontWeight: 600 }}>
              You have been banned from this service.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Nickname screen
  if (status === 'nickname') {
    return (
      <div className="app">
        <div className="container">
          <header>
            <h1>Random Chat</h1>
          </header>
          <div className="idle-screen">
            <p>Choose a nickname to get started</p>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSetNickname()}
              placeholder="Enter nickname..."
              className="nickname-input"
              maxLength={20}
            />
            <button className="btn-primary" onClick={handleSetNickname} disabled={!nickname.trim()}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <header>
          <div className="header-top">
            <h1>Random Chat</h1>
            <button className="icon-btn" onClick={() => setShowHistoryModal(true)} title="Chat history">
              📜
            </button>
          </div>
          <div className={`status ${status}`}>
            {status === 'idle' && `Ready (${nickname || 'Anonymous'})`}
            {status === 'searching' && 'Searching for someone...'}
            {status === 'matched' && `Chatting with ${partnerNickname}`}
          </div>
        </header>

        {status === 'idle' && (
          <div className="idle-screen">
            <p>Click Start to find a random person to chat with</p>
            <button className="btn-primary" onClick={handleStart}>
              Start
            </button>
          </div>
        )}

        {(status === 'searching' || status === 'matched') && (
          <div className="chat-wrapper">
            {/* Incoming call modal */}
            {isIncomingCall && (
              <div className="modal-overlay">
                <div className="modal incoming-call-modal">
                  <h3>📹 Incoming Video Call</h3>
                  <p>{incomingCallFrom} wants to video chat with you!</p>
                  <div className="call-buttons">
                    <button className="btn-accept" onClick={handleAcceptCall}>
                      📞 Accept
                    </button>
                    <button className="btn-reject" onClick={handleRejectCall}>
                      ✕ Decline
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Video call UI */}
            {isVideoCallActive && (
              <div className="video-call-container">
                <div className="video-wrapper">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted={!isRemoteAudioEnabled}
                    className="remote-video"
                  />
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="local-video"
                  />
                  <div className="video-controls">
                    <button
                      className={`video-control-btn ${!isCameraEnabled ? 'off' : ''}`}
                      onClick={toggleCamera}
                      title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                    >
                      {isCameraEnabled ? '📹' : '📹❌'}
                    </button>
                    <button
                      className={`video-control-btn ${!isMicEnabled ? 'off' : ''}`}
                      onClick={toggleMic}
                      title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                    >
                      {isMicEnabled ? '🎤' : '🎤❌'}
                    </button>
                    <button
                      className={`video-control-btn ${!isRemoteAudioEnabled ? 'off' : ''}`}
                      onClick={() => setIsRemoteAudioEnabled(!isRemoteAudioEnabled)}
                      title={isRemoteAudioEnabled ? 'Mute remote audio' : 'Unmute remote audio'}
                    >
                      {isRemoteAudioEnabled ? '🔊' : '🔇'}
                    </button>
                    <button
                      className="video-control-btn end-call"
                      onClick={() => {
                        endVideoCall();
                        socket.emit('video_call_end');
                      }}
                      title="End call"
                    >
                      📞✕
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="chat-window">
              {reportFeedback && (
                <div className="report-feedback">{reportFeedback}</div>
              )}
              {partnerTyping && (
                <div className="typing-indicator">
                  {partnerNickname} is typing<span className="typing-dots">...</span>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="empty-state">
                  {status === 'searching'
                    ? 'Waiting for someone to connect...'
                    : `Say hello to ${partnerNickname}!`}
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => {
                    const isMyMessage = msg?.from === mySocketId;
                    const senderName = isMyMessage ? nickname : (msg?.nickname || 'Stranger');
                    const isImage = msg?.type === 'image';
                    const imageUrl = msg?.image;
                    const messageText = msg?.text || '';

                    return (
                      <div
                        key={index}
                        className={`message ${
                          isMyMessage ? 'my-message' : 'stranger-message'
                        }`}
                      >
                        <div className="message-sender">
                          {senderName}
                        </div>
                        {isImage && imageUrl ? (
                          <img src={imageUrl} alt="Shared image" className="message-image" />
                        ) : messageText ? (
                          <div className="message-bubble">{messageText}</div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            <div className="input-area">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button
                className="icon-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                title="Emoji"
              >
                😀
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  {EMOJIS.map((emoji, i) => (
                    <button
                      key={i}
                      className="emoji-btn"
                      onClick={() => handleEmojiClick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Send image"
              >
                📷
              </button>
              <textarea
                value={inputText}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={status !== 'matched'}
                rows={2}
              />
              <button
                className="btn-send"
                onClick={handleSendMessage}
                disabled={status !== 'matched' || !inputText.trim()}
              >
                Send
              </button>
            </div>

            <div className="action-buttons">
              <button className="btn-video" onClick={handleStartVideoCall} disabled={status !== 'matched' || isVideoCallActive || isIncomingCall}>
                {isVideoCallActive ? '📹 Active' : '📹 Video Call'}
              </button>
              <button className="btn-report" onClick={() => setShowReportModal(true)} disabled={status !== 'matched'}>
                Report
              </button>
              <button className="btn-next" onClick={handleNext}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Report {partnerNickname}</h3>
            <p>Choose a reason for reporting:</p>
            <div className="report-reasons">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  className="report-reason-btn"
                  onClick={() => handleReport(reason.id)}
                >
                  <span className="report-icon">{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>
            <button className="modal-close" onClick={() => setShowReportModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chat History</h3>
              <button className="modal-close-x" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            {chatHistory.length === 0 ? (
              <div className="empty-state">No chat history yet</div>
            ) : (
              <div className="history-list">
                {chatHistory.map((chat) => (
                  <div key={chat.id} className="history-item">
                    <div className="history-header">
                      <span className="history-partner">With: {chat.partner}</span>
                      <span className="history-date">
                        {new Date(chat.date).toLocaleDateString()} {new Date(chat.date).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="history-messages">
                      {chat.messages.slice(0, 3).map((msg, i) => (
                        <div key={i} className="history-preview">
                          {msg.nickname}: {msg.type === 'image' ? '[Image]' : msg.text?.substring(0, 50)}
                          {msg.text && msg.text.length > 50 ? '...' : ''}
                        </div>
                      ))}
                      {chat.messages.length > 3 && (
                        <div className="history-more">+{chat.messages.length - 3} more messages</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-footer">
              <button className="btn-secondary" onClick={clearHistory} disabled={chatHistory.length === 0}>
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
