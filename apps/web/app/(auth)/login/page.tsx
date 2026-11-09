'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { GUEST_MAX_FILE_MB, listChats } from '@/lib/chats';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.removeItem('is_guest');
        if (response.data.name) {
          localStorage.setItem('user_name', response.data.name);
        }
        const chats = await listChats().catch(() => []);
        router.push(chats.length ? `/dashboard/${chats[0].id}` : '/dashboard');
      } else {
        alert('Erro ao logar!');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao logar!');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-zinc-950 text-white">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-black rounded-lg border border-zinc-800 shadow-md">
        <h1 className="text-2xl font-bold text-center">Login</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="E-mail"
            className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Senha"
          className="w-full p-2 border border-gray-300 rounded"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full p-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-blue-500 mt-4">
          <a href="/register" className="hover:underline">Create Account</a>
          <a href="/forgot-password" className="hover:underline">Forgot Password</a>
        </div>

        <div className="border-t border-zinc-800 pt-4 space-y-2 text-center">
          <Link
            href="/dashboard"
            className="block w-full p-2.5 border border-zinc-700 text-white font-medium rounded hover:bg-zinc-900 transition-colors"
          >
            Try without signing up
          </Link>
          <p className="text-xs text-zinc-400">
            Guest limits: 1 PDF up to {GUEST_MAX_FILE_MB} MB, 20 questions, everything deleted
            after 24 hours.
          </p>
        </div>
      </div>
    </main>
  );
}