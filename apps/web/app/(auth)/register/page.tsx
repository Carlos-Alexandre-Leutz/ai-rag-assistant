'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert("The passwords do not match!");
      return;
    }

    try {
      await api.post('/auth/register', { name, email, password });
      alert("Account created successfully!");
      router.push('/login');
    } catch (error) {
      console.error(error);
      alert("Error creating account!");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-zinc-950 text-white">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-black rounded-lg border border-zinc-800 shadow-md">
        <h1 className="text-2xl font-bold text-center">Create Account</h1>

        <form onSubmit={handleRegister} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="E-mail"
            className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full p-2.5 bg-green-600 text-white font-medium rounded hover:bg-green-700 transition-colors"
          >
            Sign up
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          Do you already have an account?{' '}
          <a href="/login" className="text-blue-500 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}