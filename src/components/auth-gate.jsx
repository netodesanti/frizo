import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase';
import { Group, TextField, BigButton } from '@/components/ios';
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
		<div className="flex min-h-svh flex-col items-center justify-center px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
			<form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center pb-4 text-center">
					<img src={logo} alt="Frizo" className="h-10 w-auto dark:brightness-0 dark:invert" />
					<p className="mt-4 text-[15px] text-muted-foreground">Pedidos, inventario y gastos</p>
				</div>
				<Group>
					<TextField type="email" autoComplete="email" autoCapitalize="off" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
					<TextField type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
				</Group>
				{error && <p className="px-4 text-[15px] text-destructive">{error}</p>}
				{info && <p className="px-4 text-[15px] text-muted-foreground">{info}</p>}
				<BigButton type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</BigButton>
				<button type="button" onClick={handleReset} className="w-full text-[15px] text-primary">
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
