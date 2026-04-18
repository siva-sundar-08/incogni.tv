import { useEffect, useRef, useState } from 'react';
import Controls from '../components/Controls';
import VideoBox from '../components/VideoBox';
import { socketService } from '../services/socket';
import { WebRTCService } from '../services/webrtc';

const createMessage = (author, text) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  author,
  text,
  sentAt: Date.now()
});

const ChatPage = ({ localStream, onExit }) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState('Connecting to Incogni.tv...');
  const [stats, setStats] = useState({ online: 0, waiting: 0, activeSessions: 0 });
  const [messages, setMessages] = useState([
    createMessage('system', 'Be kind. Skip or report if the chat feels wrong.')
  ]);
  const [messageDraft, setMessageDraft] = useState('');

  const webrtcRef = useRef(null);
  const mountedRef = useRef(false);
  const chatLogRef = useRef(null);
  const cleanupHandlersRef = useRef([]);

  useEffect(() => {
    mountedRef.current = true;

    if (!localStream?.active) {
      setIsSearching(false);
      setStatus('Camera or microphone is not available.');
      return undefined;
    }

    startConnection();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [localStream]);

  useEffect(() => {
    chatLogRef.current?.scrollTo({
      top: chatLogRef.current.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  const addSystemMessage = (text) => {
    setMessages((current) => [...current, createMessage('system', text)]);
  };

  const unbindSocketHandlers = () => {
    cleanupHandlersRef.current.forEach((off) => off());
    cleanupHandlersRef.current = [];
  };

  const resetPeerConnection = async () => {
    webrtcRef.current?.close();
    const service = new WebRTCService();
    const pc = await service.init(localStream);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.send('ice_candidate', { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (!mountedRef.current) {
        return;
      }

      setRemoteStream(event.streams[0]);
      setIsConnected(true);
      setIsSearching(false);
      setStatus('Connected with a stranger');
    };

    pc.onconnectionstatechange = () => {
      if (!mountedRef.current) {
        return;
      }

      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        setIsSearching(false);
        setStatus('Connected with a stranger');
      }

      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setIsConnected(false);
      }
    };

    webrtcRef.current = service;
  };

  const bindSocketHandlers = () => {
    unbindSocketHandlers();

    cleanupHandlersRef.current = [
      socketService.on('stats', (serverStats) => {
        setStats(serverStats);
      }),

      socketService.on('queue_status', ({ position, waiting }) => {
        if (!mountedRef.current || !position) {
          return;
        }

        setStats((current) => ({ ...current, waiting }));
        setStatus(position === 1 ? 'Searching for the next available stranger...' : `Searching. Queue position ${position}.`);
      }),

      socketService.on('matched', async ({ createOffer }) => {
        if (!mountedRef.current || !webrtcRef.current) {
          return;
        }

        setRemoteStream(null);
        setIsConnected(false);
        setIsSearching(false);
        setStatus('Partner found. Securing video link...');
        addSystemMessage('Partner found.');

        if (createOffer) {
          const offer = await webrtcRef.current.createOffer();
          socketService.send('offer', { offer });
        }
      }),

      socketService.on('offer', async ({ offer }) => {
        if (!webrtcRef.current) {
          return;
        }

        const answer = await webrtcRef.current.handleOffer(offer);
        socketService.send('answer', { answer });
      }),

      socketService.on('answer', async ({ answer }) => {
        await webrtcRef.current?.handleAnswer(answer);
      }),

      socketService.on('ice_candidate', async ({ candidate }) => {
        try {
          await webrtcRef.current?.addIceCandidate(candidate);
        } catch (error) {
          console.warn('Could not add ICE candidate', error);
        }
      }),

      socketService.on('chat_message', ({ message }) => {
        setMessages((current) => [...current, createMessage('stranger', message)]);
      }),

      socketService.on('partner_disconnected', async ({ reason } = {}) => {
        if (!mountedRef.current) {
          return;
        }

        setRemoteStream(null);
        setIsConnected(false);
        setIsSearching(true);
        setStatus(reason === 'skipped' ? 'Partner skipped. Finding someone new...' : 'Partner left. Finding someone new...');
        addSystemMessage(reason === 'skipped' ? 'Partner skipped.' : 'Partner left.');
        await resetPeerConnection();
        socketService.send('join_queue');
      }),

      socketService.on('report_received', () => {
        addSystemMessage('Report received. Finding someone new.');
        setIsSearching(true);
        setStatus('Report sent. Finding someone new...');
      }),

      socketService.on('server_error', ({ message }) => {
        addSystemMessage(message || 'Server error.');
      }),

      socketService.on('disconnect', () => {
        if (mountedRef.current) {
          setStatus('Disconnected from server.');
          setIsConnected(false);
          setIsSearching(false);
        }
      })
    ];
  };

  const startConnection = async () => {
    try {
      await socketService.connect();
      bindSocketHandlers();
      await resetPeerConnection();
      setIsSearching(true);
      setStatus('Searching for the next available stranger...');
      socketService.send('join_queue');
    } catch (error) {
      console.error(error);
      setIsSearching(false);
      setStatus('Server connection failed. Start the backend and refresh.');
    }
  };

  const handleNext = async () => {
    setRemoteStream(null);
    setIsConnected(false);
    setIsSearching(true);
    setStatus('Looking for next partner...');
    addSystemMessage(isConnected ? 'You skipped.' : 'Search restarted.');
    await resetPeerConnection();
    socketService.send(isConnected ? 'next' : 'join_queue');
  };

  const handleDisconnect = () => {
    cleanup();
    onExit();
  };

  const handleToggleMic = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const handleToggleVideo = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleReport = async () => {
    if (!isConnected) {
      return;
    }

    setRemoteStream(null);
    setIsConnected(false);
    setIsSearching(true);
    setStatus('Report sent. Finding someone new...');
    await resetPeerConnection();
    socketService.send('report', { reason: 'inappropriate_behavior' });
  };

  const handleSendMessage = (event) => {
    event.preventDefault();
    const cleanMessage = messageDraft.trim();

    if (!cleanMessage || !isConnected) {
      return;
    }

    setMessages((current) => [...current, createMessage('you', cleanMessage)]);
    socketService.send('chat_message', { message: cleanMessage });
    setMessageDraft('');
  };

  const cleanup = () => {
    socketService.send('leave');
    unbindSocketHandlers();
    webrtcRef.current?.close();
    webrtcRef.current = null;
    socketService.disconnect();
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
          <p className="eyebrow">Incogni.tv</p>
          <h1>Random video chat</h1>
        </div>
        <div className="status-badge">{status}</div>
      </header>

      <main className="chat-shell">
        <section className="video-grid" aria-label="Video chat">
          <VideoBox
            stream={remoteStream}
            isLocal={false}
            label="Stranger"
            placeholder={isSearching ? 'Searching for a real person...' : 'Waiting for partner...'}
          />
          <VideoBox stream={localStream} isLocal label="You" placeholder="Your camera" />
        </section>

        <aside className="text-panel" aria-label="Text chat">
          <div className="text-panel-header">
            <div>
              <h2>Chat</h2>
              <p>{stats.online} online · {stats.waiting} searching · {stats.activeSessions} live rooms</p>
            </div>
            <span>{isConnected ? 'Live' : isSearching ? 'Searching' : 'Idle'}</span>
          </div>

          <div className="chat-log" ref={chatLogRef}>
            {messages.map((message) => (
              <div className={`chat-message ${message.author}`} key={message.id}>
                <span>{message.author === 'you' ? 'You' : message.author === 'stranger' ? 'Stranger' : 'System'}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <form className="message-form" onSubmit={handleSendMessage}>
            <input
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder={isConnected ? 'Type a message' : 'Waiting for a partner'}
              disabled={!isConnected}
              maxLength={500}
            />
            <button type="submit" disabled={!isConnected || !messageDraft.trim()}>
              Send
            </button>
          </form>
        </aside>
      </main>

      <Controls
        onNext={handleNext}
        onDisconnect={handleDisconnect}
        onToggleMic={handleToggleMic}
        onToggleVideo={handleToggleVideo}
        onReport={handleReport}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isConnected={isConnected}
        isSearching={isSearching}
      />
    </div>
  );
};

export default ChatPage;
