import React, { useState } from 'react';
import { Eye, Lock, Mail } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function LoginScreen(){
  const { signInWithGoogle, hasSupabaseConfig } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleGoogle(){
    setError('');
    setBusy(true);
    try { await signInWithGoogle(); }
    catch(e){ setError(e.message || 'No se pudo iniciar sesión con Google'); }
    finally { setBusy(false); }
  }

  return <main className="loginPage">
    <section className="loginCard">
      <div className="loginBrand"><span><Eye size={26}/></span><b>LiveLocal</b></div>
      <p className="eyebrow">Conecta con alguien que ya está allí</p>
      <h1>Accede para pedir o aceptar sesiones</h1>
      <p>Explora una zona de Barcelona en directo o ayuda a otra persona mostrando lo que sucede a tu alrededor.</p>
      <button className="googleBtn" onClick={handleGoogle} disabled={busy}>
        <Mail size={18}/>{busy ? 'Conectando...' : 'Continuar con Google'}
      </button>
      {!hasSupabaseConfig && <div className="devNotice"><Lock size={16}/><span>Modo desarrollo: falta configurar Supabase. Este botón crea una sesión demo local.</span></div>}
      {error && <p className="errorText">{error}</p>}
    </section>
  </main>;
}
