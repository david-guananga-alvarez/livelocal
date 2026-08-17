import React, { useEffect, useRef, useState } from 'react';
import { Camera, Mic, PhoneOff } from 'lucide-react';
import { supabase } from '../auth/supabaseClient';

const iceServers = [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:standard.relay.metered.ca:80",
        username: "59135b3209858ee9ff881003",
        credential: "zoO5z6FSSNc+Dz/S",
      },
      {
        urls: "turn:standard.relay.metered.ca:80?transport=tcp",
        username: "59135b3209858ee9ff881003",
        credential: "zoO5z6FSSNc+Dz/S",
      },
      {
        urls: "turn:standard.relay.metered.ca:443",
        username: "59135b3209858ee9ff881003",
        credential: "zoO5z6FSSNc+Dz/S",
      },
      {
        urls: "turns:standard.relay.metered.ca:443?transport=tcp",
        username: "59135b3209858ee9ff881003",
        credential: "zoO5z6FSSNc+Dz/S",
      },
  ];
export default function WebRTCRoom({ roomId, role }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const pcRef = useRef(null);
  const channelRef = useRef(null);

  const pendingIceRef = useRef([]);
  const offerSentRef = useRef(false);

  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Sala lista');

  useEffect(() => {
    return () => {
      stopCall();
    };
  }, []);

  async function flushPendingIce(pc) {
    if (!pc.remoteDescription) return;

    for (const candidate of pendingIceRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn('ICE pendiente no aplicado:', error);
      }
    }

    pendingIceRef.current = [];
  }

  async function createAndSendOffer(pc) {
    if (offerSentRef.current) return;

    offerSentRef.current = true;

    setStatus('Conectando con el local...');

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    await send({
      type: 'offer',
      offer: pc.localDescription,
    });
  }

  async function handleSignal(data, pc) {
    if (!data || data.from === role) return;

    if (data.type === 'ready') {
      if (role === 'Cliente') {
        await createAndSendOffer(pc);
      }

      return;
    }

    if (data.type === 'offer') {
      if (role !== 'Local') return;

      setStatus('Oferta recibida. Conectando...');

      await pc.setRemoteDescription(data.offer);

      await flushPendingIce(pc);

      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);

      await send({
        type: 'answer',
        answer: pc.localDescription,
      });

      return;
    }

    if (data.type === 'answer') {
      if (role !== 'Cliente') return;

      setStatus('Respuesta recibida. Estableciendo conexión...');

      await pc.setRemoteDescription(data.answer);

      await flushPendingIce(pc);

      return;
    }

    if (data.type === 'ice') {
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(data.candidate);
        return;
      }

      try {
        await pc.addIceCandidate(data.candidate);
      } catch (error) {
        console.warn('ICE candidate no aplicado:', error);
      }
    }
  }

  async function startCall() {
    try {
      setError('');
      setStatus('Pidiendo cámara y micrófono...');

      if (!supabase) {
        throw new Error('Supabase no está configurado');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers,
      });

      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
  console.log('ICE state:', pc.iceConnectionState);
};

pc.onicegatheringstatechange = () => {
  console.log('ICE gathering:', pc.iceGatheringState);
};

pc.onicecandidateerror = event => {
  console.error('ICE candidate error:', event);
};

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = event => {
        if (remoteVideo.current) {
          remoteVideo.current.srcObject = event.streams[0];
        }

        setStatus('Conectado con la otra persona');
      };

      pc.onicecandidate = event => {
        if (event.candidate) {
          send({
            type: 'ice',
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(
          'WebRTC connection state:',
          pc.connectionState
        );

        if (pc.connectionState === 'connected') {
          setStatus('Videollamada conectada');
        }

        if (pc.connectionState === 'failed') {
          setStatus('No se pudo establecer la conexión');
        }

        if (pc.connectionState === 'disconnected') {
          setStatus('Conexión interrumpida');
        }
      };

      const channel = supabase
        .channel(`webrtc-${roomId}`)
        .on(
          'broadcast',
          {
            event: 'signal',
          },
          async ({ payload }) => {
            try {
              await handleSignal(payload, pc);
            } catch (error) {
              console.error(
                'Error procesando señal WebRTC:',
                error
              );

              setError(
                'Error estableciendo la videollamada.'
              );
            }
          }
        );

      channelRef.current = channel;

      await new Promise((resolve, reject) => {
        channel.subscribe((status, subscribeError) => {
          console.log(
            `Realtime WebRTC ${roomId}:`,
            status
          );

          if (status === 'SUBSCRIBED') {
            resolve();
          }

          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            reject(
              subscribeError ||
                new Error(`Realtime: ${status}`)
            );
          }
        });
      });

      setStarted(true);

      if (role === 'Local') {
        setStatus(
          'Sala preparada. Avisando al cliente...'
        );

        await send({
          type: 'ready',
        });
      } else {
        setStatus(
          'Esperando que el local entre en la sala...'
        );
      }
    } catch (error) {
      console.error('Error iniciando videollamada:', error);

      setError(
        error?.message ||
          'No se pudo iniciar la videollamada.'
      );

      stopCall();
    }
  }

  async function send(payload) {
    if (!channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        ...payload,
        from: role,
      },
    });
  }

  function stopCall() {
    const pc = pcRef.current;

    if (pc) {
      pc.close();
    }

    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
    }

    const videos = [
      localVideo.current,
      remoteVideo.current,
    ];

    videos.forEach(video => {
      if (video?.srcObject) {
        video.srcObject
          .getTracks()
          .forEach(track => track.stop());

        video.srcObject = null;
      }
    });

    pcRef.current = null;
    channelRef.current = null;

    pendingIceRef.current = [];
    offerSentRef.current = false;

    setStarted(false);
    setStatus('Sala detenida');
  }

  return (
    <section className="card videoRoom">
      <div className="sectionHeader">
        <div>
          <h3>Videollamada LiveLocal</h3>

          <p className="muted">
            WebRTC integrado con señalización mediante
            Supabase Realtime.
          </p>
        </div>

        {started ? (
          <button
            className="danger"
            onClick={stopCall}
          >
            <PhoneOff size={16} />
            Colgar
          </button>
        ) : (
          <button onClick={startCall}>
            <Camera size={16} />
            Entrar a la sala
          </button>
        )}
      </div>

      <div className="videoGrid">
        <div>
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
          />

          <span>Tú ({role})</span>
        </div>

        <div>
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
          />

          <span>Otra persona</span>
        </div>
      </div>

      <p className="statusLine">
        <Mic size={14} />
        {status}
      </p>

      {error && (
        <p className="error">{error}</p>
      )}

      <p className="hint">
        Sala identificada por la petición {roomId}.
      </p>
    </section>
  );
}