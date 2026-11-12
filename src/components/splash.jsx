import logo from '@/assets/frizo-logo.svg';

// Same look as the splash written into index.html, so the screen doesn't change
// between the page loading, the session being checked and the data arriving.
export function Splash() {
	return (
		<div className="flex min-h-svh items-center justify-center">
			<img src={logo} alt="Frizo" className="h-10 w-auto" />
		</div>
	);
}
