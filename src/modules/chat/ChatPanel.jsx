import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Send } from 'lucide-react';

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
  const isActiveRef = useRef(isActive);
  const onUnreadRef = useRef(onUnread);

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
  }, [requestId]);

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

  // --------------------------------------------------
  // ENVIAR
  // --------------------------------------------------

  async function handleSend() {
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

      alert(
        'No se pudo enviar el mensaje'
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(
    event
  ) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      handleSend();
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <section className={`card chat ${isActive ? 'isActive' : 'isBackground'}`} aria-label="Chat de la sesión">

      <h3>
        Chat de sesión
      </h3>

      <div className="chatBox">

        {loading && (
          <p className="muted">
            Cargando mensajes...
          </p>
        )}

        {!loading &&
          orderedMessages.length ===
            0 && (

          <p className="muted">
            Aún no hay mensajes.
          </p>
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
                      ).toLocaleTimeString()
                    : ''}
                </small>

              </div>
            );
          }
        )}

      </div>

      <div className="chatInput">

        <input
          value={text}
          onChange={
            event =>
              setText(
                event.target.value
              )
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder="Escribe un mensaje..."
          disabled={
            sending
          }
        />

        <button
          onClick={
            handleSend
          }
          disabled={
            sending ||
            !text.trim()
          }
        >

          <Send
            size={16}
          />

          {sending
            ? 'Enviando...'
            : 'Enviar'}

        </button>

      </div>

    </section>
  );
}
