export default function NotFound() {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h1>404 - Page Not Found</h1>
        <p className="hover:text-green-500 duration-1000">The page you are looking for does not exist.</p>
        <a href="/home" className="text-blue-700">Go back to Home</a>
      </div>
    );
  }
  