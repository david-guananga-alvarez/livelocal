import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map, MessageCircle, Video } from 'lucide-react';
import ChatPanel from '../chat/ChatPanel';
import WebRTCRoom from '../video/WebRTCRoom';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import {
  createSessionPoint,
  deleteSessionPoint,
  getSessionPoints,
  subscribeToSessionPoints,
} from './sessionPointsService';

const panels = [
  { id: 'map', label: 'Mapa', icon: Map },
  { id: 'camera', label: 'Cámara', icon: Video },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export default function SessionWorkspace({
  request,
  state,
  setState,
  role,
}) {
  const [activePanel, setActivePanel] = useState(
    request?.status === 'in_progress' ? 'camera' : 'map'
  );
  const [chatUnread, setChatUnread] = useState(false);
  const [sessionPoints, setSessionPoints] = useState([]);
  const [mapHasUpdates, setMapHasUpdates] = useState(false);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [pointInstruction, setPointInstruction] = useState('');
  const [pointError, setPointError] = useState('');
  const [savingPoint, setSavingPoint] = useState(false);
  const touchStartRef = useRef(null);
  const markChatUnread = useCallback(() => setChatUnread(true), []);

  const refreshSessionPoints = useCallback(async () => {
    try {
      const points = await getSessionPoints(request?.id);
      setSessionPoints(points);
    } catch (error) {
      setPointError(error.message || 'No se han podido cargar los puntos');
    }
  }, [request?.id]);

  useEffect(() => {
    if (!request?.id || request.status !== 'in_progress') return undefined;
    refreshSessionPoints();
    return subscribeToSessionPoints(request.id, () => {
      refreshSessionPoints();
      if (activePanel !== 'map') setMapHasUpdates(true);
    });
  }, [request?.id, request?.status, activePanel, refreshSessionPoints]);

  if (!request) return null;

  const activeIndex = panels.findIndex(panel => panel.id === activePanel);
  const localLocation = role === 'Local'
    ? state.locals[0]?.location || request.liveLocalLocation || null
    : request.liveLocalLocation ||
      state.locals.find(local => local.id === request.localId)?.location ||
      null;

  function selectPanel(panelId) {
    setActivePanel(panelId);
    if (panelId === 'chat') setChatUnread(false);
    if (panelId === 'map') setMapHasUpdates(false);
  }

  async function confirmPoint(event) {
    event.preventDefault();
    if (!pendingPoint || savingPoint) return;
    setSavingPoint(true);
    setPointError('');
    try {
      const point = await createSessionPoint({ requestId: request.id, location: pendingPoint, instruction: pointInstruction });
      setSessionPoints(current => current.some(item => item.id === point.id) ? current : [...current, point]);
      setPendingPoint(null);
      setPointInstruction('');
    } catch (error) {
      setPointError(error.message || 'No se ha podido compartir el punto');
    } finally {
      setSavingPoint(false);
    }
  }

  async function removePoint(pointId) {
    try {
      await deleteSessionPoint(pointId);
      setSessionPoints(current => current.filter(point => point.id !== pointId));
    } catch (error) {
      setPointError(error.message || 'No se ha podido eliminar el punto');
    }
  }

  function handleTouchStart(event) {
    if (event.target.closest('button, input, textarea, video, .leaflet-container')) return;
    touchStartRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event) {
    if (touchStartRef.current == null) return;
    const endX = event.changedTouches[0]?.clientX;
    const distance = endX == null ? 0 : endX - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(distance) < 55) return;
    const nextIndex = distance < 0
      ? Math.min(activeIndex + 1, panels.length - 1)
      : Math.max(activeIndex - 1, 0);
    selectPanel(panels[nextIndex].id);
  }

  function handleTabKeyDown(event, index) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + panels.length) % panels.length;
    selectPanel(panels[nextIndex].id);
    event.currentTarget.parentElement?.children[nextIndex]?.focus();
  }

  return (
    <section className="sessionWorkspace" aria-label="Sesión en directo">
      <div className="sessionWorkspaceHeader">
        <div>
          <p className="stepLabel">Sesión en directo</p>
          <h3>{request.zoneName}</h3>
        </div>
        <span className="sessionLiveBadge"><i /> Conectada</span>
      </div>

      <div className="sessionTabs" role="tablist" aria-label="Herramientas de sesión">
        {panels.map(({ id, label, icon: Icon }, index) => (
          <button key={id} id={`session-tab-${id}`} type="button" role="tab" aria-controls={`session-panel-${id}`} aria-selected={activePanel === id} tabIndex={activePanel === id ? 0 : -1} className={activePanel === id ? 'active' : ''} onClick={() => selectPanel(id)} onKeyDown={event => handleTabKeyDown(event, index)}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'chat' && chatUnread && <i className="unreadDot" aria-label="Mensajes nuevos" />}
            {id === 'map' && mapHasUpdates && <i className="unreadDot" aria-label="Nuevos puntos en el mapa" />}
          </button>
        ))}
      </div>

      <div className="sessionViewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sessionTrack" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          <div id="session-panel-map" aria-labelledby="session-tab-map" className={`sessionPanel mapPanel ${activePanel === 'map' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'map'}>
            <div className="sessionMap">
              <LiveTrackingMap
                localLocation={localLocation}
                targetLocation={request.targetLocation}
                sessionPoints={sessionPoints}
                canAddPoint={role === 'Cliente' && request.status === 'in_progress'}
                onPointSelected={setPendingPoint}
                onDeletePoint={role === 'Cliente' ? removePoint : null}
              />
              {role === 'Cliente' && !pendingPoint && (
                <p className="sessionMapHint">Toca el mapa para indicar al local dónde debe dirigirse</p>
              )}
            </div>
            {pointError && <p className="sessionPointError" role="alert">{pointError}</p>}
          </div>

          <div id="session-panel-camera" aria-labelledby="session-tab-camera" className={`sessionPanel cameraPanel ${activePanel === 'camera' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'camera'}>
            <WebRTCRoom roomId={request.id} role={role} isActive={activePanel === 'camera'} />
          </div>

          <div id="session-panel-chat" aria-labelledby="session-tab-chat" className={`sessionPanel chatPanel ${activePanel === 'chat' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'chat'}>
            <ChatPanel requestId={request.id} sender={role} isActive={activePanel === 'chat'} onUnread={markChatUnread} />
          </div>
        </div>
      </div>
      <p className="sessionSwipeHint">Toca una pestaña o desliza para cambiar de herramienta</p>
      {pendingPoint && (
        <div className="sessionPointDialogBackdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setPendingPoint(null)}>
          <form className="sessionPointDialog" role="dialog" aria-modal="true" aria-labelledby="session-point-title" onSubmit={confirmPoint}>
            <p className="stepLabel">Nuevo punto</p>
            <h3 id="session-point-title">¿Qué debe hacer el local aquí?</h3>
            <textarea autoFocus maxLength={240} rows={3} value={pointInstruction} onChange={event => setPointInstruction(event.target.value)} placeholder="Ej.: entra por la puerta lateral (opcional)" />
            <div className="sessionPointDialogActions">
              <button type="button" className="secondary" onClick={() => setPendingPoint(null)} disabled={savingPoint}>Cancelar</button>
              <button type="submit" className="primary" disabled={savingPoint}>{savingPoint ? 'Compartiendo…' : 'Compartir punto'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
