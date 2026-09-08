import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Crosshair, Gamepad2, Mic, PhoneOff, ShieldCheck, SwitchCamera, X } from 'lucide-react';

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
  left: { yaw: -1, pitch: 0 },
  right: { yaw: 1, pitch: 0 },
  up: { yaw: 0, pitch: 1 },
  down: { yaw: 0, pitch: -1 },
};

const JOYSTICK_DEAD_ZONE = 0.12;
const JOYSTICK_SEND_INTERVAL = 80;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeAngle(value) {
  return ((value + 540) % 360) - 180;
}

function describeCameraVector(yawDegrees, pitchDegrees) {
  const parts = [];
  const yaw = Number(yawDegrees) || 0;
  const pitch = Number(pitchDegrees) || 0;

  if (Math.abs(yaw) >= 1) {
    parts.push(yaw > 0 ? 'derecha' : 'izquierda');
  }
  if (Math.abs(pitch) >= 1) {
    parts.push(pitch > 0 ? 'arriba' : 'abajo');
  }
  return parts.length ? parts.join(' · ') : 'centro';
}

function describeMovementVector(x, y) {
  const parts = [];
  const magnitude = Math.hypot(x, y);
  const amount = magnitude > 0.72 ? 'varios pasos' : 'un paso';

  if (Math.abs(y) >= 0.3) parts.push(y < 0 ? `avanza ${amount}` : `retrocede ${amount}`);
  if (Math.abs(x) >= 0.3) parts.push(`${amount} a la ${x > 0 ? 'derecha' : 'izquierda'}`);

  return parts.length ? parts.join(' · ') : 'quieto';
}

