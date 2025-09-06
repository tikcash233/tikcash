import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Password } from '@/entities/all';

export default function Reset() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMsg('');
    try {
      await Password.resetWithPin({ email, pin, new_password: pw });
      setMsg('Password changed. You can log in now.');
    } catch (e) {
      setMsg('Reset failed. Check your PIN and try again.');
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
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <Input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Recovery PIN (4 digits)</label>
            <Input value={pin} onChange={(e)=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••" inputMode="numeric" />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">New password</label>
            <Input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Please wait...' : 'Change password'}</Button>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
