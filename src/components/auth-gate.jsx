import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase';
import { TextField, Button } from '@/components/kit';
import logo from '@/assets/frizo-logo.svg';

const ERRORS = {
	'auth/invalid-credential': 'Correo o contraseña incorrectos',
	'auth/invalid-email': 'Correo inválido',
	'auth/too-many-requests': 'Demasiados intentos. Intentá de nuevo en unos minutos',
	'auth/network-request-failed': 'Sin conexión',
};

function LoginForm() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [info, setInfo] = useState('');
	const [busy, setBusy] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setBusy(true); setError(''); setInfo('');
		try {
			await signInWithEmailAndPassword(auth, email.trim(), password);
		} catch (err) {
			setError(ERRORS[err.code] || 'No se pudo iniciar sesión');
		} finally {
			setBusy(false);
		}
	};

	const handleReset = async () => {
		if (!email.trim()) { setError('Escribí tu correo primero'); return; }
		setError(''); setInfo('');
		try {
			await sendPasswordResetEmail(auth, email.trim());
			setInfo('Te enviamos un correo para restablecer la contraseña');
		} catch (err) {
			setError(ERRORS[err.code] || 'No se pudo enviar el correo');
		}
	};

	return (
		<div className="flex min-h-svh flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
			<div className="grain relative flex flex-1 flex-col justify-end overflow-hidden rounded-[36px] bg-brand-lime p-7 text-brand-green">
				<span className="pointer-events-none absolute -right-6 top-6 rotate-12 text-[150px] leading-none drop-shadow-2xl">🥤</span>
				<img src={logo} alt="Frizo" className="h-11 w-auto self-start" />
				<p className="mt-3 max-w-60 font-display text-[22px] font-bold leading-tight">Pedidos, inventario y gastos, en un solo lugar.</p>
			</div>
			<form onSubmit={handleSubmit} className="mx-auto mt-5 w-full max-w-sm space-y-3">
				<TextField label="Correo" type="email" autoComplete="email" autoCapitalize="off" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
				<TextField label="Contraseña" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
				{error && <p className="px-1 text-[14px] font-medium text-destructive">{error}</p>}
				{info && <p className="px-1 text-[14px] text-muted-foreground">{info}</p>}
				<Button type="submit" disabled={busy} className="mt-2">{busy ? 'Entrando…' : 'Entrar'}</Button>
				<button type="button" onClick={handleReset} className="w-full py-2 text-[14px] font-semibold text-primary">
					¿Olvidaste tu contraseña?
				</button>
			</form>
		</div>
	);
}

export function AuthGate({ children }) {
	const [user, setUser] = useState(undefined);

	useEffect(() => onAuthStateChanged(auth, setUser), []);

	if (user === undefined) return <div className="min-h-svh" />;
	if (!user) return <LoginForm />;
	return children;
}