function joystickToCameraVector(position, maxDegrees) {
  const magnitude = Math.hypot(position.x, position.y);
  if (magnitude <= JOYSTICK_DEAD_ZONE) {
    return { vectorX: 0, vectorY: 0, yawDegrees: 0, pitchDegrees: 0, targetDegrees: 0 };
  }

  const outputMagnitude = clamp(
    (magnitude - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE),
    0,
    1
  );
  const scale = outputMagnitude / magnitude;
  const vectorX = position.x * scale;
  const vectorY = position.y * scale;
  const yawDegrees = vectorX * maxDegrees;
  const pitchDegrees = -vectorY * maxDegrees;

  return {
    vectorX,
    vectorY,
    yawDegrees,
    pitchDegrees,
    targetDegrees: Math.hypot(yawDegrees, pitchDegrees),
  };
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
  const joystickRef = useRef(null);
  const joystickPointerRef = useRef(null);
  const joystickGestureRef = useRef(null);
  const joystickSequenceRef = useRef(0);
  const joystickLastSentAtRef = useRef(0);
  const movementJoystickRef = useRef(null);
  const movementPointerRef = useRef(null);
  const movementGestureRef = useRef(null);
  const movementSequenceRef = useRef(0);
  const movementLastSentAtRef = useRef(0);

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
  const [activeMovement, setActiveMovement] = useState(null);
  const [guidanceProgress, setGuidanceProgress] = useState(0);
  const controlAngle = 30;
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [clientCommand, setClientCommand] = useState(null);
  const [clientMovement, setClientMovement] = useState(null);
  const [controlRequest, setControlRequest] = useState(null);
  const [controlRequestStatus, setControlRequestStatus] = useState('idle');
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0, active: false });
  const [movementPosition, setMovementPosition] = useState({ x: 0, y: 0, active: false });
  const [guidanceVector, setGuidanceVector] = useState({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
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

      const baseline = commandBaselineRef.current;
      if (baseline.alpha === null || baseline.beta === null || reading.alpha === null || reading.beta === null) return;

      // La punta elegida por el Cliente se traduce a dos objetivos simultáneos:
      // alpha controla el giro horizontal y beta la inclinación vertical.
      // El estándar expresa alpha en sentido opuesto al rumbo: se invierte para
      // que la derecha del stick coincida con la derecha percibida por el usuario.
      const currentYaw = -normalizeAngle(reading.alpha - baseline.alpha);
      const currentPitch = reading.beta - baseline.beta;
      const remainingYaw = command.yawDegrees - currentYaw;
      const remainingPitch = command.pitchDegrees - currentPitch;
      const remainingDistance = Math.hypot(remainingYaw, remainingPitch);
      const targetDistance = Math.max(command.targetDegrees, 1);
      const progress = clamp(1 - remainingDistance / targetDistance, 0, 1);
      const completionTolerance = clamp(targetDistance * 0.12, 2.5, 5);

      setGuidanceProgress(progress);
      setGuidanceVector({
        yaw: currentYaw,
        pitch: currentPitch,
        remainingYaw,
        remainingPitch,
      });

      const completionKey = `${command.id}:${command.sequence}`;
      if (command.final && remainingDistance <= completionTolerance && completedCommandRef.current !== completionKey) {
        completedCommandRef.current = completionKey;
        const completedCommand = { ...command, completed: true };
        activeCommandRef.current = completedCommand;
        setActiveCommand(completedCommand);

        channelRef.current?.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            type: 'camera-control-complete',
            commandId: command.id,
            sequence: command.sequence,
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
      setControlRequestStatus(enabled ? 'accepted' : 'idle');
      if (!enabled) {
        setClientCommand(null);
        setClientMovement(null);
      }
      return;
    }

    if (data.type === 'camera-control-revoked') {
      if (role !== 'Cliente') return;

      setRemoteControlAvailable(false);
      setControlPanelOpen(false);
      setControlRequestStatus('idle');
      setClientCommand(null);
      setClientMovement(null);
      setJoystickPosition({ x: 0, y: 0, active: false });
      setMovementPosition({ x: 0, y: 0, active: false });
      joystickPointerRef.current = null;
      joystickGestureRef.current = null;
      movementPointerRef.current = null;
      movementGestureRef.current = null;
      setStatus('El Local ha revocado la dirección remota');
      return;
    }

    if (data.type === 'camera-control-request') {
      if (role !== 'Local') return;

      if (remoteControlEnabledRef.current) {
        await send({
          type: 'camera-control-response',
          requestId: data.requestId,
          accepted: true,
        });
        return;
      }

      setControlRequest({ id: data.requestId });
      setStatus('El Cliente solicita dirigir la cámara');
      return;
    }

    if (data.type === 'camera-control-response') {
      if (role !== 'Cliente') return;

      const accepted = Boolean(data.accepted);
      setRemoteControlAvailable(accepted);
      setControlPanelOpen(accepted);
      setControlRequestStatus(accepted ? 'accepted' : 'rejected');
      setStatus(
        accepted
          ? 'El Local ha aceptado la dirección remota'
          : 'El Local ha rechazado la solicitud'
      );
      return;
    }

    if (data.type === 'camera-movement-command') {
      if (role !== 'Local' || !remoteControlEnabledRef.current) return;

      const movementX = clamp(Number(data.movementX) || 0, -1, 1);
      const movementY = clamp(Number(data.movementY) || 0, -1, 1);
      if (Math.hypot(movementX, movementY) < JOYSTICK_DEAD_ZONE) return;

      const movement = {
        id: data.commandId,
        sequence: Math.max(Number(data.sequence) || 0, 0),
        x: movementX,
        y: movementY,
        final: data.final !== false,
      };
      setActiveMovement(movement);
      setActiveView('local');
      setStatus(`Movimiento: ${describeMovementVector(movementX, movementY)}`);

      await send({
        type: 'camera-movement-accepted',
        commandId: movement.id,
        sequence: movement.sequence,
      });
      return;
    }

    if (data.type === 'camera-movement-accepted') {
      if (role !== 'Cliente') return;
      setClientMovement(movement =>
        movement?.id === data.commandId && (data.sequence === undefined || movement.sequence === data.sequence)
          ? { ...movement, status: movement.final ? 'active' : 'preview' }
          : movement
      );
      return;
    }

    if (data.type === 'camera-control-command') {
      if (role !== 'Local' || !remoteControlEnabledRef.current) return;

      const legacyDirection = CAMERA_DIRECTIONS[data.direction];
      const legacyDegrees = clamp(Number(data.degrees) || 30, 5, 60);
      const yawDegrees = Number.isFinite(Number(data.yawDegrees))
        ? clamp(Number(data.yawDegrees), -60, 60)
        : (legacyDirection?.yaw || 0) * legacyDegrees;
      const pitchDegrees = Number.isFinite(Number(data.pitchDegrees))
        ? clamp(Number(data.pitchDegrees), -60, 60)
        : (legacyDirection?.pitch || 0) * legacyDegrees;
      const targetDegrees = Math.hypot(yawDegrees, pitchDegrees);
      if (targetDegrees < 1) return;

      const previousCommand = activeCommandRef.current;
      const isNewGesture = previousCommand?.id !== data.commandId;
      const sequence = Math.max(Number(data.sequence) || 0, 0);
      if (!isNewGesture && sequence < (previousCommand.sequence || 0)) return;

      const command = {
        id: data.commandId,
        sequence,
        yawDegrees,
        pitchDegrees,
        targetDegrees,
        maxDegrees: clamp(Number(data.maxDegrees) || Math.max(targetDegrees, legacyDegrees), 5, 60),
        final: data.final !== false,
        completed: false,
      };

      if (isNewGesture) {
        commandBaselineRef.current =
          orientationRef.current.alpha !== null || orientationRef.current.beta !== null
            ? { ...orientationRef.current }
            : null;
      }
      completedCommandRef.current = '';
      activeCommandRef.current = command;
      setActiveCommand(command);
      if (isNewGesture) {
        setGuidanceProgress(0);
        setGuidanceVector({
          yaw: 0,
          pitch: 0,
          remainingYaw: yawDegrees,
          remainingPitch: pitchDegrees,
        });
      }
      setActiveView('local');
      setStatus(`Objetivo: ${describeCameraVector(yawDegrees, pitchDegrees)}`);

      await send({
        type: 'camera-control-accepted',
        commandId: command.id,
        sequence: command.sequence,
      });
      return;
    }

    if (data.type === 'camera-control-accepted') {
      if (role !== 'Cliente') return;
      setClientCommand(command =>
        command?.id === data.commandId && (data.sequence === undefined || command.sequence === data.sequence)
          ? { ...command, status: command.final ? 'active' : 'preview' }
          : command
      );
      return;
    }

    if (data.type === 'camera-control-complete') {
      if (role !== 'Cliente') return;
      setClientCommand(command =>
        command?.id === data.commandId && (data.sequence === undefined || command.sequence === data.sequence)
          ? { ...command, status: 'completed' }
          : command
      );
      return;
    }

    if (data.type === 'camera-control-cancel') {
      setClientCommand(null);
      setClientMovement(null);
      setJoystickPosition({ x: 0, y: 0, active: false });
      setMovementPosition({ x: 0, y: 0, active: false });
      joystickPointerRef.current = null;
      joystickGestureRef.current = null;
      movementPointerRef.current = null;
      movementGestureRef.current = null;
      activeCommandRef.current = null;
      commandBaselineRef.current = null;
      setActiveCommand(null);
      setActiveMovement(null);
      setGuidanceProgress(0);
      setGuidanceVector({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
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

  async function requestRemoteControl() {
    if (role !== 'Cliente' || controlRequestStatus === 'pending') return;

    const requestId =
      globalThis.crypto?.randomUUID?.() ||
      `control-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      setError('');
      setControlRequestStatus('pending');
      setStatus('Solicitando permiso al Local...');

      await send({
        type: 'camera-control-request',
        requestId,
      });
    } catch (controlError) {
      setControlRequestStatus('idle');
      setError(controlError?.message || 'No se pudo enviar la solicitud');
    }
  }

  async function respondToControlRequest(accepted) {
    if (role !== 'Local' || !controlRequest) return;

    const requestId = controlRequest.id;
    try {
      setError('');

      if (accepted) {
        await requestOrientationAccess();
        remoteControlEnabledRef.current = true;
        setRemoteControlEnabled(true);
      }

      setControlRequest(null);
      await send({
        type: 'camera-control-response',
        requestId,
        accepted,
      });

      setStatus(
        accepted
          ? 'Has aceptado la dirección remota'
          : 'Has rechazado la solicitud'
      );
    } catch (controlError) {
      setControlRequest(null);
      await send({
        type: 'camera-control-response',
        requestId,
        accepted: false,
      });
      setError(controlError?.message || 'No se pudo responder a la solicitud');
    }
  }

  async function revokeRemoteControl() {
    if (role !== 'Local' || !remoteControlEnabled) return;

    remoteControlEnabledRef.current = false;
    setRemoteControlEnabled(false);
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setActiveCommand(null);
    setActiveMovement(null);
    setGuidanceProgress(0);
    setGuidanceVector({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
    setOrientationTracking(false);
    setOrientationDetected(false);

    await send({ type: 'camera-control-cancel' });
    await send({
      type: 'camera-control-revoked',
    });

    setStatus('Dirección remota revocada');
  }

  function readControlPosition(control, event) {
    const rect = control.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const radius = Math.max(Math.min(rect.width, rect.height) / 2 - 25, 1);
    let x = (event.clientX - (rect.left + rect.width / 2)) / radius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const magnitude = Math.hypot(x, y);

    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }

    return { x, y };
  }

  function createJoystickGesture() {
    joystickGestureRef.current =
      globalThis.crypto?.randomUUID?.() ||
      `camera-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    joystickSequenceRef.current = 0;
    joystickLastSentAtRef.current = 0;
  }

  async function publishJoystickPosition(position, final = false) {
    if (role !== 'Cliente' || !remoteControlAvailable) return;

    const movement = joystickToCameraVector(position, controlAngle);
    if (movement.targetDegrees < 1) {
      if (final) await cancelCameraDirection();
      return;
    }

    const now = performance.now();
    if (!final && now - joystickLastSentAtRef.current < JOYSTICK_SEND_INTERVAL) return;
    joystickLastSentAtRef.current = now;

    if (!joystickGestureRef.current) createJoystickGesture();

    // La zona muerta y la escala radial reproducen el tacto de un stick analógico.
    const { vectorX, vectorY, yawDegrees, pitchDegrees } = movement;
    const sequence = joystickSequenceRef.current + 1;
    joystickSequenceRef.current = sequence;

    const command = {
      id: joystickGestureRef.current,
      sequence,
      vectorX,
      vectorY,
      yawDegrees,
      pitchDegrees,
      final,
      status: final ? 'sent' : 'preview',
    };

    setClientCommand(command);
    setActiveView('remote');
    setError('');

    try {
      await send({
        type: 'camera-control-command',
        commandId: command.id,
        sequence,
        vectorX,
        vectorY,
        yawDegrees,
        pitchDegrees,
        maxDegrees: controlAngle,
        final,
      });
    } catch (controlError) {
      setClientCommand(current =>
        current?.id === command.id && current.sequence === sequence
          ? { ...current, status: 'error' }
          : current
      );
      setError(controlError?.message || 'No se pudo enviar la indicación');
    }
  }

  function handleJoystickPointerDown(event) {
    if (joystickPointerRef.current !== null) return;

    event.preventDefault();
    joystickPointerRef.current = event.pointerId;
    joystickRef.current?.setPointerCapture?.(event.pointerId);
    createJoystickGesture();

    const position = readControlPosition(joystickRef, event);
    setJoystickPosition({ ...position, active: true });
    publishJoystickPosition(position);
  }

  function handleJoystickPointerMove(event) {
    if (joystickPointerRef.current !== event.pointerId) return;

    event.preventDefault();
    const position = readControlPosition(joystickRef, event);
    setJoystickPosition({ ...position, active: true });
    publishJoystickPosition(position);
  }

  function handleJoystickPointerUp(event) {
    if (joystickPointerRef.current !== event.pointerId) return;

    event.preventDefault();
    const position = readControlPosition(joystickRef, event);
    joystickRef.current?.releasePointerCapture?.(event.pointerId);
    joystickPointerRef.current = null;
    setJoystickPosition({ x: 0, y: 0, active: false });
    publishJoystickPosition(position, true);
    joystickGestureRef.current = null;
  }

  function handleJoystickPointerCancel(event) {
    if (joystickPointerRef.current !== event.pointerId) return;

    joystickPointerRef.current = null;
    joystickGestureRef.current = null;
    setJoystickPosition({ x: 0, y: 0, active: false });
    cancelCameraDirection();
  }

  function handleJoystickKeyDown(event) {
    const keyboardVectors = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const position = keyboardVectors[event.key];
    if (!position) return;

    event.preventDefault();
    createJoystickGesture();
    setJoystickPosition({ ...position, active: true });
    publishJoystickPosition(position, true);
    joystickGestureRef.current = null;
    window.setTimeout(() => setJoystickPosition({ x: 0, y: 0, active: false }), 140);
  }

  function createMovementGesture() {
    movementGestureRef.current =
      globalThis.crypto?.randomUUID?.() ||
      `movement-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    movementSequenceRef.current = 0;
    movementLastSentAtRef.current = 0;
  }

  async function publishMovementPosition(position, final = false) {
    if (role !== 'Cliente' || !remoteControlAvailable) return;

    const magnitude = Math.hypot(position.x, position.y);
    if (magnitude <= JOYSTICK_DEAD_ZONE) return;

    const outputMagnitude = clamp((magnitude - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE), 0, 1);
    const scale = outputMagnitude / magnitude;
    const movementX = position.x * scale;
    const movementY = position.y * scale;
    const now = performance.now();
    if (!final && now - movementLastSentAtRef.current < JOYSTICK_SEND_INTERVAL) return;
    movementLastSentAtRef.current = now;

    if (!movementGestureRef.current) createMovementGesture();
    const sequence = movementSequenceRef.current + 1;
    movementSequenceRef.current = sequence;
    const movement = {
      id: movementGestureRef.current,
      sequence,
      x: movementX,
      y: movementY,
      final,
      status: final ? 'sent' : 'preview',
    };
    setClientMovement(movement);
    setError('');

    try {
      await send({
        type: 'camera-movement-command',
        commandId: movement.id,
        sequence,
        movementX,
        movementY,
        final,
      });
    } catch (controlError) {
      setClientMovement(current =>
        current?.id === movement.id && current.sequence === sequence
          ? { ...current, status: 'error' }
          : current
      );
      setError(controlError?.message || 'No se pudo enviar el movimiento');
    }
  }

  function handleMovementPointerDown(event) {
    if (movementPointerRef.current !== null) return;

    event.preventDefault();
    movementPointerRef.current = event.pointerId;
    movementJoystickRef.current?.setPointerCapture?.(event.pointerId);
    createMovementGesture();
    const position = readControlPosition(movementJoystickRef, event);
    setMovementPosition({ ...position, active: true });
    publishMovementPosition(position);
  }

  function handleMovementPointerMove(event) {
    if (movementPointerRef.current !== event.pointerId) return;

    event.preventDefault();
    const position = readControlPosition(movementJoystickRef, event);
    setMovementPosition({ ...position, active: true });
    publishMovementPosition(position);
  }

  function handleMovementPointerUp(event) {
    if (movementPointerRef.current !== event.pointerId) return;

    event.preventDefault();
    const position = readControlPosition(movementJoystickRef, event);
    movementJoystickRef.current?.releasePointerCapture?.(event.pointerId);
    movementPointerRef.current = null;
    setMovementPosition({ x: 0, y: 0, active: false });
    publishMovementPosition(position, true);
    movementGestureRef.current = null;
  }

  function handleMovementPointerCancel(event) {
    if (movementPointerRef.current !== event.pointerId) return;

    movementPointerRef.current = null;
    movementGestureRef.current = null;
    setMovementPosition({ x: 0, y: 0, active: false });
  }

  function handleMovementKeyDown(event) {
    const keyboardVectors = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const position = keyboardVectors[event.key];
    if (!position) return;

    event.preventDefault();
    createMovementGesture();
    setMovementPosition({ ...position, active: true });
    publishMovementPosition(position, true);
    movementGestureRef.current = null;
    window.setTimeout(() => setMovementPosition({ x: 0, y: 0, active: false }), 140);
  }

  async function cancelCameraDirection() {
    joystickPointerRef.current = null;
    joystickGestureRef.current = null;
    movementPointerRef.current = null;
    movementGestureRef.current = null;
    setJoystickPosition({ x: 0, y: 0, active: false });
    setMovementPosition({ x: 0, y: 0, active: false });
    setClientCommand(null);
    setClientMovement(null);
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setActiveCommand(null);
    setActiveMovement(null);
    setGuidanceProgress(0);
    setGuidanceVector({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
    await send({ type: 'camera-control-cancel' });
  }

  function dismissCameraGuidance() {
    activeCommandRef.current = null;
    commandBaselineRef.current = null;
    setActiveCommand(null);
    setActiveMovement(null);
    setGuidanceProgress(0);
    setGuidanceVector({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
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
    setActiveMovement(null);
    setGuidanceProgress(0);
    setGuidanceVector({ yaw: 0, pitch: 0, remainingYaw: 0, remainingPitch: 0 });
    setControlPanelOpen(false);
    setClientCommand(null);
    setClientMovement(null);
    setJoystickPosition({ x: 0, y: 0, active: false });
    setMovementPosition({ x: 0, y: 0, active: false });
    joystickPointerRef.current = null;
    joystickGestureRef.current = null;
    movementPointerRef.current = null;
    movementGestureRef.current = null;
    setControlRequest(null);
    setControlRequestStatus('idle');
    setStatus('Sala detenida');
  }

  // -------------------------
  // UI
  // -------------------------

  const activeCommandLabel = activeCommand
    ? describeCameraVector(activeCommand.yawDegrees, activeCommand.pitchDegrees)
    : '';
  const clientCommandLabel = clientCommand
    ? describeCameraVector(clientCommand.yawDegrees, clientCommand.pitchDegrees)
    : '';
  const joystickVector = joystickToCameraVector(joystickPosition, controlAngle);
  const joystickLabel = describeCameraVector(
    joystickVector.yawDegrees,
    joystickVector.pitchDegrees
  );
  const movementLabel = describeMovementVector(movementPosition.x, movementPosition.y);
  const activeMovementLabel = activeMovement
    ? describeMovementVector(activeMovement.x, activeMovement.y)
    : '';
  const clientMovementLabel = clientMovement
    ? describeMovementVector(clientMovement.x, clientMovement.y)
    : '';
  const guidanceRange = activeCommand?.maxDegrees || 30;
  const targetLength = activeCommand
    ? clamp(activeCommand.targetDegrees / guidanceRange, 0, 1) * 25
    : 0;
  const sensorLength = activeCommand
    ? clamp(Math.hypot(guidanceVector.yaw, guidanceVector.pitch) / guidanceRange, 0, 1) * 25
    : 0;
  const guidanceStyle = {
    '--guidance-progress': `${Math.round(guidanceProgress * 360)}deg`,
    '--target-angle': `${Math.atan2(-(activeCommand?.pitchDegrees || 0), activeCommand?.yawDegrees || 0) * 180 / Math.PI}deg`,
    '--target-length': `${targetLength}px`,
    '--sensor-angle': `${Math.atan2(-guidanceVector.pitch, guidanceVector.yaw) * 180 / Math.PI}deg`,
    '--sensor-length': `${sensorLength}px`,
  };
  const aimControlStyle = {
    '--joystick-x': `${joystickPosition.x * 40}px`,
    '--joystick-y': `${joystickPosition.y * 40}px`,
    '--aim-angle': `${Math.atan2(joystickPosition.y, joystickPosition.x) * 180 / Math.PI}deg`,
    '--aim-length': `${Math.hypot(joystickPosition.x, joystickPosition.y) * 40}px`,
  };
  const movementControlStyle = {
    '--joystick-x': `${movementPosition.x * 40}px`,
    '--joystick-y': `${movementPosition.y * 40}px`,
  };
  const movementGuideStyle = {
    '--movement-angle': `${Math.atan2(activeMovement?.x || 0, -(activeMovement?.y || 0)) * 180 / Math.PI}deg`,
  };

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
          {role === 'Local' && (activeCommand || activeMovement) && (
            <div className={`cameraGuidanceOverlay ${activeCommand?.completed ? 'isComplete' : ''}`} role="status" aria-live="polite">
              <div className="cameraGuidanceHeader">
                <span>Guía del Cliente</span>
                <button type="button" onClick={dismissCameraGuidance} aria-label="Cerrar indicación">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="cameraGuidanceSteps">
                <div className={`cameraInstructionCard ${activeMovement ? 'isActive' : ''}`}>
                  <header><b>1</b><span>Muévete</span></header>
                  <div className={`cameraMovementGuide ${activeMovement ? 'isActive' : ''}`} style={movementGuideStyle} aria-hidden="true">
                    <span><i /></span>
                  </div>
                  <strong>{activeMovement ? activeMovementLabel : 'Mantén tu posición'}</strong>
                  <small>{activeMovement ? 'Sigue la flecha con tu cuerpo.' : 'No necesitas desplazarte.'}</small>
                </div>
                <div className={`cameraInstructionCard ${activeCommand ? 'isActive' : ''}`}>
                  <header><b>2</b><span>Apunta la cámara</span></header>
                  <div className="cameraGuidanceDial" style={guidanceStyle} aria-hidden="true">
                    {activeCommand?.completed
                      ? <Check size={36} />
                      : activeCommand
                        ? (
                          <span className="cameraGuidanceMotion">
                            <i className="cameraGuidanceTargetVector" />
                            <i className={`cameraGuidanceSensorVector ${orientationDetected ? 'isDetected' : ''}`} />
                          </span>
                        )
                        : <Crosshair size={26} />}
                  </div>
                  <strong>{activeCommand?.completed ? 'Posición correcta' : activeCommand ? activeCommandLabel : 'Mantén el encuadre'}</strong>
                  <small>
                    {activeCommand?.completed
                      ? 'Mantén el móvil así.'
                      : orientationDetected && activeCommand
                        ? 'Lleva la punta blanca hasta la azul.'
                        : activeCommand
                          ? 'Mueve el móvil en la dirección indicada.'
                          : 'No necesitas girar la cámara.'}
                  </small>
                  {activeCommand && !activeCommand.completed && (
                    <div className="cameraVectorLegend" aria-hidden="true"><span>● Objetivo</span><span>● Posición real</span></div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {started && role === 'Cliente' && remoteControlAvailable && controlPanelOpen && (
          <section className="cameraDirectionPanel" aria-label="Dirección remota de la cámara">
            <header>
              <div>
                <span>Control remoto</span>
                <strong>Mueve y apunta</strong>
              </div>
              <button type="button" onClick={() => setControlPanelOpen(false)} aria-label="Cerrar controles">
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            <p className="cameraControlIntro">Dos controles independientes, como un mando PTZ sencillo.</p>

            <div className="cameraControlPair">
              <div className="cameraControlUnit">
                <div className="cameraControlUnitTitle"><b>1</b><span>Mover al Local</span></div>
                <div
                  ref={movementJoystickRef}
                  className={`cameraJoystick movementJoystick ${movementPosition.active ? 'isActive' : ''}`}
                  role="group"
                  tabIndex={0}
                  aria-label="Joystick de movimiento horizontal. Arrastra o usa las flechas"
                  style={movementControlStyle}
                  onPointerDown={handleMovementPointerDown}
                  onPointerMove={handleMovementPointerMove}
                  onPointerUp={handleMovementPointerUp}
                  onPointerCancel={handleMovementPointerCancel}
                  onKeyDown={handleMovementKeyDown}
                  onContextMenu={event => event.preventDefault()}
                >
                  <span className="cameraJoystickAxes" aria-hidden="true" />
                  <span className="cameraControlAxis isUp" aria-hidden="true">Avanza</span>
                  <span className="cameraControlAxis isRight" aria-hidden="true">Dcha.</span>
                  <span className="cameraControlAxis isDown" aria-hidden="true">Atrás</span>
                  <span className="cameraControlAxis isLeft" aria-hidden="true">Izq.</span>
                  <span className="cameraJoystickThumb" aria-hidden="true"><Gamepad2 size={18} /></span>
                </div>
                <strong>{movementPosition.active ? movementLabel : clientMovement ? clientMovementLabel : 'Sin movimiento'}</strong>
                <small>Indica hacia dónde debe caminar.</small>
              </div>

              <div className="cameraControlUnit">
                <div className="cameraControlUnitTitle"><b>2</b><span>Apuntar cámara</span></div>
                <div
                  ref={joystickRef}
                  className={`cameraJoystick cameraAimControl ${joystickPosition.active ? 'isActive' : ''}`}
                  role="group"
                  tabIndex={0}
                  aria-label="Círculo de orientación. Arrastra la punta o usa las flechas"
                  style={aimControlStyle}
                  onPointerDown={handleJoystickPointerDown}
                  onPointerMove={handleJoystickPointerMove}
                  onPointerUp={handleJoystickPointerUp}
                  onPointerCancel={handleJoystickPointerCancel}
                  onKeyDown={handleJoystickKeyDown}
                  onContextMenu={event => event.preventDefault()}
                >
                  <span className="cameraJoystickAxes" aria-hidden="true" />
                  <span className="cameraControlAxis isUp" aria-hidden="true">Arriba</span>
                  <span className="cameraControlAxis isRight" aria-hidden="true">Dcha.</span>
                  <span className="cameraControlAxis isDown" aria-hidden="true">Abajo</span>
                  <span className="cameraControlAxis isLeft" aria-hidden="true">Izq.</span>
                  <span className="cameraAimVector" aria-hidden="true" />
                  <span className="cameraJoystickThumb" aria-hidden="true"><Crosshair size={18} /></span>
                </div>
                <strong>{joystickPosition.active ? joystickLabel : clientCommand ? clientCommandLabel : 'Sin giro'}</strong>
                <small>Indica hacia dónde debe apuntar.</small>
              </div>
            </div>

            <button type="button" className="cameraDirectionCancel" onClick={cancelCameraDirection} disabled={!clientCommand && !clientMovement}>
              <Crosshair size={15} aria-hidden="true" />
              Borrar instrucciones
            </button>
          </section>
        )}

        {started && role === 'Local' && controlRequest && !remoteControlEnabled && (
          <section className="cameraControlRequest" role="dialog" aria-modal="false" aria-labelledby="camera-control-request-title">
            <span className="cameraControlRequestIcon" aria-hidden="true"><Gamepad2 size={22} /></span>
            <div>
              <span>Solicitud del Cliente</span>
              <strong id="camera-control-request-title">¿Permitir que dirija la cámara?</strong>
              <small>Recibirás una diana guiada por los sensores de movimiento. Puedes revocarlo cuando quieras.</small>
            </div>
            <div className="cameraControlRequestActions">
              <button type="button" onClick={() => respondToControlRequest(false)}>Rechazar</button>
              <button type="button" className="accept" onClick={() => respondToControlRequest(true)}>Permitir</button>
            </div>
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
              {role === 'Local' && remoteControlEnabled && (
                <button
                  type="button"
                  className="videoControlButton isEnabled"
                  onClick={revokeRemoteControl}
                  aria-label="Revocar dirección remota"
                >
                  <ShieldCheck size={19} aria-hidden="true" />
                  <span>Revocar dirección</span>
                </button>
              )}
              {role === 'Cliente' && (
                <button
                  type="button"
                  className={`videoControlButton ${controlPanelOpen ? 'isEnabled' : ''}`}
                  onClick={remoteControlAvailable ? () => setControlPanelOpen(open => !open) : requestRemoteControl}
                  disabled={controlRequestStatus === 'pending'}
                  aria-pressed={remoteControlAvailable ? controlPanelOpen : undefined}
                  aria-label={remoteControlAvailable ? 'Abrir dirección remota' : 'Solicitar dirección remota al Local'}
                >
                  <Gamepad2 size={19} aria-hidden="true" />
                  <span>
                    {remoteControlAvailable
                      ? 'Dirigir cámara'
                      : controlRequestStatus === 'pending'
                        ? 'Solicitud enviada'
                        : 'Solicitar dirección'}
                  </span>
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
