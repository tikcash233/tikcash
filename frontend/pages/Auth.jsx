import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('supporter'); // supporter | creator
  // creator specific
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('momo');
  const [category, setCategory] = useState('other');
  const { success, error } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('mode');
    if (m === 'register' || m === 'login') setMode(m);
  }, [location.search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        const u = await User.register({ email, password, name, role });
        // Request code right away; show verify UI
        try { await User.requestVerify(email); } catch {}
        setNeedsVerify(true);
        success('Account created. Check your email for a 6‑digit code.');
      } else {
        await User.login({ email, password });
        success('Logged in.');
        navigate('/creator');
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
      success('Email verified.');
      setNeedsVerify(false);
      if (role === 'creator') {
        // Redirect to creator page to create the profile (server enforces verified status)
        navigate('/creator');
      } else {
        navigate('/');
      }
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
            <>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Registering as</label>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setRole('supporter')} className={`px-3 py-1.5 rounded-lg border ${role==='supporter'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`}>Supporter</button>
                <button type="button" onClick={()=>setRole('creator')} className={`px-3 py-1.5 rounded-lg border ${role==='creator'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-300'}`}>Creator</button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Name</label>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name" />
            </div>
            {role === 'creator' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">TikTok Username</label>
                  <Input value={tiktokUsername} onChange={(e)=>setTiktokUsername(e.target.value)} placeholder="e.g. kwesi_comedy" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Display Name</label>
                  <Input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your public name" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Phone Number</label>
                  <Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="Used for withdrawals" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Preferred Payment</label>
                  <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500" value={payment} onChange={(e)=>setPayment(e.target.value)}>
                    <option value="momo">Mobile Money</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Category</label>
                  <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500" value={category} onChange={(e)=>setCategory(e.target.value)}>
                    <option value="comedy">Comedy</option>
                    <option value="dance">Dance</option>
                    <option value="food">Food</option>
                    <option value="music">Music</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500">We’ll ask you to verify email, then finish profile creation on your dashboard.</p>
              </div>
            )}
            </>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 8 characters" required />
              <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-900" onClick={()=>setShowPassword(v=>!v)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
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
