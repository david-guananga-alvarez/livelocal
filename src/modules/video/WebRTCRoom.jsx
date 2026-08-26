import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Check, Crosshair, Gamepad2, Mic, PhoneOff, ShieldCheck, SwitchCamera, X } from 'lucide-react';

import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

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

const CAMERA_DIRECTIONS = {
  left: { label: 'Gira a la izquierda', shortLabel: 'Izquierda', axis: 'alpha', Icon: ArrowLeft },
  right: { label: 'Gira a la derecha', shortLabel: 'Derecha', axis: 'alpha', Icon: ArrowRight },
  up: { label: 'Apunta hacia arriba', shortLabel: 'Arriba', axis: 'beta', Icon: ArrowUp },
  down: { label: 'Apunta hacia abajo', shortLabel: 'Abajo', axis: 'beta', Icon: ArrowDown },
};

function normalizeAngle(value) {
  return ((value + 540) % 360) - 180;
}

export default function WebRTCRoom({ roomId, role, isActive = true }) {
  const { user } = useAuth();

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const pcRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);

  const pendingIceRef = useRef([]);
  const offerSentRef = useRef(false);
  const remoteControlEnabledRef = useRef(false);
  const orientationRef = useRef({ alpha: null, beta: null });
  const commandBaselineRef = useRef(null);
  const activeCommandRef = useRef(null);
  const completedCommandRef = useRef('');

  const [started, setStarted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Sala lista');
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const [activeView, setActiveView] = useState('remote');
  const [videoDevices, setVideoDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState('');
  const [facingMode, setFacingMode] = useState('user');
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [starting, setStarting] = useState(false);
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [remoteControlAvailable, setRemoteControlAvailable] = useState(false);
  const [orientationTracking, setOrientationTracking] = useState(false);
  const [orientationDetected, setOrientationDetected] = useState(false);
  const [activeCommand, setActiveCommand] = useState(null);
  const [guidanceProgress, setGuidanceProgress] = useState(0);
  const [controlAngle, setControlAngle] = useState(30);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [clientCommand, setClientCommand] = useState(null);
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const canSwitchCamera = isMobileDevice || videoDevices.length > 1;

  useEffect(() => {
    return () => {
      stopCall();
    };
  }, []);

  useEffect(() => {
    remoteControlEnabledRef.current = remoteControlEnabled;
  }, [remoteControlEnabled]);

  useEffect(() => {
    activeCommandRef.current = activeCommand;
  }, [activeCommand]);

  useEffect(() => {
    if (role !== 'Local' || !orientationTracking) return undefined;

    const handleOrientation = event => {
      const reading = {
        alpha: Number.isFinite(event.alpha) ? event.alpha : null,
        beta: Number.isFinite(event.beta) ? event.beta : null,
      };

      if (reading.alpha === null && reading.beta === null) return;

      orientationRef.current = reading;
      setOrientationDetected(true);

      const command = activeCommandRef.current;
      if (!command || command.completed) return;

      if (!commandBaselineRef.current) {
        commandBaselineRef.current = reading;
        return;
      }

      const start = commandBaselineRef.current[command.axis];
      const current = reading[command.axis];
      if (start === null || current === null) return;

      const delta = command.axis === 'alpha'
        ? Math.abs(normalizeAngle(current - start))
        : Math.abs(current - start);
      const progress = Math.min(delta / command.degrees, 1);

      setGuidanceProgress(progress);

      if (progress >= 0.96 && completedCommandRef.current !== command.id) {
        completedCommandRef.current = command.id;
        const completedCommand = { ...command, completed: true };
        activeCommandRef.current = completedCommand;
        setActiveCommand(completedCommand);

        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'camera-control-complete',
            commandId: command.id,
            fromUserId: user?.id,
            fromRole: role,
          },
        });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [orientationTracking, role, user?.id]);

  async function flushPendingIce(pc) {
    if (!pc.remoteDescription) return;

    for (const candidate of pendingIceRef.current) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn(
          'ICE pendiente no aplicado:',
          error
        );
      }
    }

    pendingIceRef.current = [];
  }

  async function createAndSendOffer(pc) {
    // Evita crear varias ofertas si Presence hace varios sync
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
    if (!data) return;

    // Ignorar nuestros propios mensajes
    if (data.fromUserId === user?.id) return;

    if (data.type === 'camera-control-availability') {
      if (role !== 'Cliente') return;

      const enabled = Boolean(data.enabled);
      setRemoteControlAvailable(enabled);
      setControlPanelOpen(enabled);
      if (!enabled) setClientCommand(null);
      return;
    }

    if (data.type === 'camera-control-command') {
      if (role !== 'Local' || !remoteControlEnabledRef.current) return;

      const direction = CAMERA_DIRECTIONS[data.direction];
      if (!direction) return;

      const command = {
        id: data.commandId,
        direction: data.direction,
        axis: direction.axis,
        degrees: Math.min(Math.max(Number(data.degrees) || 30, 10), 60),
        completed: false,
      };

      commandBaselineRef.current =
        orientationRef.current.alpha !== null || orientationRef.current.beta !== null
          ? { ...orientationRef.current }
          : null;
      completedCommandRef.current = '';
      activeCommandRef.current = command;
      setActiveCommand(command);
      setGuidanceProgress(0);
      setActiveView('local');
      setStatus(direction.label);

      await send({
        type: 'camera-control-accepted',
        commandId: command.id,
      });
      return;
    }

    if (data.type === 'camera-control-accepted') {
      if (role !== 'Cliente') return;
      setClientCommand(command =>
        command?.id === data.commandId ? { ...command, status: 'active' } : command
      );
      return;
    }

    if (data.type === 'camera-control-complete') {
      if (role !== 'Cliente') return;
      setClientCommand(command =>
        command?.id === data.commandId ? { ...command, status: 'completed' } : command
      );
      return;
    }

    if (data.type === 'camera-control-cancel') {
      setClientCommand(null);
      activeCommandRef.current = null;
      commandBaselineRef.current = null;
      setActiveCommand(null);
      setGuidanceProgress(0);
      return;
    }

    // LOCAL recibe oferta
    if (data.type === 'offer') {
      if (role !== 'Local') return;

      setStatus(
        'Oferta recibida. Conectando...'
      );

      await pc.setRemoteDescription(
        data.offer
      );

      await flushPendingIce(pc);

      const answer =
        await pc.createAnswer();

      await pc.setLocalDescription(
        answer
      );

      await send({
        type: 'answer',
        answer: pc.localDescription,
      });

      return;
    }

    // CLIENTE recibe respuesta
    if (data.type === 'answer') {
      if (role !== 'Cliente') return;

      setStatus(
        'Respuesta recibida. Estableciendo conexión...'
      );

      await pc.setRemoteDescription(
        data.answer
      );

      await flushPendingIce(pc);

      return;
    }

    // ICE candidates
    if (data.type === 'ice') {
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(
          data.candidate
        );

        return;
      }

      try {
        await pc.addIceCandidate(
          data.candidate
        );
      } catch (error) {
        console.warn(
          'ICE candidate no aplicado:',
          error
        );
      }
    }
  }

  async function startCall() {
    if (starting || started) return;
    setStarting(true);
    try {
      setError('');
      setStatus(
        'Pidiendo cámara y micrófono...'
      );

      if (!supabase) {
        throw new Error(
          'Supabase no está configurado'
        );
      }

      if (!user?.id) {
        throw new Error(
          'Usuario no autenticado'
        );
      }

      // -------------------------
      // CÁMARA + MICRÓFONO
      // -------------------------

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: {
                ideal: 'user',
              },
            },
            audio: true,
          }
        );

      localStreamRef.current = stream;

      const currentVideoTrack = stream.getVideoTracks()[0];
      setActiveDeviceId(currentVideoTrack?.getSettings().deviceId || '');
      setFacingMode(currentVideoTrack?.getSettings().facingMode || 'user');

      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(device => device.kind === 'videoinput'));

      if (localVideo.current) {
        localVideo.current.srcObject =
          stream;
      }

      // -------------------------
      // WEBRTC
      // -------------------------

      const pc =
        new RTCPeerConnection({
          iceServers,
        });

      pcRef.current = pc;

      // Diagnóstico ICE
      pc.oniceconnectionstatechange =
        () => {
          console.log(
            'ICE state:',
            pc.iceConnectionState
          );
        };

      pc.onicegatheringstatechange =
        () => {
          console.log(
            'ICE gathering:',
            pc.iceGatheringState
          );
        };

      pc.onicecandidateerror =
        event => {
          console.error(
            'ICE candidate error:',
            event
          );
        };

      // Añadir audio/vídeo al PeerConnection
      stream
        .getTracks()
        .forEach(track => {
          pc.addTrack(
            track,
            stream
          );
        });

      // Vídeo remoto
      pc.ontrack = event => {
        if (remoteVideo.current) {
          remoteVideo.current.srcObject =
            event.streams[0];
        }

        const remoteTrack = event.track;
        if (remoteTrack.kind === 'video') {
          setRemoteAvailable(true);
          remoteTrack.onunmute = () => setRemoteAvailable(true);
          remoteTrack.onmute = () => setRemoteAvailable(false);
          remoteTrack.onended = () => setRemoteAvailable(false);
        }

        setStatus(
          'Conectado con la otra persona'
        );
      };

      // Enviar ICE por Supabase
      pc.onicecandidate = event => {
        if (event.candidate) {
          send({
            type: 'ice',
            candidate:
              event.candidate,
          });
        }
      };

      pc.onconnectionstatechange =
        () => {
          console.log(
            'WebRTC connection state:',
            pc.connectionState
          );

          if (
            pc.connectionState ===
            'connected'
          ) {
            setStatus(
              'Videollamada conectada'
            );
          }

          if (
            pc.connectionState ===
            'failed'
          ) {
            setStatus(
              'No se pudo establecer la conexión'
            );
          }

          if (
            pc.connectionState ===
            'disconnected'
          ) {
            setStatus(
              'Conexión interrumpida'
            );
          }
        };

      // -------------------------
      // SUPABASE REALTIME
      // -------------------------

      const channel =
        supabase.channel(
          `webrtc-${roomId}`,
          {
            config: {
              presence: {
                key: user.id,
              },
            },
          }
        );

      channelRef.current =
        channel;

      // -------------------------
      // PRESENCE
      // -------------------------

      channel.on(
        'presence',
        {
          event: 'sync',
        },
        async () => {
          const presenceState =
            channel.presenceState();

          const participants =
            Object.values(
              presenceState
            ).flat();

          console.log(
            'Participantes en sala:',
            participants
          );

          const hasClient =
            participants.some(
              participant =>
                participant.role ===
                'Cliente'
            );

          const hasLocal =
            participants.some(
              participant =>
                participant.role ===
                'Local'
            );

          // Los dos ya están presentes
          if (
            hasClient &&
            hasLocal
          ) {
            // Cliente siempre genera
            // la oferta WebRTC
            if (
              role === 'Cliente'
            ) {
              await createAndSendOffer(
                pc
              );
            } else {
              setStatus(
                'Cliente conectado. Preparando llamada...'
              );

              await send({
                type: 'camera-control-availability',
                enabled: remoteControlEnabledRef.current,
              });
            }

            return;
          }

          // Todavía falta alguien
          if (
            role === 'Cliente'
          ) {
            setStatus(
              'Esperando al local...'
            );
          } else {
            setStatus(
              'Esperando al cliente...'
            );
          }
        }
      );

      // -------------------------
      // SIGNALING WEBRTC
      // -------------------------

      channel.on(
        'broadcast',
        {
          event: 'signal',
        },
        async ({ payload }) => {
          try {
            await handleSignal(
              payload,
              pc
            );
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

      // -------------------------
      // SUSCRIBIR CANAL
      // -------------------------

      await new Promise(
        (resolve, reject) => {
          channel.subscribe(
            (
              realtimeStatus,
              subscribeError
            ) => {
              console.log(
                `Realtime WebRTC ${roomId}:`,
                realtimeStatus
              );

              if (
                realtimeStatus ===
                'SUBSCRIBED'
              ) {
                resolve();
              }

              if (
                realtimeStatus ===
                  'CHANNEL_ERROR' ||
                realtimeStatus ===
                  'TIMED_OUT'
              ) {
                reject(
                  subscribeError ||
                    new Error(
                      `Realtime: ${realtimeStatus}`
                    )
                );
              }
            }
          );
        }
      );

      // -------------------------
      // REGISTRAR PRESENCIA
      // -------------------------

      await channel.track({
        userId: user.id,
        role,
        joinedAt:
          new Date().toISOString(),
      });

      setStarted(true);

      setStatus(
        role === 'Cliente'
          ? 'Esperando al local...'
          : 'Esperando al cliente...'
      );
    } catch (error) {
      console.error(
        'Error iniciando videollamada:',
        error
      );

      setError(
        error?.message ||
          'No se pudo iniciar la videollamada.'
      );

      stopCall();
    } finally {
      setStarting(false);
    }
  }

  // -------------------------
  // SIGNALING SEND
  // -------------------------

  async function send(payload) {
    if (!channelRef.current) {
      return;
    }

    await channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        ...payload,

        // Mejor que comparar únicamente
        // Cliente / Local
        fromUserId: user?.id,

        fromRole: role,
      },
    });
  }

  async function requestOrientationAccess() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      setOrientationTracking(false);
      return false;
    }

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Permite el acceso al movimiento para usar la guía automática');
      }
    }

    setOrientationTracking(true);
    return true;
  }

  async function toggleRemoteControl() {
    if (role !== 'Local') return;

    const nextEnabled = !remoteControlEnabled;
    try {
      setError('');

      if (nextEnabled) {
        await requestOrientationAccess();
      }

      remoteControlEnabledRef.current = nextEnabled;
      setRemoteControlEnabled(nextEnabled);

      if (!nextEnabled) {
        activeCommandRef.current = null;
        commandBaselineRef.current = null;
        setActiveCommand(null);
        setGuidanceProgress(0);
        setOrientationTracking(false);
        setOrientationDetected(false);
        await send({ type: 'camera-control-cancel' });
      }

      await send({
        type: 'camera-control-availability',
        enabled: nextEnabled,
      });

      setStatus(
        nextEnabled
          ? 'Dirección remota habilitada'
          : 'Dirección remota desactivada'
      );
    } catch (controlError) {
      setError(controlError?.message || 'No se pudo activar la dirección remota');
    }
  }

  async function sendCameraDirection(directionKey) {
    if (role !== 'Cliente' || !remoteControlAvailable) return;

    const direction = CAMERA_DIRECTIONS[directionKey];
    if (!direction) return;

    const commandId =
      globalThis.crypto?.randomUUID?.() ||
      `camera-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const command = {
      id: commandId,
      direction: directionKey,
      degrees: controlAngle,
      status: 'sent',
    };

    setClientCommand(command);
    setActiveView('remote');
    setError('');

    try {
      await send({
        type: 'camera-control-command',
        commandId,
        direction: directionKey,
        degrees: controlAngle,
      });
    } catch (controlError) {
      setClientCommand({ ...command, status: 'error' });
      setError(controlError?.message || 'No se pudo enviar la indicación');
    }
  }

  async function cancelCameraDirection() {
    setClientCommand(null);
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setActiveCommand(null);
    setGuidanceProgress(0);
    await send({ type: 'camera-control-cancel' });
  }

  function dismissCameraGuidance() {
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setActiveCommand(null);
    setGuidanceProgress(0);
    send({ type: 'camera-control-cancel' });
  }

  async function switchCamera() {
    if (switchingCamera || !pcRef.current) return;

    const nextFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    const currentTrack = localStreamRef.current?.getVideoTracks()[0];
    const sender = pcRef.current.getSenders().find(item => item.track?.kind === 'video');
    if (!currentTrack || !sender) return;

    const currentSettings = currentTrack.getSettings();
    const previousFacingMode = currentSettings.facingMode || facingMode;
    const previousDeviceId = currentSettings.deviceId || activeDeviceId;
    const audioTracks = localStreamRef.current?.getAudioTracks() || [];
    let replacementTrack;

    const installVideoTrack = async track => {
      await sender.replaceTrack(track);

      const updatedStream = new MediaStream([...audioTracks, track]);
      localStreamRef.current = updatedStream;
      if (localVideo.current) localVideo.current.srcObject = updatedStream;
    };

    const recoverPreviousCamera = async () => {
      let recoveryStream;

      try {
        recoveryStream = await navigator.mediaDevices.getUserMedia({
          video: previousDeviceId
            ? { deviceId: { exact: previousDeviceId } }
            : { facingMode: { exact: previousFacingMode } },
          audio: false,
        });
      } catch {
        recoveryStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: previousFacingMode } },
          audio: false,
        });
      }

      const recoveredTrack = recoveryStream.getVideoTracks()[0];
      if (!recoveredTrack) {
        recoveryStream.getTracks().forEach(track => track.stop());
        throw new Error('No se pudo recuperar la cámara anterior');
      }

      try {
        await installVideoTrack(recoveredTrack);
      } catch (recoveryError) {
        recoveredTrack.stop();
        throw recoveryError;
      }

      const recoveredSettings = recoveredTrack.getSettings();
      setActiveDeviceId(recoveredSettings.deviceId || previousDeviceId || '');
      setFacingMode(recoveredSettings.facingMode || previousFacingMode);
    };

    try {
      setSwitchingCamera(true);
      setError('');

      // Android puede mantener el mismo sensor al aplicar constraints sobre una
      // pista activa. Hay que liberar la cámara antes de solicitar la opuesta.
      currentTrack.stop();

      let replacementStream;
      try {
        replacementStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } },
          audio: false,
        });
      } catch (facingError) {
        const alternativeDevices = videoDevices.filter(
          device => device.deviceId && device.deviceId !== previousDeviceId
        );
        const nextDevice = alternativeDevices[0];
        if (!nextDevice) throw facingError;
        replacementStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextDevice.deviceId } },
          audio: false,
        });
      }

      replacementTrack = replacementStream.getVideoTracks()[0];

      if (!replacementTrack) {
        replacementStream.getTracks().forEach(track => track.stop());
        throw new Error('No se pudo preparar la otra cámara');
      }

      await installVideoTrack(replacementTrack);
      const nextSettings = replacementTrack.getSettings();
      setActiveDeviceId(nextSettings.deviceId || '');
      setFacingMode(nextSettings.facingMode || nextFacingMode);
      setStatus(`Cámara ${nextFacingMode === 'environment' ? 'trasera' : 'frontal'} activa`);
    } catch (cameraError) {
      replacementTrack?.stop();
      console.error('Error cambiando de cámara:', cameraError);

      try {
        await recoverPreviousCamera();
        setError(cameraError?.message || 'No se pudo cambiar de cámara');
        setStatus('Se mantuvo la cámara anterior');
      } catch (recoveryError) {
        console.error('Error recuperando la cámara anterior:', recoveryError);
        setError('No se pudo cambiar ni recuperar la cámara anterior');
      }
    } finally {
      setSwitchingCamera(false);
    }
  }

  // -------------------------
  // COLGAR
  // -------------------------

  function stopCall() {
    const pc = pcRef.current;

    if (pc) {
      pc.close();
    }

    if (
      channelRef.current &&
      supabase
    ) {
      supabase.removeChannel(
        channelRef.current
      );
    }

    const videos = [
      localVideo.current,
      remoteVideo.current,
    ];

    videos.forEach(video => {
      if (video?.srcObject) {
        video.srcObject
          .getTracks()
          .forEach(track =>
            track.stop()
          );

        video.srcObject = null;
      }
    });

    pcRef.current = null;
    channelRef.current = null;

    pendingIceRef.current = [];
    offerSentRef.current = false;
    localStreamRef.current = null;

    setStarted(false);
    setRemoteAvailable(false);
    setVideoDevices([]);
    setActiveDeviceId('');
    setFacingMode('user');
    setStarting(false);
    remoteControlEnabledRef.current = false;
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setRemoteControlEnabled(false);
    setRemoteControlAvailable(false);
    setOrientationTracking(false);
    setOrientationDetected(false);
    setActiveCommand(null);
    setGuidanceProgress(0);
    setControlPanelOpen(false);
    setClientCommand(null);
    setStatus('Sala detenida');
  }

  // -------------------------
  // UI
  // -------------------------

  const activeDirection = activeCommand
    ? CAMERA_DIRECTIONS[activeCommand.direction]
    : null;
  const clientDirection = clientCommand
    ? CAMERA_DIRECTIONS[clientCommand.direction]
    : null;

  return (
    <section className={`videoRoom ${isActive ? 'isActive' : 'isBackground'} ${started ? 'hasStarted' : 'isLobby'}`} aria-label="Cámara de la sesión">
      <div className="videoStage">
        <div className={`videoGrid focus-${activeView}`} aria-hidden={!started}>
        <div className="videoTile localVideo">
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            aria-label={`Tu cámara como ${role}`}
          />

          <span>
            Tú ({role})
          </span>
          {started && activeView !== 'local' && <button type="button" className="videoFocusButton" onClick={() => setActiveView('local')}>Ver en grande</button>}
        </div>

        <div className="videoTile remoteVideo">
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            aria-label={`Cámara del ${role === 'Local' ? 'Cliente' : 'Local'}`}
          />

          <span>
            {role === 'Local' ? 'Cliente' : 'Local'}
          </span>
          {started && !remoteAvailable && <div className="remoteWaiting"><Camera size={22} /><b>Esperando la cámara del {role === 'Local' ? 'Cliente' : 'Local'}</b><small>La otra persona debe entrar en la sala y permitir su cámara.</small></div>}
          {started && activeView !== 'remote' && <button type="button" className="videoFocusButton" onClick={() => setActiveView('remote')}>Ver en grande</button>}
          {role === 'Local' && activeCommand && activeDirection && (
            <div className={`cameraGuidanceOverlay ${activeCommand.completed ? 'isComplete' : ''}`} role="status" aria-live="assertive">
              <div
                className="cameraGuidanceDial"
                style={{ '--guidance-progress': `${Math.round(guidanceProgress * 360)}deg` }}
                aria-hidden="true"
              >
                {activeCommand.completed
                  ? <Check size={42} />
                  : <activeDirection.Icon size={48} strokeWidth={2.4} />}
              </div>
              <div className="cameraGuidanceCopy">
                <span>{activeCommand.completed ? 'Encuadre alcanzado' : 'Indicación del Cliente'}</span>
                <strong>{activeCommand.completed ? 'Mantén esta posición' : activeDirection.label}</strong>
                <small>
                  {activeCommand.completed
                    ? 'El Cliente ya ha recibido la confirmación.'
                    : orientationDetected
                      ? `${Math.round(guidanceProgress * 100)}% de ${activeCommand.degrees}°`
                      : `Sigue la flecha unos ${activeCommand.degrees}°`}
                </small>
              </div>
              <button type="button" onClick={dismissCameraGuidance} aria-label="Cerrar indicación">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        </div>

        {started && role === 'Cliente' && remoteControlAvailable && controlPanelOpen && (
          <section className="cameraDirectionPanel" aria-label="Dirección remota de la cámara">
            <header>
              <div>
                <span>Dirección asistida</span>
                <strong>Guía al Local</strong>
              </div>
              <button type="button" onClick={() => setControlPanelOpen(false)} aria-label="Cerrar controles">
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            <div className="cameraAngleSelector" role="group" aria-label="Amplitud del movimiento">
              {[15, 30, 45].map(angle => (
                <button
                  key={angle}
                  type="button"
                  className={controlAngle === angle ? 'active' : ''}
                  aria-pressed={controlAngle === angle}
                  onClick={() => setControlAngle(angle)}
                >
                  {angle}°
                </button>
              ))}
            </div>

            <div className="cameraDirectionPad" role="group" aria-label="Dirección de la cámara">
              <button type="button" className="directionUp" onClick={() => sendCameraDirection('up')} aria-label="Pedir que apunte hacia arriba">
                <ArrowUp size={22} aria-hidden="true" />
              </button>
              <button type="button" className="directionLeft" onClick={() => sendCameraDirection('left')} aria-label="Pedir que gire a la izquierda">
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <button type="button" className="directionStop" onClick={cancelCameraDirection} aria-label="Detener indicación">
                <Crosshair size={18} aria-hidden="true" />
              </button>
              <button type="button" className="directionRight" onClick={() => sendCameraDirection('right')} aria-label="Pedir que gire a la derecha">
                <ArrowRight size={22} aria-hidden="true" />
              </button>
              <button type="button" className="directionDown" onClick={() => sendCameraDirection('down')} aria-label="Pedir que apunte hacia abajo">
                <ArrowDown size={22} aria-hidden="true" />
              </button>
            </div>

            <p className={`cameraCommandStatus ${clientCommand?.status || ''}`} aria-live="polite">
              {!clientCommand && 'El Local verá una guía visual en su pantalla.'}
              {clientCommand?.status === 'sent' && `Enviando: ${clientDirection?.shortLabel}…`}
              {clientCommand?.status === 'active' && `El Local está siguiendo: ${clientDirection?.shortLabel}`}
              {clientCommand?.status === 'completed' && 'Encuadre confirmado por el Local'}
              {clientCommand?.status === 'error' && 'No se pudo enviar la indicación'}
            </p>
          </section>
        )}

        {!started && (
          <div className="videoLobby">
            <span className="videoLobbyIcon" aria-hidden="true"><Camera size={26} /></span>
            <p className="stepLabel">Cámara en directo</p>
            <h3>Entra cuando estés listo</h3>
            <p>Podrás ver a la otra persona y cambiar de vista sin salir de la sesión.</p>
            <button type="button" className="primary videoJoinButton" onClick={startCall} disabled={starting} aria-busy={starting || undefined}>
              <Camera size={18} />
              {starting ? 'Conectando…' : 'Entrar a la cámara'}
            </button>
          </div>
        )}

        {started && (
          <>
            <div className="videoStatusPill" role="status">
              <Mic size={14} aria-hidden="true" />
              <span>{status}</span>
            </div>

            <div className="videoViewSwitch" role="group" aria-label="Vídeo principal">
              <button type="button" className={activeView === 'remote' ? 'active' : ''} aria-pressed={activeView === 'remote'} onClick={() => setActiveView('remote')}>
                {role === 'Local' ? 'Cliente' : 'Local'}
              </button>
              <button type="button" className={activeView === 'local' ? 'active' : ''} aria-pressed={activeView === 'local'} onClick={() => setActiveView('local')}>
                Tú
              </button>
            </div>

            <div className="callActions" role="group" aria-label="Controles de cámara">
              {role === 'Local' && (
                <button
                  type="button"
                  className={`videoControlButton ${remoteControlEnabled ? 'isEnabled' : ''}`}
                  onClick={toggleRemoteControl}
                  aria-pressed={remoteControlEnabled}
                  aria-label={remoteControlEnabled ? 'Desactivar dirección remota' : 'Permitir dirección remota'}
                >
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>{remoteControlEnabled ? 'Dirección activa' : 'Permitir dirección'}</span>
                </button>
              )}
              {role === 'Cliente' && remoteControlAvailable && (
                <button
                  type="button"
                  className={`videoControlButton ${controlPanelOpen ? 'isEnabled' : ''}`}
                  onClick={() => setControlPanelOpen(open => !open)}
                  aria-pressed={controlPanelOpen}
                  aria-label="Abrir dirección remota"
                >
                  <Gamepad2 size={19} aria-hidden="true" />
                  <span>Dirigir cámara</span>
                </button>
              )}
              {canSwitchCamera && (
                <button type="button" className="videoControlButton" onClick={switchCamera} disabled={switchingCamera} aria-label={facingMode === 'environment' ? 'Usar cámara frontal' : 'Usar cámara trasera'}>
                  <SwitchCamera size={19} aria-hidden="true" />
                  <span>{switchingCamera ? 'Cambiando…' : 'Cambiar cámara'}</span>
                </button>
              )}
              <button type="button" className="videoControlButton isDanger" onClick={stopCall}>
                <PhoneOff size={19} aria-hidden="true" />
                <span>Colgar</span>
              </button>
            </div>
          </>
        )}

        {error && <p className="videoError" role="alert">{error}</p>}
      </div>
    </section>
  );
}
