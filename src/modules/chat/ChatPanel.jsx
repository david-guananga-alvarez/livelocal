import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AlertCircle, Send } from 'lucide-react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';

import {
  getMessages,
  sendMessage,
} from './chatService';

export default function ChatPanel({
  requestId,
  sender,
  isActive = true,
  onUnread,
}) {
  const { user } = useAuth();

  const [text, setText] =
    useState('');

  const [messages, setMessages] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);
  const [messageError, setMessageError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const isActiveRef = useRef(isActive);
  const onUnreadRef = useRef(onUnread);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    isActiveRef.current = isActive;
    onUnreadRef.current = onUnread;
  }, [isActive, onUnread]);

  // --------------------------------------------------
  // CARGAR HISTORIAL
  // --------------------------------------------------

  useEffect(() => {
    if (!requestId) {
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      try {
        setLoading(true);
        setMessageError(null);

        const rows =
          await getMessages(
            requestId
          );

        if (cancelled) {
          return;
        }

        setMessages(
          rows.map(row => ({
            id: row.id,

            senderId:
              row.sender_id,

            senderRole:
              row.sender_role,

            text:
              row.text,

            createdAt:
              row.created_at,
          }))
        );
      } catch (error) {
        console.error(
          'Error cargando mensajes:',
          error
        );
        setMessageError({ kind: 'load', message: 'No se pudieron cargar los mensajes.' });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [requestId, loadAttempt]);

  // --------------------------------------------------
  // REALTIME NUEVOS MENSAJES
  // --------------------------------------------------

  useEffect(() => {
    if (
      !supabase ||
      !requestId
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `chat-${requestId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter:
              `request_id=eq.${requestId}`,
          },

          payload => {
            const row =
              payload.new;

            if (!row?.id) {
              return;
            }

            const incomingMessage = {
              id:
                row.id,

              senderId:
                row.sender_id,

              senderRole:
                row.sender_role,

              text:
                row.text,

              createdAt:
                row.created_at,
            };

            if (row.sender_id !== user?.id && !isActiveRef.current) {
              onUnreadRef.current?.();
            }

            setMessages(prev => {
              // Evitar duplicados si
              // el mensaje local llega
              // también por Realtime.
              const exists =
                prev.some(
                  message =>
                    message.id ===
                    incomingMessage.id
                );

              if (exists) {
                return prev;
              }

              return [
                ...prev,
                incomingMessage,
              ];
            });
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [requestId, user?.id]);

  // --------------------------------------------------
  // ORDENAR MENSAJES
  // --------------------------------------------------

  const orderedMessages =
    useMemo(
      () =>
        [...messages].sort(
          (a, b) =>
            new Date(
              a.createdAt
            ).getTime() -
            new Date(
              b.createdAt
            ).getTime()
        ),
      [messages]
    );

  useEffect(() => {
    if (isActive) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [isActive, orderedMessages.length]);

  // --------------------------------------------------
  // ENVIAR
  // --------------------------------------------------

  async function handleSend(event) {
    event?.preventDefault();
    const cleanText =
      text.trim();

    if (
      !cleanText ||
      !requestId ||
      !user?.id ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setMessageError(null);

      const row =
        await sendMessage({
          requestId,
          senderId:
            user.id,
          senderRole:
            sender,
          text:
            cleanText,
        });

      // Añadimos inmediatamente
      // para que la interfaz responda
      // sin esperar Realtime.
      setMessages(prev => {
        const exists =
          prev.some(
            message =>
              message.id ===
              row.id
          );

        if (exists) {
          return prev;
        }

        return [
          ...prev,
          {
            id:
              row.id,

            senderId:
              row.sender_id,

            senderRole:
              row.sender_role,

            text:
              row.text,

            createdAt:
              row.created_at,
          },
        ];
      });

      setText('');
    } catch (error) {
      console.error(
        'Error enviando mensaje:',
        error
      );
      setMessageError({ kind: 'send', message: 'No se pudo enviar el mensaje. Puedes volver a intentarlo.' });
    } finally {
      setSending(false);
    }
  }

  function retryLastOperation() {
    if (messageError?.kind === 'load') {
      setLoadAttempt(current => current + 1);
      return;
    }
    handleSend();
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <section className={`chat ${isActive ? 'isActive' : 'isBackground'}`} aria-label="Chat de la sesión">
      <header className="chatHeader">
        <div>
          <p className="stepLabel">Conversación</p>
          <h3>Chat de sesión</h3>
        </div>
        <span className="chatPresence"><i aria-hidden="true" /> En directo</span>
      </header>

      <div className="chatBox" role="log" aria-live="polite" aria-relevant="additions text">
        {loading && (
          <p className="chatEmpty">
            Cargando mensajes...
          </p>
        )}

        {!loading &&
          orderedMessages.length ===
            0 && (

          <div className="chatEmpty">
            <MessageCirclePlaceholder />
            <b>Empieza la conversación</b>
            <span>Los mensajes aparecerán aquí en tiempo real.</span>
          </div>
        )}

        {orderedMessages.map(
          message => {

            const isMine =
              message.senderId ===
              user?.id;

            return (
              <div
                key={
                  message.id
                }
                className={
                  `bubble ${
                    isMine
                      ? 'me'
                      : ''
                  }`
                }
              >

                <b>
                  {isMine
                    ? 'Tú'
                    : message.senderRole}
                </b>

                <span>
                  {
                    message.text
                  }
                </span>

                <small>
                  {message.createdAt
                    ? new Date(
                        message.createdAt
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </small>

              </div>
            );
          }
        )}
        <div ref={messagesEndRef} />
      </div>

      {messageError && (
        <div className="chatError" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{messageError.message}</span>
          {(messageError.kind === 'load' || text.trim()) && <button type="button" onClick={retryLastOperation} disabled={sending}>Reintentar</button>}
        </div>
      )}

      <form className="chatInput" onSubmit={handleSend}>
        <input
          value={text}
          onChange={
            event =>
              setText(
                event.target.value
              )
          }
          placeholder="Escribe un mensaje..."
          aria-label="Mensaje"
          maxLength={1000}
          autoComplete="off"
          disabled={
            sending
          }
        />

        <button type="submit" aria-label={sending ? 'Enviando mensaje' : 'Enviar mensaje'}
          disabled={
            sending ||
            !text.trim()
          }
        >

          <Send size={18} aria-hidden="true" />
          <span>{sending ? 'Enviando...' : 'Enviar'}</span>
        </button>
      </form>
    </section>
  );
}

function MessageCirclePlaceholder() {
  return <span className="chatEmptyIcon" aria-hidden="true">•••</span>;
}
