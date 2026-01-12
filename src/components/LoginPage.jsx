// src/components/LoginPage.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebaseConfig';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // <--- Stores the password user types
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // DEFINED MASTER EMAIL
  const MASTER_ADMIN_EMAIL = "master@admin.com"; 

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. THIS CHECKS THE PASSWORD WITH FIREBASE
      // If the password is wrong, this line throws an error and stops.
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      const user = userCredential.user;

      // 2. PASSWORD WAS CORRECT, NOW CHECK WHO IT IS
      if (user.email === MASTER_ADMIN_EMAIL) {
        console.log("Master Admin identified. Redirecting...");
        navigate('/master-dashboard'); 
      } else {
        navigate('/home'); 
      }
      
    } catch (err) {
      console.error("Login error:", err);
      setError('Failed to log in. Wrong email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-semibold mb-2">Email</label>
            <input
              className="border rounded w-full py-2 px-3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2">Password</label>
            <input
              className="border rounded w-full py-2 px-3"
              type="password" // <--- This hides the characters
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          
          <div className="mt-4 text-center">
             <Link to="/register" className="text-blue-500 text-sm">Create regular account</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;