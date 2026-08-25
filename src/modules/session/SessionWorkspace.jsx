import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Map, MessageCircle, Video } from 'lucide-react';
import ChatPanel from '../chat/ChatPanel';
import WebRTCRoom from '../video/WebRTCRoom';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import { StatusBadge } from '../../components/ui/Primitives';
import SessionSuggestionQueue from './components/SessionSuggestionQueue';
import {
  createSessionPoint,
  deleteSessionPoint,
  getSessionPoints,
  subscribeToSessionPoints,
  updateSessionSuggestionStatus,
} from './sessionPointsService';
import '../../styles/session.css';

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
  const [mapMode, setMapMode] = useState('explore');
  const [draftRoute, setDraftRoute] = useState([]);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [pointInstruction, setPointInstruction] = useState('');
  const [pointError, setPointError] = useState('');
  const [savingPoint, setSavingPoint] = useState(false);
  const [progressingPointId, setProgressingPointId] = useState(null);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const touchStartRef = useRef(null);
  const activePanelRef = useRef(activePanel);
  const pointDialogRef = useRef(null);
  const pointInstructionRef = useRef(null);
  const pointDialogReturnFocusRef = useRef(null);
  const savingPointRef = useRef(savingPoint);
  const markChatUnread = useCallback(() => setChatUnread(true), []);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    savingPointRef.current = savingPoint;
  }, [savingPoint]);

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
      if (activePanelRef.current !== 'map') setMapHasUpdates(true);
    });
  }, [request?.id, request?.status, refreshSessionPoints]);

  const activeSuggestion = sessionPoints.find(point => point.progressStatus === 'in_progress');
  const pendingSuggestionCount = sessionPoints.filter(point => point.progressStatus === 'pending').length;

  useEffect(() => {
    if (role === 'Local' && (activeSuggestion?.id || pendingSuggestionCount > 0)) {
      setQueueExpanded(true);
    }
  }, [role, activeSuggestion?.id, pendingSuggestionCount]);

  useEffect(() => {
    if (!pendingPoint) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => pointInstructionRef.current?.focus());
    const handleDialogKeyDown = event => {
      if (event.key === 'Escape' && !savingPointRef.current) {
        event.preventDefault();
        dismissPendingPoint();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(pointDialogRef.current?.querySelectorAll('button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleDialogKeyDown);
      document.body.style.overflow = previousOverflow;
      const returnTarget = pointDialogReturnFocusRef.current;
      if (returnTarget instanceof HTMLElement && returnTarget.isConnected) returnTarget.focus();
    };
  }, [pendingPoint]);

  if (!request) return null;

  const activeIndex = panels.findIndex(panel => panel.id === activePanel);
  const orderedSuggestions = [
    ...sessionPoints.filter(point => point.progressStatus === 'in_progress'),
    ...sessionPoints.filter(point => point.progressStatus === 'pending'),
    ...sessionPoints.filter(point => point.progressStatus === 'completed'),
  ];
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
      const point = await createSessionPoint({
        requestId: request.id,
        location: pendingPoint.location,
        instruction: pointInstruction,
        type: pendingPoint.type,
        title: pendingPoint.title,
        route: pendingPoint.route,
      });
      setSessionPoints(current => current.some(item => item.id === point.id) ? current : [...current, point]);
      setPendingPoint(null);
      setPointInstruction('');
      setDraftRoute([]);
      setMapMode('explore');
    } catch (error) {
      setPointError(error.message || 'No se ha podido compartir el punto');
    } finally {
      setSavingPoint(false);
    }
  }

  function chooseMapMode(nextMode) {
    setMapMode(nextMode);
    setDraftRoute([]);
    setPointError('');
  }

  function selectFreePoint(location) {
    pointDialogReturnFocusRef.current = document.activeElement;
    setPointInstruction('');
    setPendingPoint({ type: 'point', title: 'Punto indicado', location, route: [] });
  }

  function selectPlace(place) {
    pointDialogReturnFocusRef.current = document.activeElement;
    setPointInstruction(place.instruction || 'Visita este lugar');
    setPendingPoint({ type: 'place', title: place.title, location: place.location, route: [] });
  }

  function addRouteVertex(location) {
    setDraftRoute(current => current.length >= 50 ? current : [...current, location]);
  }

  function prepareRoute() {
    if (draftRoute.length < 2) return;
    pointDialogReturnFocusRef.current = document.activeElement;
    setPointInstruction('');
    setPendingPoint({
      type: 'route',
      title: 'Ruta sugerida',
      location: draftRoute[0],
      route: draftRoute,
    });
  }

  function dismissPendingPoint() {
    setPendingPoint(null);
    setPointInstruction('');
  }

  async function removePoint(pointId) {
    try {
      await deleteSessionPoint(pointId);
      setSessionPoints(current => current.filter(point => point.id !== pointId));
    } catch (error) {
      setPointError(error.message || 'No se ha podido eliminar el punto');
    }
  }

  async function progressSuggestion(point, nextStatus) {
    if (progressingPointId) return;
    setProgressingPointId(point.id);
    setPointError('');
    try {
      const updated = await updateSessionSuggestionStatus(point.id, nextStatus);
      setSessionPoints(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      setPointError(error.code === '23505'
        ? 'Finaliza la actividad actual antes de iniciar otra.'
        : error.message || 'No se ha podido actualizar la actividad');
    } finally {
      setProgressingPointId(null);
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
    <section className={`sessionWorkspace sessionWorkspace-${role === 'Local' ? 'local' : 'client'}`} aria-label="Sesión en directo" aria-describedby="session-navigation-hint">
      <div className="sessionWorkspaceHeader">
        <div className="sessionIdentity">
          <p className="stepLabel">Sesión en directo</p>
          <h3>{request.zoneName}</h3>
        </div>
        <StatusBadge tone="success" icon={<i className="sessionLiveDot" />}>Sesión conectada</StatusBadge>
      </div>

      <div className="sessionTabs" role="tablist" aria-label="Herramientas de sesión">
        {panels.map(({ id, label, icon: Icon }, index) => (
          <button key={id} id={`session-tab-${id}`} type="button" role="tab" aria-controls={`session-panel-${id}`} aria-selected={activePanel === id} tabIndex={activePanel === id ? 0 : -1} className={activePanel === id ? 'active' : ''} onClick={() => selectPanel(id)} onKeyDown={event => handleTabKeyDown(event, index)}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'chat' && chatUnread && <><i className="unreadDot" aria-hidden="true" /><span className="srOnly">Hay mensajes nuevos</span></>}
            {id === 'map' && mapHasUpdates && <><i className="unreadDot" aria-hidden="true" /><span className="srOnly">Hay nuevos puntos en el mapa</span></>}
          </button>
        ))}
      </div>

      <div className="sessionViewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sessionTrack" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          <div id="session-panel-map" aria-labelledby="session-tab-map" className={`sessionPanel mapPanel ${activePanel === 'map' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'map'} inert={activePanel !== 'map'}>
            <div className={`sessionMapLayout ${role === 'Local' ? 'withSuggestionQueue' : ''}`}>
              <div className="sessionMapStage">
                {role === 'Cliente' && (
                  <div className="sessionMapTools" role="toolbar" aria-label="Modo de interacción con el mapa">
                    {[
                      ['explore', 'Explorar'],
                      ['place', 'Comercio'],
                      ['point', 'Punto'],
                      ['route', 'Ruta'],
                    ].map(([id, label]) => (
                      <button key={id} type="button" className={mapMode === id ? 'active' : ''} aria-pressed={mapMode === id} onClick={() => chooseMapMode(id)}>{label}</button>
                    ))}
                  </div>
                )}
                <div className="sessionMap">
                  <LiveTrackingMap
                    localLocation={localLocation}
                    targetLocation={request.targetLocation}
                    sessionPoints={sessionPoints}
                    interactionMode={role === 'Cliente' && request.status === 'in_progress' ? mapMode : 'explore'}
                    draftRoute={draftRoute}
                    onPointSelected={selectFreePoint}
                    onPlaceSelected={selectPlace}
                    onRouteVertex={addRouteVertex}
                    onDeletePoint={role === 'Cliente' ? removePoint : null}
                  />
                  {role === 'Cliente' && mapMode !== 'explore' && !pendingPoint && (
                    <p className="sessionMapHint">
                      {mapMode === 'place' && 'Elige una actividad o lugar visible'}
                      {mapMode === 'point' && 'Toca el punto exacto al que debe dirigirse'}
                      {mapMode === 'route' && `Traza la ruta tocando el mapa · ${draftRoute.length} puntos`}
                    </p>
                  )}
                </div>
                {role === 'Cliente' && mapMode === 'route' && (
                  <div className="sessionRouteActions" role="toolbar" aria-label="Edición de la ruta sugerida">
                    <button type="button" className="secondary" onClick={() => setDraftRoute(current => current.slice(0, -1))} disabled={!draftRoute.length}>Deshacer</button>
                    <button type="button" className="secondary" onClick={() => setDraftRoute([])} disabled={!draftRoute.length}>Limpiar</button>
                    <button type="button" className="primary" onClick={prepareRoute} disabled={draftRoute.length < 2}>Sugerir ruta</button>
                  </div>
                )}
              </div>
              {role === 'Local' && (
                <SessionSuggestionQueue
                  suggestions={orderedSuggestions}
                  activeSuggestion={activeSuggestion}
                  progressingPointId={progressingPointId}
                  expanded={queueExpanded}
                  onToggle={() => setQueueExpanded(current => !current)}
                  onProgress={progressSuggestion}
                />
              )}
            </div>
            {pointError && <p className="sessionPointError" role="alert">{pointError}</p>}
          </div>

          <div id="session-panel-camera" aria-labelledby="session-tab-camera" className={`sessionPanel cameraPanel ${activePanel === 'camera' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'camera'} inert={activePanel !== 'camera'}>
            <WebRTCRoom roomId={request.id} role={role} isActive={activePanel === 'camera'} />
          </div>

          <div id="session-panel-chat" aria-labelledby="session-tab-chat" className={`sessionPanel chatPanel ${activePanel === 'chat' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'chat'} inert={activePanel !== 'chat'}>
            <ChatPanel requestId={request.id} sender={role} isActive={activePanel === 'chat'} onUnread={markChatUnread} />
          </div>
        </div>
      </div>
      <p id="session-navigation-hint" className="sessionSwipeHint">Toca una pestaña o desliza para cambiar de herramienta</p>
      {pendingPoint && (
        <div className="sessionPointDialogBackdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && dismissPendingPoint()}>
          <form ref={pointDialogRef} className="sessionPointDialog" role="dialog" aria-modal="true" aria-labelledby="session-point-title" aria-describedby="session-point-description" onSubmit={confirmPoint}>
            <p className="stepLabel">{pendingPoint.type === 'route' ? 'Nueva ruta' : pendingPoint.type === 'place' ? 'Nuevo lugar' : 'Nuevo punto'}</p>
            <h3 id="session-point-title">{pendingPoint.title}</h3>
            <p id="session-point-description" className="sessionPointDescription">{pendingPoint.type === 'route' ? `${pendingPoint.route.length} puntos en el recorrido.` : 'Añade una indicación para que el Local sepa qué debe hacer.'}</p>
            <label className="srOnly" htmlFor="session-point-instruction">Indicación para el Local</label>
            <textarea ref={pointInstructionRef} id="session-point-instruction" maxLength={240} rows={3} value={pointInstruction} onChange={event => setPointInstruction(event.target.value)} placeholder="Ej.: entra por la puerta lateral (opcional)" />
            <div className="sessionPointDialogActions">
              <button type="button" className="secondary" onClick={dismissPendingPoint} disabled={savingPoint}>Cancelar</button>
              <button type="submit" className="primary" disabled={savingPoint}>{savingPoint ? 'Compartiendo…' : 'Compartir sugerencia'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
