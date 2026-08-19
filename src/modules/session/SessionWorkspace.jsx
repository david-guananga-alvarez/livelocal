import React from 'react';
import ChatPanel from '../chat/ChatPanel';
import WebRTCRoom from '../video/WebRTCRoom';

export default function SessionWorkspace({
  request,
  state,
  setState,
  role,
}) {
  if (!request) return null;

  return (
    <div className="workspace">
      <div className="sessionMain">
        <WebRTCRoom
          roomId={request.id}
          role={role}
        />
      </div>

      <ChatPanel
        requestId={request.id}
        sender={role}
      />
    </div>
  );
}