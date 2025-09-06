import React, { useState } from 'react';
import { User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast.jsx';

export default function Auth() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [code, setCode] = useState('');
  const { success, error } = useToast();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        const u = await User.register({ email, password, name });
        // Request code right away; show verify UI
        try { await User.requestVerify(email); } catch {}
        setNeedsVerify(true);
        success('Account created. Check your email for a 6‑digit code.');
      } else {
        await User.login({ email, password });
        success('Logged in.');
      }
    } catch (e) {
      error('Auth failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await User.verify({ email, code });
      success('Email verified. You can continue.');
      setNeedsVerify(false);
    } catch (e) {
      error('Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">{needsVerify ? 'Verify your email' : (mode === 'register' ? 'Create an account' : 'Welcome back')}</h1>
        {!needsVerify ? (
        <form onSubmit={onSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Name</label>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 8 characters" required />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Please wait...' : (mode === 'register' ? 'Sign up' : 'Log in')}</Button>
        </form>
        ) : (
        <form onSubmit={onVerify} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Verification code</label>
            <Input value={code} onChange={(e)=>setCode(e.target.value)} placeholder="6-digit code" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Verifying...' : 'Verify'}</Button>
            <Button type="button" variant="secondary" disabled={loading} onClick={async ()=>{ try { await User.requestVerify(email); success('Code resent.'); } catch { error('Failed to resend.'); } }}>Resend</Button>
          </div>
        </form>
        )}
        <div className="text-sm text-gray-600">
          {mode === 'register' ? (
            <button className="underline" onClick={()=>setMode('login')}>Have an account? Log in</button>
          ) : (
            <button className="underline" onClick={()=>setMode('register')}>New here? Create an account</button>
          )}
        </div>
      </div>
    </div>
  );
}
