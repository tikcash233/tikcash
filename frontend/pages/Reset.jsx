import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Password } from '@/entities/all';
import { Eye, EyeOff } from 'lucide-react';

export default function Reset() {
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgIsError, setMsgIsError] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMsg('');
    setMsgIsError(false);
    try {
      await Password.resetWithPin({ identifier, pin, new_password: pw });
      setMsg('Password changed. You can log in now.');
      setMsgIsError(false);
    } catch (e) {
      setMsg('Reset failed. Check your PIN and try again.');
      setMsgIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email or username</label>
            <Input
              value={identifier}
              onChange={(e)=>setIdentifier(e.target.value)}
              placeholder="you@example.com or @username"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Recovery PIN (4 digits)</label>
            <div className="relative">
              <Input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e)=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
                placeholder="••••"
                inputMode="numeric"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">New password</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={pw}
                onChange={(e)=>setPw(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Please wait...' : 'Change password'}</Button>
          {msg && (
            <p className={`text-sm ${msgIsError ? 'text-red-600' : 'text-green-600'}`}>
              {msg}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
