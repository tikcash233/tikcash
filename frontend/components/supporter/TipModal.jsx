import React, { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TipModal({ creator, onSendTip, onClose }) {
	const [amount, setAmount] = useState("");
	const [name, setName] = useState("");
	const [message, setMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const presets = [5, 10, 50, 100];
	const MIN_TIP = 1;
	const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

	const amountNumber = useMemo(() => parseFloat(amount || "0"), [amount]);
	const amountInvalid = !isFinite(amountNumber) || amountNumber < MIN_TIP;

	// compute fee breakdown client-side for confirmation display
	const fees = useMemo(() => {
		const amt = amountNumber;
		if (!(amt > 0)) return { platform_fee: 0, paystack_fee: 0, creator_amount: 0 };
		const platform_fee = round2(amt * 0.17);
		const paystack_fee = round2(amt * 0.02);
		const creator_amount = round2(amt - platform_fee);
		return { platform_fee, paystack_fee, creator_amount };
	}, [amountNumber]);

	const [isConfirming, setIsConfirming] = useState(false);

	// Keep a stable idempotency key for the current form submission (retries share it)
	const currentKeyRef = useRef(null);
	const doInitiate = async () => {
		const value = amountNumber;
		if (!isFinite(value) || value <= 0) throw new Error('Invalid amount');
		if (!navigator.onLine) { alert('You appear offline. Reconnect and try again.'); return; }
		setIsSending(true);
		try {
			// Generate a key once per submission attempt
			if (!currentKeyRef.current) {
				currentKeyRef.current = 'idem_' + crypto.randomUUID().replace(/-/g,'').slice(0,24);
			}
			const attemptInitiate = async () => {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 15000); // 15s safeguard
				const res = await fetch('/api/payments/paystack/initiate', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						creator_id: creator?.id,
						amount: value,
						supporter_name: name || 'Anonymous',
						message: message || '',
						idempotency_key: currentKeyRef.current,
					}),
					signal: controller.signal
				});
				clearTimeout(timeout);
				const raw = await res.text();
				let data = {};
				if (raw) { try { data = JSON.parse(raw); } catch { throw new Error('Server sent invalid JSON'); } }
				if (!res.ok) throw new Error(data.error || `Failed (status ${res.status})`);
				if (!data.authorization_url) throw new Error('Missing authorization_url in response');
				return data.authorization_url;
			};
			let attempts = 0;
			let delay = 800; // initial backoff
			while (true) {
				try {
					const url = await attemptInitiate();
					window.location.href = url;
					break;
				} catch (err) {
					const msg = String(err.message || '');
					const retriable = (
						err.name === 'AbortError' ||
						msg.includes('Failed to fetch') ||
						msg.includes('NetworkError') ||
						msg.includes('network connection was lost')
					);
					if (!retriable || attempts >= 3) {
						if (err.name === 'AbortError') alert('Request timed out. Please try again.'); else alert(msg || 'Could not start payment');
						break;
					}
					attempts += 1;
					await new Promise(r => setTimeout(r, delay));
					delay = Math.min(delay * 2, 4000);
				}
			}
		} finally { setIsSending(false); }
	};

	const submit = async (e) => {
		e.preventDefault();
		// Validate minimum client-side and show confirmation step
		if (amountInvalid) {
			alert(`Minimum tip is GH₵ ${MIN_TIP.toFixed(2)}`);
			return;
		}
		setIsConfirming(true);
	};

	return (
		<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>{isConfirming ? 'Confirm Tip' : 'Send a Tip'}</CardTitle>
				</CardHeader>
				<CardContent>
					{isConfirming ? (
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<img
									src={creator?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.display_name || "?")}&size=64&background=ef4444&color=ffffff`}
									alt={creator?.display_name}
									className="w-12 h-12 rounded-full border"
								/>
								<div>
									<p className="font-medium">{creator?.display_name}</p>
									<p className="text-sm text-gray-500">@{creator?.tiktok_username}</p>
								</div>
							</div>
							<div className="rounded-lg border p-4 bg-gray-50">
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Gross amount</span>
									<span className="font-semibold">GH₵ {amountNumber.toFixed(2)}</span>
								</div>
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Creator receives</span>
									<span className="font-semibold">GH₵ {fees.creator_amount.toFixed(2)}</span>
								</div>
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Platform fee (17%)</span>
									<span className="font-semibold">GH₵ {fees.platform_fee.toFixed(2)}</span>
								</div>
								<div className="flex items-center justify-between py-1">
									<span className="text-sm text-gray-600">Paystack fee (2%)</span>
									<span className="font-semibold">GH₵ {fees.paystack_fee.toFixed(2)}</span>
								</div>
							</div>
							<div className="flex justify-end gap-2">
								<Button type="button" variant="outline" onClick={() => setIsConfirming(false)} disabled={isSending}>Back</Button>
								<Button type="button" onClick={async () => { try { await doInitiate(); } catch (_) {} }} disabled={isSending}>{isSending ? 'Processing...' : 'Proceed to Pay'}</Button>
							</div>
						</div>
					) : (
						<form onSubmit={submit} className="space-y-4">
						<div className="flex items-center gap-3">
							<img
								src={creator?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator?.display_name || "?")}&size=64&background=ef4444&color=ffffff`}
								alt={creator?.display_name}
								className="w-12 h-12 rounded-full border"
							/>
							<div>
								<p className="font-medium">{creator?.display_name}</p>
								<p className="text-sm text-gray-500">@{creator?.tiktok_username}</p>
							</div>
						</div>

									<div>
										<label className="block text-sm font-medium text-gray-700">Amount</label>
										<div className="flex flex-wrap gap-2 mb-2">
											{presets.map((v) => (
												<button
													key={v}
													type="button"
													onClick={() => setAmount(String(v))}
													className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
														parseFloat(amount || "0") === v
															? "bg-blue-600 text-white border-blue-600"
															: "bg-white text-gray-700 hover:bg-gray-50 border-gray-300"
													}`}
												>
													GH₵ {v}
												</button>
											))}
										</div>
										<div className="relative">
											<span className="absolute left-3 top-2.5 text-gray-500 select-none">GH₵</span>
											<Input
												className="pl-12"
												type="number"
												step="0.01"
												min={MIN_TIP}
												value={amount}
												onChange={(e) => setAmount(e.target.value)}
												placeholder={`Minimum GH₵ ${MIN_TIP.toFixed(2)}`}
												required
											/>
											{amount && amountNumber < MIN_TIP && (
												<p className="mt-1 text-xs text-red-600">Minimum tip is GH₵ {MIN_TIP.toFixed(2)}</p>
											)}
										</div>
									</div>

						<div>
							<label className="block text-sm font-medium text-gray-700">Your name (optional)</label>
							<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonymous" />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700">Message (optional)</label>
							<textarea
								className="block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
								rows={3}
								value={message}
								onChange={(e) => setMessage(e.target.value)}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={onClose} disabled={isSending}>Cancel</Button>
							<Button type="submit" disabled={isSending || amountInvalid}>Send Tip</Button>
						</div>
					</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

