const getIceServers = () => {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL
    });
  }

  return {
    iceServers: servers,
    iceCandidatePoolSize: 10
  };
};

export class WebRTCService {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.pendingCandidates = [];
  }

  async init(localStream) {
    this.close();
    this.localStream = localStream;
    this.pendingCandidates = [];
    this.pc = new RTCPeerConnection(getIceServers());

    localStream.getTracks().forEach((track) => {
      this.pc.addTrack(track, localStream);
    });

    return this.pc;
  }

  async createOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });

    await this.pc.setLocalDescription(offer);
    return this.pc.localDescription;
  }

  async handleOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.flushCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return this.pc.localDescription;
  }

  async handleAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.flushCandidates();
  }

  async addIceCandidate(candidate) {
    if (!candidate || !this.pc) {
      return;
    }

    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }

    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async flushCandidates() {
    if (!this.pc?.remoteDescription || this.pendingCandidates.length === 0) {
      return;
    }

    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];

    for (const candidate of candidates) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  close() {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    this.pendingCandidates = [];
  }
}

export default WebRTCService;
