import React from 'react';
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
    </div>
  );
}