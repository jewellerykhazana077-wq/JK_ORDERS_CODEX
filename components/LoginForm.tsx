export default function LoginForm({ error }: { error?: string }) {
  return (
    <main className="login-shell">
      <form className="login-panel" action="/api/auth/login" method="post">
        <img className="login-logo" src="/jewellery-khazana-logo.png" alt="Jewellery Khazana" />
        <h1>Order Manager</h1>
        <label>
          User ID
          <input name="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="primary">Sign in</button>
      </form>
    </main>
  );
}
