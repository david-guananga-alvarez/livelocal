let activitiesPromise;

export function getActivities() {
  if (!activitiesPromise) {
    activitiesPromise = fetch('/api/activities')
      .then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la agenda');
        return response.json();
      })
      .then(data => data.activities || [])
      .catch(error => {
        activitiesPromise = undefined;
        throw error;
      });
  }

  return activitiesPromise;
}
