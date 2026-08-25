import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { prices } from '../../data/seed';

import {
  getMatchingLocals,
} from '../matching/matching';

import ConfirmDialog from '../../components/ConfirmDialog';
import ToastRegion from '../../components/ToastRegion';

import ClientBookingFlow from './components/ClientBookingFlow';
import ClientActiveService from './components/ClientActiveService';

import {
  createRequest,
  updateRequestStatus,
} from '../requests/requestsService';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import '../../styles/client.css';

export default function ClientView({
  state,
  setState,
}) {
  const { user } = useAuth();

  const [targetLocation, setTargetLocation] = useState(null);
  const [targetAddress, setTargetAddress] = useState('');

  const [duration, setDuration] =
    useState(15);

  const [notes, setNotes] =
    useState(
      'Enséñame la zona en directo y responde dudas.'
    );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const notify = message => setToast({ message, type: 'error' });

  // --------------------------------------------------
  // REALTIME REQUESTS
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase || !user?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `client-requests-${user.id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        payload => {
          const row = payload.new;

          if (
            row.client_id !== user.id
          ) {
            return;
          }

          setState(prev => ({
            ...prev,

            requests:
              prev.requests.map(
                request =>
                  request.id === row.id
                    ? {
                        ...request,

                        status:
                          row.status,

                        localId:
                          row.local_id,

                        createdAt:
                          row.created_at ??
                          request.createdAt,

                        targetLocation:
                          row.target_latitude != null &&
                          row.target_longitude != null
                            ? {
                                lat: row.target_latitude,
                                lng: row.target_longitude,
                              }
                            : request.targetLocation,
                      }
                    : request
              ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [user?.id]);

  // --------------------------------------------------
  // REALTIME LOCAL LOCATION
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase || !user?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `client-local-position-${user.id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locals',
        },
        payload => {
          const row = payload.new;

          if (!row?.user_id) {
            return;
          }

          setState(prev => ({
            ...prev,

            requests:
              prev.requests.map(
                request => {
                  if (
                    request.localId !==
                    row.user_id
                  ) {
                    return request;
                  }

                  return {
                    ...request,

                    liveLocalLocation: {
                      lat:
                        row.latitude,

                      lng:
                        row.longitude,

                      accuracy:
                        row.accuracy,

                      updatedAt:
                        row.updated_at,
                    },
                  };
                }
              ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [user?.id]);

  // --------------------------------------------------
  // ACTIVE REQUESTS
  // --------------------------------------------------

  const activeClientStatuses = [
    'pending',
    'matched',
    'on_the_way',
    'arrived',
    'in_progress',
  ];

  const activeRequests =
    state.requests
      .filter(
        request =>
          request.clientId ===
            user?.id &&
          activeClientStatuses.includes(
            request.status
          )
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );

  const matches =
    useMemo(
      () =>
        getMatchingLocals(
          state.locals,
          targetLocation
        ),
      [
        state.locals,
        targetLocation,
      ]
    );

  function selectTargetLocation(position, address) {
    setTargetLocation(position);
    setTargetAddress(address);
  }

  function continueToDetails() {
    if (targetLocation && targetAddress) setBookingStep(2);
  }

  // --------------------------------------------------
  // CREATE REQUEST
  // --------------------------------------------------

  async function requestNow() {
    if (isSubmitting) return;
    if (!user?.id) {
      notify(
        'Debes iniciar sesión para crear una petición'
      );

      return;
    }

    if (!targetLocation || !targetAddress || targetAddress === 'Buscando dirección…') {
      notify(
        'Selecciona el punto exacto de la solicitud'
      );

      return;
    }

    const best =
      matches[0];

    const request = {
      id:
        crypto.randomUUID(),

      clientId:
        user.id,

      address: targetAddress,

      zoneId: targetAddress,

      zoneName: targetAddress,

      zoneCenter: targetLocation,

      targetLocation,

      duration,

      price:
        prices[duration],

      notes,

      status:
        'pending',

      createdAt:
        new Date().toISOString(),

      localId:
        null,

      candidateLocalIds:
        matches.map(
          local =>
            local.id
        ),

      bestEta:
        best?.etaMinutes ??
        null,

      bestDistanceKm:
        best?.distanceKm ??
        null,
    };

    setIsSubmitting(true);
    try {
      await createRequest(
        request
      );

      setState(prev => ({
        ...prev,

        requests: [
          ...prev.requests,
          request,
        ],
      }));
      setToast({ message: 'Solicitud creada. Estamos buscando un local cercano.', type: 'success' });
    } catch (error) {
      console.error(
        'Error creando petición:',
        error
      );

      notify(
        'No se pudo crear la petición'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------
  // CANCEL
  // --------------------------------------------------

  async function cancelRequest(
    request
  ) {
    setActionBusy(true);

    try {
      await updateRequestStatus(
        request.id,
        'cancelled'
      );

      setState(prev => ({
        ...prev,

        requests:
          prev.requests.map(
            current =>
              current.id ===
              request.id
                ? {
                    ...current,
                    status:
                      'cancelled',
                  }
                : current
          ),
      }));
      setCancelTarget(null);
      setToast({ message: 'Solicitud cancelada.', type: 'success' });
    } catch (error) {
      console.error(
        'Error cancelando solicitud:',
        error
      );

      notify(
        'No se pudo cancelar la solicitud'
      );
    } finally {
      setActionBusy(false);
    }
  }

  // --------------------------------------------------
  // COMPLETE
  // --------------------------------------------------

  async function complete(
    request
  ) {
    try {
      await updateRequestStatus(
        request.id,
        'completed'
      );

      setState(prev => ({
        ...prev,

        requests:
          prev.requests.map(
            current =>
              current.id ===
              request.id
                ? {
                    ...current,
                    status:
                      'completed',
                  }
                : current
          ),
      }));
    } catch (error) {
      console.error(
        'Error finalizando servicio:',
        error
      );

      notify(
        'No se pudo finalizar el servicio'
      );
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className={`stack appView clientView ${activeRequests.length ? 'hasActiveService' : 'isBooking'}`}>
      <ToastRegion toast={toast} onDismiss={() => setToast(null)} />
      <ConfirmDialog open={Boolean(cancelTarget)} title="Cancelar solicitud" message="¿Quieres cancelar esta solicitud? El local dejará de verla como activa." confirmLabel="Sí, cancelar" busy={actionBusy} onCancel={() => setCancelTarget(null)} onConfirm={() => cancelRequest(cancelTarget)} />

      {activeRequests.length > 0 && (
        <ClientActiveService requests={activeRequests} state={state} setState={setState} onCancel={setCancelTarget} onComplete={complete} />
      )}

      {/* NUEVA PETICIÓN */}
      {activeRequests.length === 0 && (
        <ClientBookingFlow
          step={bookingStep}
          targetLocation={targetLocation}
          targetAddress={targetAddress}
          matches={matches}
          duration={duration}
          notes={notes}
          isSubmitting={isSubmitting}
          onLocationChange={selectTargetLocation}
          onDurationChange={setDuration}
          onNotesChange={setNotes}
          onStepChange={setBookingStep}
          onContinue={continueToDetails}
          onSubmit={requestNow}
        />
      )}

    </div>
  );
}
