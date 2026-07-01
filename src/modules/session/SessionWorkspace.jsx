import React from 'react';
import ChatPanel from '../chat/ChatPanel';
import WebRTCRoom from '../video/WebRTCRoom';
import LiveLocationPanel from './LiveLocationPanel';
export default function SessionWorkspace({ request, state, setState, role }){ if(!request) return null; return <div className="workspace"><div className="sessionMain"><WebRTCRoom roomId={request.id} role={role}/><LiveLocationPanel request={request} state={state} setState={setState} role={role}/></div><ChatPanel requestId={request.id} state={state} setState={setState} sender={role}/></div> }
