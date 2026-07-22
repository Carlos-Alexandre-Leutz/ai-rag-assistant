'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch(`${process.env.NEXT_PUBLIC_BFF_URL}/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      setIsSent(true);
    } else {
      alert("Error: User not found or server error.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-zinc-950 text-white">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-black rounded-lg border border-zinc-800 shadow-md">
        <h1 className="text-2xl font-bold text-center">Reset Password</h1>

        {!isSent ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <p className="text-sm text-gray-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full p-2 border border-gray-300 rounded"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full p-2.5 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors"
            >
              Send Reset Link
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="p-4 bg-green-950/50 border border-green-800 text-green-300 rounded-md text-sm">
              If an account exists for <span className="font-semibold text-white">{email}</span>, you will receive a password reset link shortly.
            </div>
          </div>
        )}

        <div className="text-center mt-4">
          <Link href="/login" className="text-sm text-blue-500 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}