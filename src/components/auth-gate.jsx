import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
		<div className="min-h-svh flex items-center justify-center p-6 bg-muted/30">
			<Card className="w-full max-w-sm">
				<CardHeader className="items-center text-center">
					<img src={logo} alt="Frizo" className="h-10 w-auto mx-auto mb-2" />
					<CardTitle>Iniciar sesión</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-3">
						<Input type="email" autoComplete="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} required />
						<Input type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
						{error && <p className="text-sm text-destructive">{error}</p>}
						{info && <p className="text-sm text-muted-foreground">{info}</p>}
						<Button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
						<button type="button" onClick={handleReset} className="text-xs text-muted-foreground hover:underline">
							¿Olvidaste tu contraseña?
						</button>
					</form>
				</CardContent>
			</Card>
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
