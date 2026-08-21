import React, { useCallback, useRef, useState } from 'react';
import { Map, MessageCircle, Video } from 'lucide-react';
import ChatPanel from '../chat/ChatPanel';
import WebRTCRoom from '../video/WebRTCRoom';
import LiveTrackingMap from '../../components/LiveTrackingMap';

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
  const touchStartRef = useRef(null);
  const markChatUnread = useCallback(() => setChatUnread(true), []);

  if (!request) return null;

  const activeIndex = panels.findIndex(panel => panel.id === activePanel);
  const localLocation =
    request.liveLocalLocation ||
    state.locals.find(local => local.id === request.localId)?.location ||
    null;

  function selectPanel(panelId) {
    setActivePanel(panelId);
    if (panelId === 'chat') setChatUnread(false);
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
          </button>
        ))}
      </div>

      <div className="sessionViewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sessionTrack" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          <div id="session-panel-map" aria-labelledby="session-tab-map" className={`sessionPanel mapPanel ${activePanel === 'map' ? 'active' : ''}`} role="tabpanel" aria-hidden={activePanel !== 'map'}>
            <div className="sessionMap">
              <LiveTrackingMap localLocation={localLocation} />
            </div>
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
    </section>
  );
}
