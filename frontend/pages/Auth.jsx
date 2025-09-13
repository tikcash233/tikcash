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
  // email verification removed
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('supporter'); // supporter | creator
  // creator specific
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState('momo');
  const [category, setCategory] = useState('other');
  const [errors, setErrors] = useState({});
  const [recoveryPin, setRecoveryPin] = useState('');
  const { success, error } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const m = params.get('mode');
    if (m === 'register' || m === 'login') setMode(m);
  const r = params.get('role');
  if (r === 'creator' || r === 'supporter') setRole(r);
  }, [location.search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      // client-side validation
      const nextErrors = {};
      if (mode === 'register') {
        if (role === 'supporter') {
          if (!name.trim()) nextErrors.name = 'Please enter your name.';
        } else if (role === 'creator') {
          if (!tiktokUsername.trim()) nextErrors.tiktokUsername = 'TikTok username is required.';
          if (!displayName.trim()) nextErrors.displayName = 'Display name is required.';
          const ph = String(phone || '');
          if (!/^\+233\d{9}$/.test(ph)) nextErrors.phone = 'Enter a valid Ghana number as +233 then 9 digits (e.g., +233241234567).';
        }
        if (!/^\d{4}$/.test(recoveryPin)) nextErrors.recoveryPin = 'Enter a 4-digit PIN.';
      }
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }
      setErrors({});
      if (mode === 'register') {
        const u = await User.register({ email, password, name, role, 
          ...(role === 'creator' ? {
            tiktok_username: tiktokUsername,
            display_name: displayName,
            phone_number: phone,
            preferred_payment_method: payment,
            category,
          } : {}),
          recovery_pin: recoveryPin
        });
        // No email verification flow; go straight in
        success('Account created.');
        navigate(role === 'creator' ? '/creator' : '/');
      } else {
    await User.login({ email, password });
    // success('Logged in.'); // Removed notification
    navigate('/creator');
      }
    } catch (e) {
      error('Auth failed. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  // email verification removed

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4">
  <h1 className="text-xl font-semibold">{mode === 'register' ? 'Create an account' : 'Welcome back'}</h1>
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
            {role === 'supporter' && (
              <div>
                <label className="block text-sm text-gray-700 mb-1">Name</label>
                <Input value={name} onChange={(e)=>{ setName(e.target.value); if (errors.name) setErrors(prev=>({ ...prev, name: undefined })); }} placeholder="Your name" />
                {errors.name && (<p className="text-sm text-red-600 mt-1">{errors.name}</p>)}
              </div>
            )}
            {role === 'creator' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">TikTok Username</label>
                  <Input value={tiktokUsername} onChange={(e)=>{ setTiktokUsername(e.target.value); if (errors.tiktokUsername) setErrors(prev=>({ ...prev, tiktokUsername: undefined })); }} placeholder="e.g. kwesi_comedy" />
                  {errors.tiktokUsername && (<p className="text-sm text-red-600 mt-1">{errors.tiktokUsername}</p>)}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Display Name</label>
                  <Input value={displayName} onChange={(e)=>{ setDisplayName(e.target.value); if (errors.displayName) setErrors(prev=>({ ...prev, displayName: undefined })); }} placeholder="Your public name" />
                  {errors.displayName && (<p className="text-sm text-red-600 mt-1">{errors.displayName}</p>)}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Phone Number</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-600 select-none">+233</span>
                    <Input className="rounded-l-none" value={phone.startsWith('+233') ? phone.slice(4) : phone} onChange={(e)=>{
                      const digits = e.target.value.replace(/\D/g, '');
                      setPhone('+233' + digits);
                      if (errors.phone) setErrors(prev=>({ ...prev, phone: undefined }));
                    }} placeholder="Start after +233 (e.g., 241234567)" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Ghana number format only. Start after +233, don’t type 0 first.</p>
                  {errors.phone && (<p className="text-sm text-red-600 mt-1">{errors.phone}</p>)}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Preferred Payment</label>
                  <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500" value={payment} onChange={(e)=>setPayment(e.target.value)}>
                    <option value="momo">Mobile Money</option>
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
                {/* Email verification text removed */}
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
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">Recovery PIN (4 digits)</label>
              <Input value={recoveryPin} onChange={(e)=>{ setRecoveryPin(e.target.value.replace(/\D/g,'').slice(0,4)); if (errors.recoveryPin) setErrors(prev=>({ ...prev, recoveryPin: undefined })); }} placeholder="••••" inputMode="numeric" />
              {errors.recoveryPin && (<p className="text-sm text-red-600 mt-1">{errors.recoveryPin}</p>)}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Please wait...' : (mode === 'register' ? 'Sign up' : 'Log in')}</Button>
  </form>
        <div className="text-sm text-gray-600">
          {mode === 'register' ? (
            <button className="underline" onClick={()=>setMode('login')}>Have an account? Log in</button>
          ) : (
            <div className="flex items-center justify-between">
              <button className="underline" onClick={()=>setMode('register')}>New here? Create an account</button>
              <a className="underline" href="/reset">Forgot password?</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
