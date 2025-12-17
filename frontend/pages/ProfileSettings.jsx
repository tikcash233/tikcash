import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast.jsx";
import { Password } from "@/entities/all";
import { Eye, EyeOff } from "lucide-react";

export default function ProfileSettings() {
  const [pinForPassword, setPinForPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  const [currentPasswordForPin, setCurrentPasswordForPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [loadingPin, setLoadingPin] = useState(false);

  const [showPinForPassword, setShowPinForPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [showCurrentPasswordForPin, setShowCurrentPasswordForPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showNewPinConfirm, setShowNewPinConfirm] = useState(false);

  const { success, error } = useToast();

  const onSubmitChangePassword = async (e) => {
    e.preventDefault();
    if (loadingPassword) return;
    if (!/^\d{4}$/.test(pinForPassword)) {
      error("Enter a valid 4-digit PIN.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      error("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      error("Passwords do not match.");
      return;
    }
    setLoadingPassword(true);
    try {
      await Password.changeWithPin({ pin: pinForPassword, new_password: newPassword });
      success("Password updated.");
      setPinForPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (e) {
      if (e && e.body && e.body.error) error(e.body.error);
      else error("Failed to update password.");
    } finally {
      setLoadingPassword(false);
    }
  };

  const onSubmitChangePin = async (e) => {
    e.preventDefault();
    if (loadingPin) return;
    if (!currentPasswordForPin || currentPasswordForPin.length < 8) {
      error("Enter your current password.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      error("Enter a valid 4-digit PIN.");
      return;
    }
    if (newPin !== newPinConfirm) {
      error("PIN values do not match.");
      return;
    }
    setLoadingPin(true);
    try {
      await Password.changePin({ current_password: currentPasswordForPin, new_pin: newPin });
      success("PIN updated.");
      setCurrentPasswordForPin("");
      setNewPin("");
      setNewPinConfirm("");
    } catch (e) {
      if (e && e.body && e.body.error) error(e.body.error);
      else error("Failed to update PIN.");
    } finally {
      setLoadingPin(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Secure your account by managing your password and 4-digit PIN.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Change Password with PIN</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">4-digit PIN</label>
                  <div className="relative">
                    <Input
                      type={showPinForPassword ? "text" : "password"}
                      value={pinForPassword}
                      onChange={(e) => setPinForPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPinForPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showPinForPassword ? "Hide PIN" : "Show PIN"}
                    >
                      {showPinForPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">New password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Confirm new password</label>
                  <div className="relative">
                    <Input
                      type={showNewPasswordConfirm ? "text" : "password"}
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Repeat new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordConfirm((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showNewPasswordConfirm ? "Hide password" : "Show password"}
                    >
                      {showNewPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loadingPassword} className="w-full">
                  {loadingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card className="border-none shadow-lg">
            <CardHeader>
              <CardTitle>Change PIN with Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmitChangePin} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Current password</label>
                  <div className="relative">
                    <Input
                      type={showCurrentPasswordForPin ? "text" : "password"}
                      value={currentPasswordForPin}
                      onChange={(e) => setCurrentPasswordForPin(e.target.value)}
                      placeholder="Your current password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPasswordForPin((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showCurrentPasswordForPin ? "Hide password" : "Show password"}
                    >
                      {showCurrentPasswordForPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">New 4-digit PIN</label>
                  <div className="relative">
                    <Input
                      type={showNewPin ? "text" : "password"}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showNewPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Confirm new PIN</label>
                  <div className="relative">
                    <Input
                      type={showNewPinConfirm ? "text" : "password"}
                      value={newPinConfirm}
                      onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      inputMode="numeric"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPinConfirm((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                      aria-label={showNewPinConfirm ? "Hide PIN" : "Show PIN"}
                    >
                      {showNewPinConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loadingPin} className="w-full">
                  {loadingPin ? "Updating..." : "Update PIN"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
